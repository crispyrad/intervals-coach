"use client";

import { useState } from "react";
import TrainingLoadChart from "@/components/TrainingLoadChart";
import TargetEvents from "@/components/TargetEvents";
import TrainingPreferences from "@/components/TrainingPreferences";
import { useStore } from "@/lib/store";
import { formatDate, formatDuration } from "@/lib/format";
import type { AthleteData } from "@/lib/types";

export default function DashboardPage() {
  const { athleteData, setAthleteData } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sync");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setAthleteData(json as AthleteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  const recent = athleteData
    ? [...athleteData.activities]
        .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
        .slice(0, 7)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {athleteData && (
            <span className="text-xs text-slate-500">
              Synced {new Date(athleteData.syncedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={sync}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!athleteData && !error && (
        <p className="text-sm text-slate-500">
          Click Sync to pull your latest data from Intervals.icu.
        </p>
      )}

      <TargetEvents />

      <TrainingPreferences />

      {athleteData && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">
              Training Load — last 42 days
            </h2>
            <TrainingLoadChart wellness={athleteData.wellness} />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Last 7 activities</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Load</th>
                    <th className="py-2 pr-4">Avg W</th>
                    <th className="py-2 pr-4">RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((a, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-4">
                        {formatDate(a.start_date_local)}
                      </td>
                      <td className="py-2 pr-4">{a.name}</td>
                      <td className="py-2 pr-4">{a.type}</td>
                      <td className="py-2 pr-4">
                        {formatDuration(a.moving_time)}
                      </td>
                      <td className="py-2 pr-4">
                        {a.icu_training_load ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {a.icu_weighted_avg_watts || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {a.perceived_exertion ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-3 text-slate-500">
                        No activities in the last 90 days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
