"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { mergePlan, parsePlanBlock, planSummary } from "@/lib/plan";
import type { ChatMessage, GeneratedPlan, TargetEvent } from "@/lib/types";

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

/** Read the currently saved plan so the coach can revise / reassess it. */
function readCurrentPlan(): GeneratedPlan | null {
  try {
    const s = localStorage.getItem(PLAN_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && Array.isArray(parsed.weeks)) return parsed as GeneratedPlan;
    }
  } catch {
    // ignore
  }
  return null;
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
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [phase, setPhase] = useState("Base");
  const [blockWeeks, setBlockWeeks] = useState(3);
  const sending = useRef(false);

  const wellness = latestWellness(athleteData);
  const ftp = athleteData?.profile?.ftp;

  // Load chat history + detect an existing saved plan on mount.
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
    setHasPlan(readCurrentPlan() != null);
    setLoaded(true);
  }, []);

  // Persist chat history once loading settles (avoids a write per token).
  useEffect(() => {
    if (!loaded || loading) return;
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, loaded, loading]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || sending.current) return;

    sending.current = true;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setStreaming(false);
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
          currentPlan: readCurrentPlan(),
        }),
      });

      if (!res.ok || !res.body) {
        let msg = "Coach request failed";
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch {
          // non-JSON error body
        }
        throw new Error(msg);
      }

      // Stream the reply in token-by-token.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setStreaming(true);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
      acc += decoder.decode();
      setMessages([...next, { role: "assistant", content: acc }]);

      // Detect and persist a generated/revised plan.
      const found = parsePlanBlock(acc);
      if (found) {
        try {
          // Append/merge the new block into any existing saved plan.
          const merged = mergePlan(readCurrentPlan(), found.plan);
          localStorage.setItem(PLAN_KEY, JSON.stringify(merged));
          setHasPlan(true);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach request failed");
    } finally {
      setLoading(false);
      setStreaming(false);
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

  function buildBlock() {
    const event = nextTargetEvent(targetEvents);
    const { weeklyHours, preferredDays } = readPrefs();
    const ctl = wellness?.ctl != null ? Math.round(wellness.ctl) : "unknown";
    const tsb = wellness?.tsb != null ? Math.round(wellness.tsb) : "unknown";
    const ftpText = ftp != null ? `${ftp}W` : "unknown";
    const daysText =
      preferredDays.length > 0 ? preferredDays.join(", ") : "any day";

    const current = readCurrentPlan();
    const lastWeek = current
      ? current.weeks.reduce((m, w) => Math.max(m, w.weekNumber ?? 0), 0)
      : 0;

    const continuation =
      lastWeek > 0
        ? `I already have weeks 1-${lastWeek} saved. Continue week numbering from week ${
            lastWeek + 1
          } and continue workout dates from the day after the last saved workout. Output ONLY the new ${blockWeeks}-week block.`
        : `This is the first block — start at week 1 from today.`;

    const eventLine = event
      ? `- Next target event: ${event.name} on ${event.date} (${event.type}, Priority ${event.priority})`
      : `- No target event set yet`;

    const message = `Please generate the next training block.
- Phase: ${phase}
- Block length: ${blockWeeks} weeks
- Loading pattern: 2 weeks load + 1 week recovery (masters athlete, age 49)
- Weekly hours available: ${weeklyHours}
- Preferred training days: ${daysText}
${eventLine}
- Current fitness: CTL ${ctl}, TSB ${tsb}, FTP ${ftpText}

${continuation}

Follow the masters periodization guidance for the ${phase} phase. Output the block as a \`\`\`plan JSON block.`;

    send(message);
  }

  function reassessPrompt() {
    send(
      `Please reassess my current training plan. Compare what I've actually ` +
        `done recently (training load, CTL/ATL/TSB) against the plan, tell me ` +
        `whether I'm ahead, on track, or behind, and recommend any changes. ` +
        `If the plan should change, output the full updated plan.`
    );
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
          {loading && !streaming && (
            <div className="text-sm text-slate-500">Coach is thinking…</div>
          )}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-semibold text-slate-700">
            Build a training block
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-slate-500">
              Periodization phase
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
              >
                <option>Base</option>
                <option>Build 1</option>
                <option>Build 2</option>
                <option>Peak</option>
                <option>Transition</option>
              </select>
            </label>
            <label className="flex flex-col text-xs text-slate-500">
              Block length
              <select
                value={blockWeeks}
                onChange={(e) => setBlockWeeks(Number(e.target.value))}
                className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
              >
                <option value={3}>3 weeks (2 load + 1 recovery)</option>
                <option value={4}>4 weeks (3 load + 1 recovery)</option>
              </select>
            </label>
            <button
              onClick={buildBlock}
              disabled={loading}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {hasPlan ? "Build next block" : "Build first block"}
            </button>
            {hasPlan && (
              <button
                onClick={reassessPrompt}
                disabled={loading}
                className="rounded border border-slate-400 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Reassess my plan
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Generates one short block at a time (free-tier friendly). Each block
            is appended to your saved plan — build Base, then Build 1, and so
            on.
          </p>
        </div>

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
            placeholder="Message your coach… (e.g. “change week 3 to lower volume”)"
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
