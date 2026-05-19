import { NextRequest, NextResponse } from "next/server";
import { athleteId, intervalsPost } from "@/lib/intervals";
import type { PlannedWorkout, PushResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const id = athleteId();
    const body = (await req.json()) as { workouts?: PlannedWorkout[] };
    const workouts = body.workouts ?? [];

    if (workouts.length === 0) {
      return NextResponse.json(
        { error: "workouts array is required" },
        { status: 400 }
      );
    }

    const result: PushResult = { pushed: 0, errors: [] };

    for (const w of workouts) {
      try {
        await intervalsPost(`/athlete/${id}/events`, {
          start_date_local: `${w.date}T00:00:00`,
          name: w.name,
          description: w.description,
          type: w.type,
          planned_duration: w.planned_duration_seconds,
          category: w.category || "WORKOUT",
        });
        result.pushed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(`${w.date} ${w.name}: ${message}`);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
