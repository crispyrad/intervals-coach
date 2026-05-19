import type { GeneratedPlan, PlannedWorkout, PlanWeek } from "./types";

/**
 * Merge a newly generated block into the existing plan, keyed by weekNumber.
 * New weeks with a matching weekNumber replace the old ones; the rest are
 * appended. Used so the plan can be built up one block at a time.
 */
export function mergePlan(
  existing: GeneratedPlan | null,
  incoming: GeneratedPlan
): GeneratedPlan {
  const byNumber = new Map<number, PlanWeek>();
  for (const w of existing?.weeks ?? []) byNumber.set(w.weekNumber, w);
  for (const w of incoming.weeks) byNumber.set(w.weekNumber, w);
  const weeks = [...byNumber.values()].sort(
    (a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
  );
  return { weeks };
}

/**
 * Detect a ```plan fenced block in an assistant reply and parse the
 * periodized plan JSON inside it.
 */
export function parsePlanBlock(
  content: string
): { plan: GeneratedPlan; raw: string } | null {
  // Prefer a properly closed ```plan ... ``` block.
  let raw: string | null = null;
  let jsonText: string | null = null;

  const closed = content.match(/```plan\s*([\s\S]*?)```/i);
  if (closed) {
    raw = closed[0];
    jsonText = closed[1];
  } else {
    // Fall back: an unclosed block (model omitted the closing fence).
    const open = content.match(/```plan\s*([\s\S]*)$/i);
    if (open) {
      raw = open[0];
      jsonText = open[1];
    }
  }

  if (raw == null || jsonText == null) return null;

  try {
    const parsed = JSON.parse(jsonText.trim()) as GeneratedPlan;
    if (parsed && Array.isArray(parsed.weeks) && parsed.weeks.length > 0) {
      return { plan: parsed, raw };
    }
  } catch {
    // truncated or invalid JSON — ignore
  }
  return null;
}

/** Earliest workout date across all weeks of a generated plan. */
export function planStartDate(plan: GeneratedPlan): string {
  const dates = plan.weeks
    .flatMap((w) => w.workouts ?? [])
    .map((w) => w.date)
    .filter(Boolean)
    .sort();
  return dates[0] ?? "—";
}

/** Short human summary used in place of the raw plan JSON. */
export function planSummary(plan: GeneratedPlan): string {
  return `Plan generated: ${plan.weeks.length} weeks, starting ${planStartDate(
    plan
  )}`;
}

function isWorkout(v: unknown): v is PlannedWorkout {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    typeof o.name === "string" &&
    typeof o.description === "string"
  );
}

/**
 * Pull a training plan out of an assistant reply. Looks for a ```json fenced
 * block first, then falls back to a bare JSON array.
 */
export function extractPlan(reply: string): PlannedWorkout[] | null {
  const candidates: string[] = [];

  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/gi);
  if (fenced) {
    for (const block of fenced) {
      candidates.push(block.replace(/```(?:json)?/gi, "").replace(/```/g, ""));
    }
  }

  const bareArray = reply.match(/\[\s*{[\s\S]*}\s*\]/);
  if (bareArray) candidates.push(bareArray[0]);

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw.trim());
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { workouts?: unknown }).workouts)
          ? (parsed as { workouts: unknown[] }).workouts
          : null;
      if (arr && arr.length > 0 && arr.every(isWorkout)) {
        return arr.map((w) => {
          const o = w as Partial<PlannedWorkout> & {
            date: string;
            name: string;
            description: string;
          };
          return {
            date: o.date,
            name: o.name,
            description: o.description,
            type: o.type ?? "Workout",
            category: o.category ?? "WORKOUT",
            planned_duration_seconds: o.planned_duration_seconds ?? 0,
          };
        });
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}
