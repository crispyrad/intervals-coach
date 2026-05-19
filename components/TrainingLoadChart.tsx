"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Wellness } from "@/lib/types";

export default function TrainingLoadChart({
  wellness,
}: {
  wellness: Wellness[];
}) {
  const data = [...wellness]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(-42)
    .map((w) => ({
      date: w.id?.slice(5) ?? "",
      CTL: w.ctl != null ? Math.round(w.ctl) : null,
      ATL: w.atl != null ? Math.round(w.atl) : null,
      TSB: w.tsb != null ? Math.round(w.tsb) : null,
    }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No wellness data — sync to load CTL/ATL/TSB.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="CTL" stroke="#2563eb" dot={false} />
          <Line type="monotone" dataKey="ATL" stroke="#dc2626" dot={false} />
          <Line type="monotone" dataKey="TSB" stroke="#16a34a" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
