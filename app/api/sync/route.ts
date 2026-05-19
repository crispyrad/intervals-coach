import { NextResponse } from "next/server";
import {
  athleteId,
  intervalsGet,
  isoDaysAgo,
  isoToday,
} from "@/lib/intervals";
import type { Activity, AthleteProfile, Wellness } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const id = athleteId();

    const [profile, activities, wellness] = await Promise.all([
      intervalsGet(`/athlete/${id}`) as Promise<AthleteProfile>,
      intervalsGet(`/athlete/${id}/activities`, {
        oldest: isoDaysAgo(90),
        newest: isoToday(),
      }) as Promise<Activity[]>,
      intervalsGet(`/athlete/${id}/wellness`, {
        oldest: isoDaysAgo(30),
        newest: isoToday(),
      }) as Promise<Wellness[]>,
    ]);

    return NextResponse.json({
      profile,
      activities: Array.isArray(activities) ? activities : [],
      wellness: Array.isArray(wellness) ? wellness : [],
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
