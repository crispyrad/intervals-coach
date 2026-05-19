import type { PlannedWorkout } from "./types";

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
