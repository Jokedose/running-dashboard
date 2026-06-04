import { Activity, Brain, Moon, TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { average } from "../utils/data";
import { km, minutes, shortDate } from "../utils/format";

export function Trends({ data }: { data: DashboardData }) {
  const avgHrv = average(data.daily.map((d) => d.hrv_avg_ms));
  const avgSleepMin = average(data.daily.map((d) => d.sleep_minutes));
  const avgWeeklyKm = average(data.weekly.map((w) => w.total_distance_km));
  const totalWeeks = data.weekly.length;

  const weekRows = data.weekly.slice(-20).map((w) => ({
    week: w.week_id.replace(/^\d{4}-/, ""),
    km: w.total_distance_km ?? 0,
    quality: w.quality_count ?? 0,
    long: w.long_run_count ?? 0,
  }));

  const hrvRows = data.daily.slice(-30).map((d) => ({
    date: shortDate(d.log_date),
    hrv: d.hrv_avg_ms ?? null,
    load: d.load_ratio == null ? null : Number(d.load_ratio.toFixed(2)),
    rhr: d.resting_hr_bpm ?? null,
  }));

  const sleepRows = data.daily.slice(-21).map((d) => ({
    date: shortDate(d.log_date),
    hours: d.sleep_minutes == null ? null : Math.round(d.sleep_minutes / 6) / 10,
    score: d.sleep_score ?? null,
  }));

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="สัปดาห์ทั้งหมด" value={String(totalWeeks)} detail="ที่บันทึกไว้" icon={TrendingUp} />
        <MetricCard label="ระยะ/สัปดาห์" value={km(avgWeeklyKm)} detail="เฉลี่ยทุก week" icon={Activity} />
        <MetricCard
          label="HRV เฉลี่ย"
          value={avgHrv == null ? "-" : `${avgHrv.toFixed(0)} ms`}
          detail="ทุก daily log"
          icon={Brain}
        />
        <MetricCard
          label="Sleep เฉลี่ย"
          value={avgSleepMin == null ? "-" : minutes(avgSleepMin)}
          detail="ทุก daily log"
          icon={Moon}
        />
      </div>

      <div className="content-grid">
        <Panel title="Weekly volume" subtitle="ระยะรวมและ quality runs รายสัปดาห์ (สูงสุด 20 สัปดาห์)" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={weekRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="week" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 8]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="km" fill="url(#primaryBar)" radius={[8, 8, 0, 0]} name="ระยะ km" />
              <Line
                yAxisId="right"
                dataKey="quality"
                stroke={chartColors.accent}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.accent, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Quality runs"
                connectNulls={false}
              />
              <Line
                yAxisId="right"
                dataKey="long"
                stroke={chartColors.blue}
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
                name="Long runs"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="HRV · Training load" subtitle="30 วันล่าสุด — HRV ms (เส้นทึบ) · Load ratio (เส้นประ)" className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={hrvRows} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} />
              <ChartTooltip />
              <Line
                yAxisId="left"
                dataKey="hrv"
                stroke={chartColors.primary}
                strokeWidth={3}
                dot={false}
                name="HRV ms"
                connectNulls={false}
              />
              <Line
                yAxisId="right"
                dataKey="load"
                stroke={chartColors.blue}
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
                name="Load ratio"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Sleep quality" subtitle="21 วันล่าสุด — ชั่วโมงนอน (แท่ง) · Sleep score (เส้น)" className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={sleepRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" domain={[0, 12]} {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="hours" fill="url(#sleepBar)" radius={[8, 8, 0, 0]} name="นอน (ชม.)" />
              <Line
                yAxisId="right"
                dataKey="score"
                stroke={chartColors.blue}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.blue, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Sleep score"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}
