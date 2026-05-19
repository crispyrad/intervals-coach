import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AthleteData, ChatMessage, TargetEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-20250514";

function buildSystemPrompt(
  athleteData: AthleteData | null,
  targetEvents: TargetEvent[]
): string {
  const context = athleteData
    ? JSON.stringify(athleteData, null, 2)
    : "No athlete data has been synced yet.";

  const events =
    targetEvents.length > 0
      ? JSON.stringify(targetEvents, null, 2)
      : "No target events have been set.";

  return `You are an expert endurance sports coach. You coach cyclists, runners,
and triathletes using training-load principles (CTL = fitness, ATL = fatigue,
TSB = form). You give specific, actionable, periodised advice grounded in the
athlete's real data.

ATHLETE DATA (synced from Intervals.icu — profile, last 90 days of activities,
last 30 days of wellness):
${context}

Use this data in every answer: reference the athlete's FTP, current CTL/ATL/TSB
trend, recent training load, and wellness signals (HRV, resting HR, sleep) when
relevant.

TARGET EVENTS (goal races / key dates the athlete is training toward):
${events}

When target events are set, periodise training toward them: schedule build and
peak phases so the athlete arrives at each A-priority event fresh (positive TSB),
treat B events as tune-ups, and C events as training. Reference the named events
and their dates in your plans and advice.

WHEN THE ATHLETE ASKS FOR A TRAINING PLAN, output a fenced \`\`\`json code block
containing an array of workout objects. Each workout object MUST use this exact
schema:
{
  "date": "YYYY-MM-DD",
  "name": "string",
  "type": "Ride" | "Run" | "Swim" | "Workout" | etc,
  "description": "string — structured workout steps",
  "planned_duration_seconds": number,
  "category": "WORKOUT"
}

The "description" field MUST describe structured workouts using this line-based
format (one step per line, intervals in NxN parentheses), for example:
- 10m 40%-65% FTP
- 3x(10m 95-100% FTP, 5m 50% FTP)
- 10m Z1

Always include a short coaching explanation in prose BEFORE the json block.
Only emit the json block when a plan is actually requested.`;
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
    const messages = body.messages ?? [];
    const targetEvents = body.targetEvents ?? [];
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(body.athleteData ?? null, targetEvents),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
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
