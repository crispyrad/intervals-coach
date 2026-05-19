import { NextResponse } from "next/server";
import {
  athleteId,
  intervalsGet,
  isoDaysAgo,
  isoToday,
} from "@/lib/intervals";
import {
  normalizeActivities,
  normalizeProfile,
  normalizeWellness,
} from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const id = athleteId();

    const [profileRaw, activitiesRaw, wellnessRaw] = await Promise.all([
      intervalsGet(`/athlete/${id}`),
      intervalsGet(`/athlete/${id}/activities`, {
        oldest: isoDaysAgo(90),
        newest: isoToday(),
      }),
      intervalsGet(`/athlete/${id}/wellness`, {
        oldest: isoDaysAgo(42),
        newest: isoToday(),
      }),
    ]);

    return NextResponse.json({
      profile: normalizeProfile((profileRaw ?? {}) as Record<string, unknown>),
      activities: normalizeActivities(
        Array.isArray(activitiesRaw) ? activitiesRaw : []
      ),
      wellness: normalizeWellness(
        Array.isArray(wellnessRaw) ? wellnessRaw : []
      ),
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
