import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AthleteData,
  ChatMessage,
  GeneratedPlan,
  TargetEvent,
  Wellness,
} from "@/lib/types";

export const dynamic = "force-dynamic";
// Allow long plan generations to run (capped to the Vercel plan's limit).
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-20250514";
const MAX_MESSAGES = 20;
const MAX_TOKENS = 16000;

/** Full athlete context passed to the system-prompt builder. */
type CoachContext = (AthleteData & { targetEvents?: TargetEvent[] }) | null;

function latestWellness(athleteData: CoachContext): Wellness | null {
  const w = athleteData?.wellness;
  if (!Array.isArray(w) || w.length === 0) return null;
  return [...w].sort((a, b) => b.id.localeCompare(a.id))[0];
}

function daysFromToday(date: string, today: string): number {
  const a = new Date(`${date}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}

function buildSystemPrompt(
  athleteData: CoachContext,
  currentPlan: GeneratedPlan | null
): string {
  const today = new Date().toISOString().slice(0, 10);
  const w = latestWellness(athleteData);

  const ftp =
    athleteData?.profile?.ftp != null
      ? String(athleteData.profile.ftp)
      : "unknown";
  const ctl = w?.ctl != null ? String(Math.round(w.ctl)) : "unknown";
  const atl = w?.atl != null ? String(Math.round(w.atl)) : "unknown";
  const tsb = w?.tsb != null ? String(Math.round(w.tsb)) : "unknown";
  const weeklyHours =
    athleteData?.weeklyHours != null
      ? String(athleteData.weeklyHours)
      : "not provided";
  const preferredDays =
    athleteData?.preferredDays && athleteData.preferredDays.length > 0
      ? athleteData.preferredDays.join(", ")
      : "not provided";

  const events = athleteData?.targetEvents ?? [];
  const eventsText =
    events.length === 0
      ? "No target events set."
      : events
          .map(
            (e) =>
              `- ${e.name} | ${e.type} | Priority ${e.priority} | ${e.date} | ${daysFromToday(
                e.date,
                today
              )} days from today`
          )
          .join("\n");

  // Recent actual training, used for reassessing whether targets are met.
  const recent = (athleteData?.activities ?? [])
    .slice()
    .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
    .slice(0, 14)
    .map(
      (a) =>
        `- ${a.start_date_local.slice(0, 10)} | ${a.type} | ${a.name} | load ${
          a.icu_training_load ?? "—"
        }`
    )
    .join("\n");
  const recentText = recent || "No recent activities synced.";

  const planText = currentPlan
    ? JSON.stringify(currentPlan, null, 2)
    : "No plan has been generated yet.";

  return `You are an expert endurance sports coach. Today is ${today}.

## Athlete profile
- FTP: ${ftp} watts
- CTL (fitness): ${ctl} — chronic training load, higher = fitter
- ATL (fatigue): ${atl} — acute training load, higher = more fatigued
- TSB (form): ${tsb} — positive = fresh, negative = fatigued
- Weekly hours available: ${weeklyHours}
- Preferred training days: ${preferredDays}

## Target events
${eventsText}
(Each event listed as: name, type, priority, date, and days from today)

## Recent actual training (last 14 activities)
${recentText}

## Current saved plan
${planText}

## How to coach
- Always reference the athlete's actual CTL, TSB, and days until their next priority A event
- When building a plan, identify the next Priority A event and work backwards
- Use 3-weeks-load + 1-week-recovery periodization blocks
- Do not prescribe a CTL ramp of more than 5 points per week
- Include a 2-week taper before any A event
- Determine training phase automatically: base (>16 weeks out), build (8–16 weeks), peak (4–8 weeks), taper (<4 weeks)
- Ask for weekly hours only if not already provided
- Keep workout descriptions concise — 3 to 5 short lines each

## Revising an existing plan
- When the athlete asks to change any part of the current saved plan, re-output the COMPLETE updated plan as a \`\`\`plan block — all weeks, not just the changed ones — so the app can save it.
- Acknowledge what you changed in prose before the block.

## Reassessing progress
- When the athlete asks how their plan is going (or to reassess), compare the "plannedLoad" values in the current saved plan against their recent actual training load and CTL/ATL/TSB trend.
- State clearly whether they are ahead of, on track with, or behind the plan.
- Recommend specific adjustments (add recovery, cut volume, extend a block, bring intensity forward) and explain why.
- Only re-output a \`\`\`plan block if the plan actually needs to change; otherwise give advice in prose only.

## Plan output format
When the athlete asks for a training plan, output the plan as a JSON block labelled \`\`\`plan (triple backtick then the word plan). Use this schema per workout:
{
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "Base",
      "totalHours": 8,
      "workouts": [
        {
          "date": "YYYY-MM-DD",
          "name": "Long endurance ride",
          "type": "Ride",
          "durationMinutes": 120,
          "description": "- 10m 40%-65% FTP\\n- 100m 60-75% FTP\\n- 10m Z1",
          "intensity": "Z2",
          "plannedLoad": 65
        }
      ]
    }
  ]
}

Only schedule workouts on the athlete's preferred training days. Do not output the plan JSON unless the athlete explicitly asks for a plan or a revision. Always close the \`\`\`plan block with a closing triple backtick.`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      messages?: ChatMessage[];
      athleteData?: AthleteData | null;
      targetEvents?: TargetEvent[];
      currentPlan?: GeneratedPlan | null;
    };
    const messages = (body.messages ?? []).slice(-MAX_MESSAGES);
    const targetEvents = body.targetEvents ?? [];
    const currentPlan = body.currentPlan ?? null;
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const context: CoachContext = body.athleteData
      ? { ...body.athleteData, targetEvents }
      : ({ targetEvents } as CoachContext);

    const anthropic = new Anthropic({ apiKey });

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(context, currentPlan),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
