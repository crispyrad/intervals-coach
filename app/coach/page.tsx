"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { parsePlanBlock, planSummary } from "@/lib/plan";
import type { ChatMessage, TargetEvent } from "@/lib/types";

const CHAT_KEY = "coach-chat-history";
const PLAN_KEY = "generatedPlan";

function latestWellness(data: ReturnType<typeof useStore>["athleteData"]) {
  if (!data || data.wellness.length === 0) return null;
  return [...data.wellness].sort((a, b) => b.id.localeCompare(a.id))[0];
}

/** Read training preferences saved by the Dashboard. */
function readPrefs(): { weeklyHours: number; preferredDays: string[] } {
  let weeklyHours = 8;
  let preferredDays: string[] = [];
  try {
    const h = localStorage.getItem("weeklyHours");
    if (h != null && !Number.isNaN(Number(h))) weeklyHours = Number(h);
    const d = localStorage.getItem("preferredDays");
    if (d) {
      const parsed = JSON.parse(d);
      if (Array.isArray(parsed)) preferredDays = parsed;
    }
  } catch {
    // ignore
  }
  return { weeklyHours, preferredDays };
}

/** Soonest upcoming target event, falling back to the earliest overall. */
function nextTargetEvent(events: TargetEvent[]): TargetEvent | null {
  if (events.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((e) => e.date >= today) ?? sorted[0];
}

export default function CoachPage() {
  const { athleteData, targetEvents } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const sending = useRef(false);

  const wellness = latestWellness(athleteData);
  const ftp = athleteData?.profile?.ftp;

  // Load chat history from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
  }, []);

  // Persist chat history whenever it changes (after the initial load).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, loaded]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || sending.current) return;

    sending.current = true;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const { weeklyHours, preferredDays } = readPrefs();
      const mergedAthleteData = athleteData
        ? { ...athleteData, weeklyHours, preferredDays }
        : null;

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Trim to the last 20 messages to stay within token limits.
          messages: next.slice(-20),
          athleteData: mergedAthleteData,
          targetEvents,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Coach request failed");

      const reply: string = json.reply;
      setMessages([...next, { role: "assistant", content: reply }]);

      // Detect and persist a generated plan.
      const found = parsePlanBlock(reply);
      if (found) {
        try {
          localStorage.setItem(PLAN_KEY, JSON.stringify(found.plan));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach request failed");
    } finally {
      setLoading(false);
      sending.current = false;
    }
  }

  function clearChat() {
    setMessages([]);
    try {
      localStorage.removeItem(CHAT_KEY);
    } catch {
      // ignore
    }
  }

  function buildPlanPrompt() {
    const event = nextTargetEvent(targetEvents);
    if (!event) return;
    const { weeklyHours, preferredDays } = readPrefs();
    const ctl = wellness?.ctl != null ? Math.round(wellness.ctl) : "unknown";
    const tsb = wellness?.tsb != null ? Math.round(wellness.tsb) : "unknown";
    const ftpText = ftp != null ? `${ftp}W` : "unknown";
    const daysText =
      preferredDays.length > 0 ? preferredDays.join(", ") : "any day";

    const message = `Please build me a training plan. Here's my situation:
- Available training time: ${weeklyHours} hours per week
- Preferred days: ${daysText}
- Next target event: ${event.name} on ${event.date} (${event.type}, Priority ${event.priority})
- Current fitness: CTL ${ctl}, TSB ${tsb}, FTP ${ftpText}

Please create a periodized plan from today to the event with a 2-week taper.`;

    send(message);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AI Coach</h1>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Clear chat
            </button>
          )}
        </div>

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
          {messages.map((m, i) => {
            const found =
              m.role === "assistant" ? parsePlanBlock(m.content) : null;
            const text = found
              ? m.content.replace(found.raw, planSummary(found.plan)).trim()
              : m.content;
            return (
              <div key={i}>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                      : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
                  }
                >
                  <div className="mb-1 text-xs font-semibold opacity-70">
                    {m.role === "user" ? "You" : "Coach"}
                  </div>
                  <div className="whitespace-pre-wrap">{text}</div>
                </div>
                {found && (
                  <Link
                    href="/plan"
                    className="mt-2 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700"
                  >
                    Review &amp; push plan →
                  </Link>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="text-sm text-slate-500">Coach is thinking…</div>
          )}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {targetEvents.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Add a target event on the Dashboard before building a plan.
          </div>
        ) : (
          <button
            onClick={buildPlanPrompt}
            disabled={loading}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Build my training plan
          </button>
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
            onClick={() => send()}
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

        <h2 className="pt-2 text-sm font-semibold text-slate-500">
          Target events
        </h2>
        {targetEvents.length === 0 ? (
          <p className="text-xs text-slate-400">
            None — add some on the Dashboard.
          </p>
        ) : (
          <ul className="space-y-1">
            {targetEvents.map((e) => (
              <li key={e.id} className="text-xs">
                <span className="font-semibold">{e.priority}</span> {e.name}
                <span className="block text-slate-400">{e.date}</span>
              </li>
            ))}
          </ul>
        )}
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
