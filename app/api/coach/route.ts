import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AthleteData,
  ChatMessage,
  TargetEvent,
  Wellness,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-20250514";
const MAX_MESSAGES = 20;

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

function buildSystemPrompt(athleteData: CoachContext): string {
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

## How to coach
- Always reference the athlete's actual CTL, TSB, and days until their next priority A event
- When building a plan, identify the next Priority A event and work backwards
- Use 3-weeks-load + 1-week-recovery periodization blocks
- Do not prescribe a CTL ramp of more than 5 points per week
- Include a 2-week taper before any A event
- Determine training phase automatically: base (>16 weeks out), build (8–16 weeks), peak (4–8 weeks), taper (<4 weeks)
- Ask for weekly hours only if not already provided

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

Only schedule workouts on the athlete's preferred training days. Do not output the plan JSON unless the athlete explicitly asks for a plan.`;
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
    };
    const messages = (body.messages ?? []).slice(-MAX_MESSAGES);
    const targetEvents = body.targetEvents ?? [];
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

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(context),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    return NextResponse.json({ reply: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
