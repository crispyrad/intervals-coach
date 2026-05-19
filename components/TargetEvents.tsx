"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { TargetEvent } from "@/lib/types";

function daysUntil(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (Number.isNaN(diff)) return "";
  if (diff === 0) return "today";
  if (diff < 0) return `${-diff}d ago`;
  return `in ${diff}d`;
}

const PRIORITIES: TargetEvent["priority"][] = ["A", "B", "C"];

export default function TargetEvents() {
  const { targetEvents, setTargetEvents } = useStore();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Race");
  const [priority, setPriority] = useState<TargetEvent["priority"]>("A");

  function add() {
    if (!date || !name.trim()) return;
    const event: TargetEvent = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      date,
      name: name.trim(),
      type: type.trim() || "Race",
      priority,
    };
    setTargetEvents(
      [...targetEvents, event].sort((a, b) => a.date.localeCompare(b.date))
    );
    setDate("");
    setName("");
  }

  function remove(id: string) {
    setTargetEvents(targetEvents.filter((e) => e.id !== id));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-lg font-semibold">Target events</h2>
      <p className="mb-3 text-xs text-slate-500">
        Add goal races and key dates — the AI coach plans training around them.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-500">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Etape du Tour"
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Type
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Race"
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Priority
          <select
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as TargetEvent["priority"])
            }
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={add}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>

      {targetEvents.length > 0 && (
        <ul className="mt-3 space-y-1">
          {targetEvents.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span>
                <span className="mr-2 inline-block rounded bg-slate-800 px-1.5 text-xs font-bold text-white">
                  {e.priority}
                </span>
                <span className="font-medium">{e.name}</span>
                <span className="ml-2 text-slate-500">
                  {e.type} · {e.date} · {daysUntil(e.date)}
                </span>
              </span>
              <button
                onClick={() => remove(e.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
