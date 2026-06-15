import { useState } from "react";
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock3, X } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { latest } from "../utils/data";
import { km, minutes, pace, percent, sessionLabel } from "../utils/format";
import { thaiText } from "../utils/thaiText";

type WeekTotals = {
  week_id: string;
  total_distance_km: number | null;
  total_duration_min: number | null;
  run_count: number | null;
  long_run_count: number | null;
  quality_count: number | null;
  readiness_issues: string | null;
  coach_recommendation: string | null;
};

function isoWeekId(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function buildWeekTotals(data: DashboardData) {
  const runTotals = new Map<string, { distance: number; duration: number; runs: number }>();

  for (const run of data.runs) {
    const weekId = isoWeekId(run.run_date);
    if (!weekId) continue;

    const current = runTotals.get(weekId) ?? { distance: 0, duration: 0, runs: 0 };
    runTotals.set(weekId, {
      distance: current.distance + (run.distance_km ?? 0),
      duration: current.duration + (run.duration_min ?? 0),
      runs: current.runs + 1,
    });
  }

  const summaryByWeek = new Map(data.weekly.map((week) => [week.week_id, week]));
  const weekIds = new Set([...summaryByWeek.keys(), ...runTotals.keys()]);

  return [...weekIds]
    .map((weekId) => {
      const summary = summaryByWeek.get(weekId);
      const runs = runTotals.get(weekId);

      return {
        week_id: weekId,
        total_distance_km: summary?.total_distance_km ?? runs?.distance ?? null,
        total_duration_min: summary?.total_duration_min ?? runs?.duration ?? null,
        run_count: summary?.run_count ?? runs?.runs ?? null,
        long_run_count: summary?.long_run_count ?? null,
        quality_count: summary?.quality_count ?? null,
        readiness_issues: summary?.readiness_issues ?? null,
        coach_recommendation: summary?.coach_recommendation ?? null,
      };
    })
    .sort((a, b) => a.week_id.localeCompare(b.week_id));
}

export function Weekly({ data }: { data: DashboardData }) {
  const summaryRows = buildWeekTotals(data);
  const week = latest(summaryRows, "week_id");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const weekRows = summaryRows.slice(-16).map((w) => ({
    week: w.week_id.replace(/^\d{4}-/, ""),
    weekId: w.week_id,
    km: w.total_distance_km ?? 0,
    hours: w.total_duration_min == null ? null : Number((w.total_duration_min / 60).toFixed(1)),
    runs: w.run_count ?? 0,
    quality: w.quality_count ?? 0,
  }));

  // Desktop box always shows a week (default latest); mobile modal opens only on click.
  const inlineWeekId = selectedWeek ?? week?.week_id ?? null;
  const inlineSummary = summaryRows.find((w) => w.week_id === inlineWeekId) ?? null;
  const runsFor = (weekId: string | null) =>
    weekId
      ? data.runs.filter((r) => isoWeekId(r.run_date) === weekId).sort((a, b) => a.run_date.localeCompare(b.run_date))
      : [];
  const inlineRuns = runsFor(inlineWeekId);
  const modalSummary = selectedWeek ? summaryRows.find((w) => w.week_id === selectedWeek) ?? null : null;
  const modalRuns = runsFor(selectedWeek);

  function reportBody(summary: WeekTotals, runs: typeof inlineRuns) {
    return (
      <>
        <div className="cal-data-grid" style={{ marginBottom: 12 }}>
          <DataRow label="ระยะรวม" value={km(summary.total_distance_km)} />
          <DataRow label="เวลารวม" value={minutes(summary.total_duration_min)} />
          <DataRow label="จำนวนวิ่ง" value={`${summary.run_count ?? runs.length} ครั้ง`} />
          <DataRow label="วิ่งยาว" value={`${summary.long_run_count ?? 0} ครั้ง`} />
          <DataRow label="ซ้อมคุณภาพ" value={`${summary.quality_count ?? 0} ครั้ง`} />
        </div>
        {runs.length === 0 ? (
          <p className="chart-note">ไม่มี run log ในสัปดาห์นี้</p>
        ) : (
          <div className="table-scroll report-detail-scroll">
            <table>
              <thead>
                <tr><th>วันที่</th><th>ประเภท</th><th>ระยะ</th><th>เวลา</th><th>เพซ</th><th>Z2</th><th>การไหล</th><th>Cadence</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.run_date}</td>
                    <td>{sessionLabel(r.session_type)}</td>
                    <td>{km(r.distance_km)}</td>
                    <td>{minutes(r.duration_min)}</td>
                    <td>{pace(r.pace_sec_per_km)}</td>
                    <td>{percent(r.z2_percent)}</td>
                    <td>{r.drift_bpm?.toFixed(1) ?? "-"} bpm</td>
                    <td>{r.cadence_spm?.toFixed(0) ?? "-"} spm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="สัปดาห์ล่าสุด" value={week?.week_id ?? "-"} icon={CalendarDays} />
        <MetricCard label="ระยะรวม" value={km(week?.total_distance_km)} icon={Activity} />
        <MetricCard label="เวลารวม" value={minutes(week?.total_duration_min)} icon={Clock3} />
        <MetricCard
          label="จำนวนครั้ง"
          value={week?.run_count == null ? "-" : String(week.run_count)}
          detail={`วิ่งยาว ${week?.long_run_count ?? 0} · ซ้อมคุณภาพ ${week?.quality_count ?? 0}`}
          icon={CheckCircle2}
        />
      </div>

      <div className="content-grid">
        <Panel title="แนวโน้มระยะรายสัปดาห์" subtitle="คลิกที่แท่งเพื่อดูรายละเอียดสัปดาห์นั้น" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={weekRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="week" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} />
              <ChartTooltip />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ color: chartColors.muted, fontSize: 12, paddingBottom: 8 }} />
              <Bar
                yAxisId="left"
                dataKey="km"
                fill="url(#primaryBar)"
                radius={[8, 8, 0, 0]}
                name="ระยะ km"
                cursor="pointer"
                onClick={(d: { payload?: { weekId?: string } }) => d?.payload?.weekId && setSelectedWeek(d.payload.weekId)}
              />
              <Line
                yAxisId="right"
                dataKey="hours"
                stroke={chartColors.accent}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.accent, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="เวลา ชม."
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        {inlineSummary && (
          <Panel
            title={`รายละเอียดสัปดาห์ ${inlineWeekId ?? "-"}`}
            subtitle="คลิกแท่งในกราฟเพื่อเปลี่ยนสัปดาห์"
            className="span-12 report-detail-box"
          >
            {reportBody(inlineSummary, inlineRuns)}
          </Panel>
        )}

        <Panel title="คำแนะนำโค้ช" subtitle="คำแนะนำปรับแผน" className="span-8">
          <div className="coach-card">
            {(week?.coach_recommendation ?? "-").split("\n").map((line) => (
              <p key={line}>{thaiText(line)}</p>
            ))}
          </div>
        </Panel>

        <Panel title="ธงเตือนความพร้อม" subtitle="ธงเตือนประจำสัปดาห์" className="span-4">
          <div className="issue-card">
            <AlertTriangle size={22} />
            <p>{thaiText(week?.readiness_issues, "ไม่พบธงเตือนความพร้อมเพิ่มเติม")}</p>
          </div>
        </Panel>
      </div>

      {/* Mobile: half-screen bottom-sheet modal */}
      {modalSummary && (
        <div className="cal-modal-overlay report-detail-modal" onClick={() => setSelectedWeek(null)}>
          <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-header">
              <strong style={{ fontSize: "1rem", color: "var(--color-ink)" }}>สัปดาห์ {selectedWeek}</strong>
              <button className="cal-modal-close" onClick={() => setSelectedWeek(null)} type="button"><X size={18} /></button>
            </div>
            {reportBody(modalSummary, modalRuns)}
          </div>
        </div>
      )}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
      <span style={{ color: "var(--color-muted)", fontSize: "0.75rem", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 650, color: "var(--color-ink)" }}>{value}</span>
    </div>
  );
}
