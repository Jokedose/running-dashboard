import { Activity, Brain, HeartPulse, Moon } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { CoreFeatures } from "../components/CoreFeatures";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { average, latest } from "../utils/data";
import { km, minutes, pace, percent, shortDate } from "../utils/format";

function readinessTone(status: string | null): "neutral" | "good" | "warn" | "hot" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("green") || s.includes("เขียว") || s.includes("ดี")) return "good";
  if (s.includes("yellow") || s.includes("เหลือง") || s.includes("ระวัง")) return "warn";
  if (s.includes("red") || s.includes("แดง") || s.includes("พัก")) return "hot";
  return "neutral";
}

export function Today({ data }: { data: DashboardData }) {
  const today = latest(data.daily, "log_date");
  const lastRun = latest(data.runs, "run_date");
  const recentRuns = data.runs.slice(-8);
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const avgZ2 = average(data.runs.map((run) => run.z2_percent));
  const tone = readinessTone(today?.readiness_status ?? null);

  const latestHrv = today?.hrv_avg_ms;
  const avgHrv7 = average(data.daily.slice(-8, -1).map((d) => d.hrv_avg_ms));
  const hrvTone: "neutral" | "good" | "warn" =
    latestHrv == null ? "neutral" : latestHrv >= (avgHrv7 ?? latestHrv) * 0.95 ? "good" : "warn";

  const recentDaily = data.daily.slice(-14).map((d) => ({
    date: shortDate(d.log_date),
    hrv: d.hrv_avg_ms ?? null,
    sleepHours: d.sleep_minutes == null ? null : Math.round(d.sleep_minutes / 6) / 10,
  }));

  const chartRows = recentRuns.map((run) => ({
    date: shortDate(run.run_date),
    distance: run.distance_km ?? 0,
    z2: run.z2_percent ?? null,
  }));

  return (
    <section className="page-stack">
      <div className={`readiness-hero ${tone}`}>
        <span className="readiness-status-badge">{today?.readiness_status ?? "ไม่มีข้อมูล"}</span>
        <p className="readiness-session">{today?.planned_session ?? "ยังไม่มีแผนวันนี้"}</p>
        <p className="readiness-rec">{today?.recommendation ?? "-"}</p>
        <div className="chip-row">
          <span>รองเท้า: {today?.recommended_shoe ?? "-"}</span>
          <span>Load: {today?.load_ratio?.toFixed(2) ?? "-"}</span>
          <span>RHR: {today?.resting_hr_bpm ?? "-"} bpm</span>
          {today?.tags?.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Recovery"
          value={today?.recovery_percent == null ? "-" : `${today.recovery_percent}%`}
          detail="COROS recovery"
          icon={HeartPulse}
        />
        <MetricCard
          label="Sleep"
          value={today?.sleep_minutes == null ? "-" : minutes(today.sleep_minutes)}
          detail={today?.sleep_score == null ? undefined : `score ${today.sleep_score}`}
          icon={Moon}
        />
        <MetricCard
          label="HRV"
          value={latestHrv == null ? "-" : `${latestHrv} ms`}
          detail={avgHrv7 == null ? undefined : `เฉลี่ย 7 วัน: ${avgHrv7.toFixed(0)} ms`}
          icon={Brain}
          tone={hrvTone}
        />
        <MetricCard
          label="ระยะรวม"
          value={km(totalDistance)}
          detail={`เฉลี่ย Z2 ${percent(avgZ2)}`}
          icon={Activity}
        />
      </div>

      <div className="content-grid">
        <Panel title="วิ่งล่าสุด" subtitle={lastRun?.run_date ?? "ยังไม่มี run log"} className="span-5">
          <div className="latest-run">
            <strong>{lastRun?.session_type ?? "-"}</strong>
            <div className="mini-metrics">
              <span>{km(lastRun?.distance_km)}</span>
              <span>{pace(lastRun?.pace_sec_per_km)}</span>
              <span>Z2 {percent(lastRun?.z2_percent)}</span>
              {lastRun?.avg_hr_bpm != null && <span>HR {lastRun.avg_hr_bpm} bpm</span>}
            </div>
            {lastRun?.note && <p className="run-note">{lastRun.note}</p>}
          </div>
        </Panel>

        <Panel title="HRV · Sleep (14 วัน)" subtitle="HRV ms (เส้น) · ชั่วโมงนอน (แท่ง)" className="span-7">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={recentDaily} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 12]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="right" dataKey="sleepHours" fill="url(#sleepBar)" radius={[6, 6, 0, 0]} name="นอน (ชม.)" />
              <Line
                yAxisId="left"
                dataKey="hrv"
                stroke={chartColors.primary}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="HRV ms"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Progress snapshot" subtitle="ระยะและ Z2 จาก run logs ล่าสุด" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="distance" fill="url(#primaryBar)" radius={[8, 8, 0, 0]} name="ระยะ km" />
              <Line
                yAxisId="right"
                dataKey="z2"
                stroke={chartColors.accent}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.accent, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Z2 %"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <CoreFeatures />
      </div>
    </section>
  );
}
