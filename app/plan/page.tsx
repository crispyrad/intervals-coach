"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedPlan, PushResult } from "@/lib/types";

const PLAN_KEY = "generatedPlan";

function isGeneratedPlan(v: unknown): v is GeneratedPlan {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as GeneratedPlan).weeks)
  );
}

export default function PlanPage() {
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the coach-generated plan from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLAN_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isGeneratedPlan(parsed)) setPlan(parsed);
      }
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
  }, []);

  async function push() {
    if (!plan) return;
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: plan.weeks }),
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

  function clearPlan() {
    try {
      localStorage.removeItem(PLAN_KEY);
    } catch {
      // ignore
    }
    setPlan(null);
    setResult(null);
    setError(null);
  }

  const isEmpty = !plan || plan.weeks.length === 0;

  if (loaded && isEmpty) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Plan Review</h1>
        <p className="text-sm text-slate-500">
          No plan yet —{" "}
          <Link href="/coach" className="font-medium text-blue-600 underline">
            go to the Coach page to build one
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!loaded || !plan) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Plan Review</h1>
        <p className="text-sm text-slate-500">Loading plan…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Plan Review</h1>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={push}
            disabled={pushing}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {pushing ? "Pushing…" : "Push to Intervals.icu"}
          </button>
          <button
            onClick={clearPlan}
            className="rounded border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Clear plan
          </button>
        </div>
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

      <div className="space-y-6">
        {plan.weeks.map((week, wi) => (
          <section key={week.weekNumber ?? wi}>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">
              Week {week.weekNumber ?? wi + 1}
              {week.phase ? ` — ${week.phase}` : ""}
              {week.totalHours ? ` · ${week.totalHours}h planned` : ""}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(week.workouts ?? []).map((w, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-slate-500">
                        {w.date} · {w.type}
                      </div>
                    </div>
                    {w.intensity && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white">
                        {w.intensity}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {w.durationMinutes
                      ? `${w.durationMinutes} min`
                      : "Duration —"}
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-700">
                    {w.description}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
