import { Activity, Clock3, Gauge, HeartPulse } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { average, chartMargin, latest } from "../utils/data";
import { pace, paceMinutes, percent, shortDate } from "../utils/format";

export function Zone2({ data }: { data: DashboardData }) {
  const rows = data.runs
    .filter((run) => run.z2_percent != null || run.pace_sec_per_km != null || run.drift_bpm != null)
    .slice(-20)
    .map((run) => ({
      date: shortDate(run.run_date),
      z2: run.z2_percent ?? null,
      pace: paceMinutes(run.pace_sec_per_km),
      drift: run.drift_bpm ?? null,
      decoupling: run.decoupling_percent ?? null,
    }));
  const latestRun = latest(data.runs, "run_date");
  const avgDrift = average(data.runs.map((run) => run.drift_bpm));
  const avgZ2 = average(data.runs.map((run) => run.z2_percent));
  const driftTone: "neutral" | "good" | "warn" | "hot" =
    avgDrift == null ? "neutral" : avgDrift <= 5 ? "good" : avgDrift <= 8 ? "warn" : "hot";

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="เป้าหมายระยะยาว" value="7:00/km" detail="Zone 2 pace" icon={Gauge} tone="hot" />
        <MetricCard label="Z2 ล่าสุด" value={percent(latestRun?.z2_percent)} detail={latestRun?.run_date} icon={HeartPulse} tone={latestRun?.z2_percent != null && latestRun.z2_percent >= 80 ? "good" : "neutral"} />
        <MetricCard label="Pace ล่าสุด" value={pace(latestRun?.pace_sec_per_km)} detail={latestRun?.session_type ?? undefined} icon={Clock3} />
        <MetricCard label="Drift เฉลี่ย" value={avgDrift == null ? "-" : `${avgDrift.toFixed(1)} bpm`} detail={`เป้าหมาย ≤ 5 bpm · Z2 เฉลี่ย ${avgZ2 == null ? "-" : percent(avgZ2)}`} icon={Activity} tone={driftTone} />
      </div>

      <div className="content-grid">
        <Panel title="Z2 stability" subtitle="Z2 %, drift และ decoupling — เส้นประคือเป้าหมาย" className="span-12">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={80} stroke="#2a7f62" strokeDasharray="4 4" label={{ value: "Z2 80%", position: "insideTopLeft", fontSize: 11, fill: "#2a7f62" }} />
              <ReferenceLine y={5} stroke="#cf244f" strokeDasharray="4 4" label={{ value: "drift 5", position: "insideBottomLeft", fontSize: 11, fill: "#cf244f" }} />
              <Line dataKey="z2" stroke="#2a7f62" strokeWidth={2.5} dot={{ r: 3 }} name="Z2 %" />
              <Line dataKey="drift" stroke="#cf244f" strokeWidth={2} dot={false} name="Drift bpm" />
              <Line dataKey="decoupling" stroke="#695d46" strokeWidth={2} dot={false} name="Decoupling %" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Pace trend" subtitle="ค่า pace ยิ่งต่ำยิ่งเร็ว · เป้า 7:00/km" className="span-12">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis reversed domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} min/km`, "Pace"]} />
              <ReferenceLine y={7} stroke="#cf244f" strokeDasharray="5 5" label={{ value: "เป้า 7:00", position: "insideTopRight", fontSize: 11, fill: "#cf244f" }} />
              <Area dataKey="pace" stroke="#2a7f62" fill="#d8eee5" strokeWidth={2.5} name="Pace min/km" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}
