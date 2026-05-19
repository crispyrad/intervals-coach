"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { extractPlan } from "@/lib/plan";
import type { ChatMessage } from "@/lib/types";

function latestWellness(data: ReturnType<typeof useStore>["athleteData"]) {
  if (!data || data.wellness.length === 0) return null;
  return [...data.wellness].sort((a, b) => b.id.localeCompare(a.id))[0];
}

export default function CoachPage() {
  const { athleteData, setPlan } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planReady, setPlanReady] = useState(false);

  const wellness = latestWellness(athleteData);
  const ftp = athleteData?.profile?.ftp;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, athleteData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Coach request failed");

      const reply: string = json.reply;
      setMessages([...next, { role: "assistant", content: reply }]);

      const plan = extractPlan(reply);
      if (plan) {
        setPlan(plan);
        setPlanReady(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">AI Coach</h1>

        {!athleteData && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No data synced yet — the coach works best after you sync on the
            Dashboard.
          </div>
        )}

        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">
              Ask for advice or a training plan, e.g. &ldquo;Build me a 4-week
              FTP block.&rdquo;
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                  : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
              }
            >
              <div className="mb-1 text-xs font-semibold opacity-70">
                {m.role === "user" ? "You" : "Coach"}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="text-sm text-slate-500">Coach is thinking…</div>
          )}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {planReady && (
          <Link
            href="/plan"
            className="inline-block rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Review Plan →
          </Link>
        )}

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Message your coach…"
            className="flex-1 resize-none rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <aside className="h-fit space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-500">Current status</h2>
        <Stat label="FTP" value={ftp != null ? `${ftp} W` : "—"} />
        <Stat
          label="CTL"
          value={wellness?.ctl != null ? Math.round(wellness.ctl) : "—"}
        />
        <Stat
          label="ATL"
          value={wellness?.atl != null ? Math.round(wellness.atl) : "—"}
        />
        <Stat
          label="TSB"
          value={wellness?.tsb != null ? Math.round(wellness.tsb) : "—"}
        />
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}
