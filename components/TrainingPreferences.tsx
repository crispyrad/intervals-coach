"use client";

import { useEffect, useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_HOURS = 8;

export default function TrainingPreferences() {
  const [hours, setHours] = useState<number>(DEFAULT_HOURS);
  const [days, setDays] = useState<string[]>(DAYS);
  const [loaded, setLoaded] = useState(false);

  // Load saved preferences from localStorage on mount.
  useEffect(() => {
    try {
      const h = localStorage.getItem("weeklyHours");
      if (h != null && !Number.isNaN(Number(h))) setHours(Number(h));
      const d = localStorage.getItem("preferredDays");
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed)) setDays(parsed);
      }
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
  }, []);

  function updateHours(value: number) {
    const clamped = Math.min(20, Math.max(1, value || DEFAULT_HOURS));
    setHours(clamped);
    try {
      localStorage.setItem("weeklyHours", String(clamped));
    } catch {
      // ignore
    }
  }

  function toggleDay(day: string) {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    const ordered = DAYS.filter((d) => next.includes(d));
    setDays(ordered);
    try {
      localStorage.setItem("preferredDays", JSON.stringify(ordered));
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-lg font-semibold">Training preferences</h2>
      <p className="mb-3 text-xs text-slate-500">
        Used by the AI coach to size your plan. Stored on this device only —
        never sent to Intervals.icu.
      </p>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex flex-col text-xs text-slate-500">
          Hours available per week
          <input
            type="number"
            min={1}
            max={20}
            value={loaded ? hours : DEFAULT_HOURS}
            onChange={(e) => updateHours(Number(e.target.value))}
            className="mt-1 w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>

        <div className="text-xs text-slate-500">
          Preferred training days
          <div className="mt-1 flex flex-wrap gap-3">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1 text-slate-900">
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={() => toggleDay(day)}
                />
                {day}
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
