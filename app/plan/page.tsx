"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatDuration } from "@/lib/format";
import type { PlannedWorkout, PushResult } from "@/lib/types";

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export default function PlanPage() {
  const { plan, setPlan } = useStore();
  const [editing, setEditing] = useState<number | null>(null);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const map = new Map<string, { index: number; w: PlannedWorkout }[]>();
    plan.forEach((w, index) => {
      const key = mondayOf(w.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ index, w });
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, items]) => ({
        weekStart,
        items: items.sort((a, b) => a.w.date.localeCompare(b.w.date)),
      }));
  }, [plan]);

  function update(index: number, patch: Partial<PlannedWorkout>) {
    setPlan(plan.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  function remove(index: number) {
    setPlan(plan.filter((_, i) => i !== index));
    setEditing(null);
  }

  async function push() {
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workouts: plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Push failed");
      setResult(json as PushResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  if (plan.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Plan Review</h1>
        <p className="text-sm text-slate-500">
          No plan yet. Ask the AI Coach to build a training plan, then click
          &ldquo;Review Plan&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plan Review</h1>
        <button
          onClick={push}
          disabled={pushing}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {pushing ? "Pushing…" : "Push to Intervals.icu"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">
            Pushed {result.pushed} workout{result.pushed === 1 ? "" : "s"} to
            Intervals.icu.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <a
            href="https://intervals.icu"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-medium underline"
          >
            Open Intervals.icu →
          </a>
        </div>
      )}

      <div className="space-y-5">
        {weeks.map((week) => (
          <section key={week.weekStart}>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">
              Week of {week.weekStart}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {week.items.map(({ index, w }) => (
                <div
                  key={index}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  {editing === index ? (
                    <div className="space-y-2">
                      <input
                        value={w.name}
                        onChange={(e) => update(index, { name: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        placeholder="Name"
                      />
                      <input
                        value={w.date}
                        onChange={(e) => update(index, { date: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        placeholder="YYYY-MM-DD"
                      />
                      <input
                        type="number"
                        value={w.planned_duration_seconds}
                        onChange={(e) =>
                          update(index, {
                            planned_duration_seconds:
                              Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        placeholder="Duration (seconds)"
                      />
                      <textarea
                        value={w.description}
                        onChange={(e) =>
                          update(index, { description: e.target.value })
                        }
                        rows={4}
                        className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                        placeholder="Workout steps"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                        >
                          Done
                        </button>
                        <button
                          onClick={() => remove(index)}
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{w.name}</div>
                          <div className="text-xs text-slate-500">
                            {w.date} · {w.type} ·{" "}
                            {formatDuration(w.planned_duration_seconds)}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditing(index)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(index)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-700">
                        {w.description}
                      </pre>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
