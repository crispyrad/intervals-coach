const BASE = "https://intervals.icu/api/v1";

function authHeader(): string {
  const key = process.env.INTERVALS_API_KEY;
  if (!key) throw new Error("INTERVALS_API_KEY is not set");
  const token = Buffer.from(`API_KEY:${key}`).toString("base64");
  return `Basic ${token}`;
}

export function athleteId(): string {
  const id = process.env.INTERVALS_ATHLETE_ID;
  if (!id) throw new Error("INTERVALS_ATHLETE_ID is not set");
  return id;
}

export async function intervalsGet(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Intervals.icu GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function intervalsPost(
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Intervals.icu POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
