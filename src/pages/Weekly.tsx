import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { latest } from "../utils/data";
import { km, minutes } from "../utils/format";

export function Weekly({ data }: { data: DashboardData }) {
  const week = latest(data.weekly, "week_id");

  const weekRows = data.weekly.slice(-16).map((w) => ({
    week: w.week_id.replace(/^\d{4}-/, ""),
    km: w.total_distance_km ?? 0,
    runs: w.run_count ?? 0,
    quality: w.quality_count ?? 0,
  }));

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="สัปดาห์ล่าสุด" value={week?.week_id ?? "-"} icon={CalendarDays} />
        <MetricCard label="ระยะรวม" value={km(week?.total_distance_km)} icon={Activity} />
        <MetricCard label="เวลารวม" value={minutes(week?.total_duration_min)} icon={Clock3} />
        <MetricCard
          label="จำนวนครั้ง"
          value={week?.run_count == null ? "-" : String(week.run_count)}
          detail={`long ${week?.long_run_count ?? 0} · quality ${week?.quality_count ?? 0}`}
          icon={CheckCircle2}
        />
      </div>

      <div className="content-grid">
        <Panel title="Weekly volume trend" subtitle="ระยะและ quality runs รายสัปดาห์" className="span-12">
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
                name="ซ้อมคุณภาพ"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Coach recommendation" subtitle="คำแนะนำปรับแผน" className="span-8">
          <div className="coach-card">
            {(week?.coach_recommendation ?? "-").split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Panel>

        <Panel title="ธงเตือนความพร้อม" subtitle="ธงเตือนประจำสัปดาห์" className="span-4">
          <div className="issue-card">
            <AlertTriangle size={22} />
            <p>{week?.readiness_issues || "ไม่พบ readiness issue เพิ่มเติม"}</p>
          </div>
        </Panel>
      </div>
    </section>
  );
}
