import { NextRequest, NextResponse } from "next/server";
import { athleteId, intervalsPost } from "@/lib/intervals";
import type {
  GeneratedPlan,
  PlannedWorkout,
  PlanWorkout,
  PushResult,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/** Normalised Intervals.icu event POST body. */
interface EventPayload {
  start_date_local: string;
  name: string;
  description: string;
  type: string;
  planned_duration: number; // seconds
  category: string;
}

/** Old flat PlannedWorkout schema → event payload. */
function fromFlat(w: PlannedWorkout): EventPayload {
  return {
    start_date_local: `${w.date}T00:00:00`,
    name: w.name,
    description: w.description,
    type: w.type,
    planned_duration: w.planned_duration_seconds,
    category: w.category || "WORKOUT",
  };
}

/** New nested generatedPlan workout schema → event payload. */
function fromNested(w: PlanWorkout): EventPayload {
  return {
    start_date_local: `${w.date}T00:00:00`,
    name: w.name,
    description: w.description,
    type: w.type,
    // Intervals.icu expects seconds; the new schema stores minutes.
    planned_duration: (w.durationMinutes || 0) * 60,
    category: "WORKOUT",
  };
}

export async function POST(req: NextRequest) {
  try {
    const id = athleteId();
    const body = (await req.json()) as {
      workouts?: PlannedWorkout[];
      weeks?: GeneratedPlan["weeks"];
      plan?: GeneratedPlan;
    };

    // Detect which schema was sent and flatten to a single event list.
    const weeks = body.weeks ?? body.plan?.weeks;
    let events: EventPayload[];
    if (Array.isArray(weeks)) {
      events = weeks.flatMap((wk) => (wk.workouts ?? []).map(fromNested));
    } else if (Array.isArray(body.workouts)) {
      events = body.workouts.map(fromFlat);
    } else {
      events = [];
    }

    if (events.length === 0) {
      return NextResponse.json(
        { error: "No workouts to push" },
        { status: 400 }
      );
    }

    const result: PushResult = { pushed: 0, errors: [] };

    for (const ev of events) {
      try {
        await intervalsPost(`/athlete/${id}/events`, ev);
        result.pushed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(
          `${ev.start_date_local.slice(0, 10)} ${ev.name}: ${message}`
        );
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
