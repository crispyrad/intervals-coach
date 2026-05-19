import type { Activity, AthleteProfile, Wellness } from "./types";

type Raw = Record<string, unknown>;

function num(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** FTP is stored per-sport in athlete.sportSettings, not at the top level. */
function resolveFtp(raw: Raw): number | undefined {
  const top = num(raw.ftp);
  if (top && top > 0) return top;

  const settings = raw.sportSettings;
  if (Array.isArray(settings)) {
    const isRide = (s: Raw) =>
      Array.isArray(s.types) &&
      (s.types as unknown[]).some((t) => /ride|bike|cycl/i.test(String(t)));

    const ride = settings.find(
      (s: Raw) => isRide(s) && num(s.ftp) && (num(s.ftp) as number) > 0
    );
    if (ride) return num((ride as Raw).ftp);

    const any = settings.find(
      (s: Raw) => num(s.ftp) && (num(s.ftp) as number) > 0
    );
    if (any) return num((any as Raw).ftp);
  }
  return undefined;
}

export function normalizeProfile(raw: Raw): AthleteProfile {
  return {
    ...raw,
    id: String(raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : undefined,
    ftp: resolveFtp(raw),
    weight: num(raw.weight) ?? num(raw.icu_weight),
  };
}

export function normalizeWellness(raw: unknown[]): Wellness[] {
  return raw.map((item) => {
    const w = (item ?? {}) as Raw;
    const ctl = num(w.ctl) ?? num(w.icu_ctl);
    const atl = num(w.atl) ?? num(w.icu_atl);
    const tsb =
      num(w.tsb) ??
      (ctl != null && atl != null ? round1(ctl - atl) : undefined);
    return {
      id: String(w.id ?? ""),
      ctl,
      atl,
      tsb,
      restingHR: num(w.restingHR),
      hrv: num(w.hrv),
      sleepScore: num(w.sleepScore),
    };
  });
}

export function normalizeActivities(raw: unknown[]): Activity[] {
  return raw.map((item) => {
    const a = (item ?? {}) as Raw;
    return {
      name: typeof a.name === "string" ? a.name : "",
      type: typeof a.type === "string" ? a.type : "",
      start_date_local:
        typeof a.start_date_local === "string" ? a.start_date_local : "",
      moving_time: num(a.moving_time) ?? 0,
      icu_training_load: num(a.icu_training_load) ?? 0,
      icu_atl: num(a.icu_atl) ?? 0,
      icu_ctl: num(a.icu_ctl) ?? 0,
      icu_weighted_avg_watts: num(a.icu_weighted_avg_watts) ?? 0,
      icu_zone_times: a.icu_zone_times,
      perceived_exertion: num(a.icu_rpe) ?? num(a.perceived_exertion),
    };
  });
}
