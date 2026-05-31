import { Activity, CheckCircle2, HeartPulse, Moon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { average, chartMargin, latest } from "../utils/data";
import { km, minutes, pace, percent, shortDate } from "../utils/format";

export function Today({ data }: { data: DashboardData }) {
  const today = latest(data.daily, "log_date");
  const lastRun = latest(data.runs, "run_date");
  const recentRuns = data.runs.slice(-8);
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const avgZ2 = average(data.runs.map((run) => run.z2_percent));
  const chartRows = recentRuns.map((run) => ({
    date: shortDate(run.run_date),
    distance: run.distance_km ?? 0,
    z2: run.z2_percent ?? null,
  }));

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="Readiness" value={today?.readiness_status ?? "-"} detail={today?.log_date} icon={CheckCircle2} tone="good" />
        <MetricCard label="Recovery" value={today?.recovery_percent == null ? "-" : `${today.recovery_percent}%`} detail="COROS recovery" icon={HeartPulse} />
        <MetricCard label="Sleep" value={today?.sleep_minutes == null ? "-" : minutes(today.sleep_minutes)} detail={today?.sleep_score == null ? undefined : `score ${today.sleep_score}`} icon={Moon} />
        <MetricCard label="ระยะรวม" value={km(totalDistance)} detail={`เฉลี่ย Z2 ${percent(avgZ2)}`} icon={Activity} />
      </div>

      <div className="content-grid">
        <Panel title="แผนล่าสุด" subtitle="คำแนะนำจาก daily readiness" className="span-7">
          <div className="coach-card">
            <strong>{today?.planned_session ?? "-"}</strong>
            <p>{today?.recommendation ?? "-"}</p>
            <div className="chip-row">
              <span>รองเท้า: {today?.recommended_shoe ?? "-"}</span>
              <span>Load ratio: {today?.load_ratio?.toFixed(2) ?? "-"}</span>
              <span>RHR: {today?.resting_hr_bpm ?? "-"} bpm</span>
            </div>
          </div>
        </Panel>

        <Panel title="วิ่งล่าสุด" subtitle={lastRun?.run_date ?? "ยังไม่มี run log"} className="span-5">
          <div className="latest-run">
            <strong>{lastRun?.session_type ?? "-"}</strong>
            <div className="mini-metrics">
              <span>{km(lastRun?.distance_km)}</span>
              <span>{pace(lastRun?.pace_sec_per_km)}</span>
              <span>Z2 {percent(lastRun?.z2_percent)}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Progress snapshot" subtitle="ระยะและ Z2 จาก run logs ล่าสุด" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="distance" fill="#2a7f62" radius={[6, 6, 0, 0]} name="ระยะ km" />
              <Line yAxisId="right" dataKey="z2" stroke="#d63f5f" strokeWidth={2.5} dot={{ r: 3 }} name="Z2 %" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}
