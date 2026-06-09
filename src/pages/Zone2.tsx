import { Activity, Clock3, Gauge, HeartPulse } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { average, latest } from "../utils/data";
import { pace, paceMinutes, percent, shortDate } from "../utils/format";
import { thaiText } from "../utils/thaiText";

const TARGET_ZONE2_PACE_MIN = 7;

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
  const paceValues = rows.map((row) => row.pace).filter((value): value is number => value != null);
  const paceDomainValues = [...paceValues, TARGET_ZONE2_PACE_MIN];
  const paceDomain =
    paceDomainValues.length > 0
      ? [Math.max(0, Math.floor(Math.min(...paceDomainValues) - 0.5)), Math.ceil(Math.max(...paceDomainValues) + 0.5)]
      : [TARGET_ZONE2_PACE_MIN - 1, TARGET_ZONE2_PACE_MIN + 1];
  const driftTone: "neutral" | "good" | "warn" | "hot" =
    avgDrift == null ? "neutral" : avgDrift <= 5 ? "good" : avgDrift <= 8 ? "warn" : "hot";

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="เป้าหมายระยะยาว" value="7:00/km" detail="เพซโซน 2" icon={Gauge} tone="hot" />
        <MetricCard label="Z2 ล่าสุด" value={percent(latestRun?.z2_percent)} detail={latestRun?.run_date} icon={HeartPulse} tone={latestRun?.z2_percent != null && latestRun.z2_percent >= 80 ? "good" : "neutral"} />
        <MetricCard label="เพซล่าสุด" value={pace(latestRun?.pace_sec_per_km)} detail={latestRun?.session_type ? thaiText(latestRun.session_type) : undefined} icon={Clock3} />
        <MetricCard label="การไหลเฉลี่ย" value={avgDrift == null ? "-" : `${avgDrift.toFixed(1)} bpm`} detail={`เป้าหมาย ≤ 5 bpm · Z2 เฉลี่ย ${avgZ2 == null ? "-" : percent(avgZ2)}`} icon={Activity} tone={driftTone} />
      </div>

      <div className="content-grid">
        <Panel title="ความนิ่งของ Z2" subtitle="Z2 %, การไหลของหัวใจ และการหลุดแอโรบิก — เส้นประคือเป้าหมาย" className="span-12">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis {...chartAxis} />
              <ChartTooltip />
              <ReferenceLine y={80} stroke={chartColors.primary} strokeDasharray="6 6" label={{ value: "Z2 80%", position: "insideTopLeft", fontSize: 11, fill: chartColors.primary }} />
              <ReferenceLine y={5} stroke={chartColors.accent} strokeDasharray="6 6" label={{ value: "ไหล 5", position: "insideBottomLeft", fontSize: 11, fill: chartColors.accent }} />
              <Line dataKey="z2" stroke={chartColors.primary} strokeWidth={3} dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Z2 %" />
              <Line dataKey="drift" stroke={chartColors.accent} strokeWidth={2.5} dot={false} name="การไหล bpm" />
              <Line dataKey="decoupling" stroke={chartColors.brown} strokeWidth={2.5} strokeDasharray="4 5" dot={false} name="หลุดแอโรบิก %" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="แนวโน้มเพซ" subtitle="ค่าเพซยิ่งต่ำยิ่งเร็ว · เป้า 7:00/km" className="span-12">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis reversed domain={paceDomain} {...chartAxis} />
              <ChartTooltip formatter={(value) => [`${Number(value).toFixed(2)} นาที/กม.`, "เพซ"]} />
              <ReferenceLine y={TARGET_ZONE2_PACE_MIN} stroke={chartColors.accent} strokeDasharray="6 6" label={{ value: "เป้า 7:00", position: "insideTopRight", fontSize: 11, fill: chartColors.accent }} />
              <Area dataKey="pace" stroke={chartColors.primary} fill="url(#paceArea)" strokeWidth={3} name="เพซ นาที/กม." activeDot={{ r: 6, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}
