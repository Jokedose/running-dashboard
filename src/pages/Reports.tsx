import { useState } from "react";
import { Activity, AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, Clock3, Mountain, X } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, RunLog } from "../types";
import { latest } from "../utils/data";
import { evaluateRun } from "../utils/evaluate";
import { km, minutes, pace, percent, sessionLabel } from "../utils/format";
import { classifySession } from "../utils/session";
import { thaiText } from "../utils/thaiText";

/* ─────────────────────────────────────────────
   Reports — สรุปผลย้อนหลังแบบรายสัปดาห์ / รายเดือน
   รวมจากหน้า Weekly + Monthly เดิม สลับมุมมองด้วย toggle
   ───────────────────────────────────────────── */

// verdict ต่อ run จาก evaluateRun (เกณฑ์ session_criteria ใน db)
function verdictIcon(run: RunLog, criteria: DashboardData["criteria"]): string {
  const evaluation = evaluateRun(run, criteria);
  if (!evaluation || evaluation.verdict === "unknown") return "–";
  return evaluation.verdict === "pass" ? "✅" : evaluation.verdict === "warn" ? "⚠️" : "⛔";
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
      <span style={{ color: "var(--color-muted)", fontSize: "0.75rem", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 650, color: "var(--color-ink)" }}>{value}</span>
    </div>
  );
}

/* ── Weekly aggregation ── */

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

function buildWeekTotals(data: DashboardData): WeekTotals[] {
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

function weekReportBody(summary: WeekTotals, runs: RunLog[], criteria: DashboardData["criteria"]) {
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
              <tr><th>วันที่</th><th>ประเภท</th><th>เกณฑ์</th><th>ระยะ</th><th>เวลา</th><th>เพซ</th><th>Z2</th><th>การไหล</th><th>Cadence</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.run_date}</td>
                  <td>{sessionLabel(r.session_type)}</td>
                  <td>{verdictIcon(r, criteria)}</td>
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

/* ── Monthly aggregation ── */

const MONTHS_TH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

type MonthAgg = {
  month: string; // YYYY-MM
  label: string;
  distance: number;
  duration: number;
  runs: number;
  longRuns: number;
  quality: number;
  paceSec: number | null; // weighted avg pace
  avgWeightKg: number | null;
};

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${MONTHS_TH[parseInt(m) - 1]} ${y.slice(2)}`;
}

function buildMonths(data: DashboardData): MonthAgg[] {
  const map = new Map<string, MonthAgg>();
  for (const r of data.runs) {
    if (!r.run_date) continue;
    const month = r.run_date.slice(0, 7);
    const a = map.get(month) ?? {
      month, label: monthLabel(month), distance: 0, duration: 0, runs: 0,
      longRuns: 0, quality: 0, paceSec: null, avgWeightKg: null,
    };
    a.distance += r.distance_km ?? 0;
    a.duration += r.duration_min ?? 0;
    a.runs += 1;
    const kind = classifySession(r.session_type);
    if (kind === "long") a.longRuns += 1;
    if (kind === "tempo" || kind === "vo2" || kind === "test") a.quality += 1;
    map.set(month, a);
  }
  // weighted avg pace = total duration / total distance
  for (const a of map.values()) {
    a.paceSec = a.distance > 0 && a.duration > 0 ? (a.duration * 60) / a.distance : null;
  }
  // monthly mean body weight
  const wByMonth = new Map<string, number[]>();
  for (const b of data.body) {
    if (b.weight_kg == null) continue;
    const month = b.measured_date.slice(0, 7);
    const arr = wByMonth.get(month) ?? [];
    arr.push(b.weight_kg);
    wByMonth.set(month, arr);
  }
  for (const [month, arr] of wByMonth) {
    const a = map.get(month);
    if (a) a.avgWeightKg = arr.reduce((x, y) => x + y, 0) / arr.length;
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function monthReportBody(agg: MonthAgg, runs: RunLog[], data: DashboardData) {
  const summary = data.monthly.find((m) => m.month === agg.month) ?? null;
  return (
    <>
      <div className="cal-data-grid" style={{ marginBottom: 12 }}>
        <DataRow label="ระยะรวม" value={km(agg.distance)} />
        <DataRow label="เวลารวม" value={minutes(agg.duration)} />
        <DataRow label="จำนวนวิ่ง" value={`${agg.runs} ครั้ง`} />
        <DataRow label="วิ่งยาว" value={`${agg.longRuns} ครั้ง`} />
        <DataRow label="ซ้อมคุณภาพ" value={`${agg.quality} ครั้ง`} />
        <DataRow label="เพซเฉลี่ย" value={pace(agg.paceSec)} />
        {agg.avgWeightKg != null && <DataRow label="น้ำหนักเฉลี่ย" value={`${agg.avgWeightKg.toFixed(1)} kg`} />}
      </div>

      {summary?.coach_decision && (
        <div className="cal-block" style={{ borderLeftColor: "var(--color-primary)", background: "var(--color-primary-soft)", marginBottom: 10 }}>
          <span className="cal-block-title">🧭 สรุปโค้ชประจำเดือน</span>
          {summary.coach_decision.split("\n").map((line, i) => (
            <p key={i} className="cal-note-line" style={{ marginTop: i === 0 ? 4 : 6 }}>{line}</p>
          ))}
        </div>
      )}
      {summary?.readiness_flags && (
        <div className="cal-block" style={{ borderLeftColor: "#eed28b", background: "#fef9ec", marginBottom: 10 }}>
          <span className="cal-block-title" style={{ color: "#7a5300" }}>⚠️ ธงเตือนความพร้อม</span>
          {summary.readiness_flags.split("\n").map((line, i) => (
            <p key={i} className="cal-note-line" style={{ marginTop: i === 0 ? 4 : 6 }}>{line}</p>
          ))}
        </div>
      )}
      {runs.length === 0 ? (
        <p className="chart-note">ไม่มี run log ในเดือนนี้</p>
      ) : (
        <div className="table-scroll report-detail-scroll">
          <table>
            <thead>
              <tr><th>วันที่</th><th>ประเภท</th><th>ระยะ</th><th>เวลา</th><th>เพซ</th><th>Z2</th><th>Cadence</th></tr>
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

function WeeklyView({ data }: { data: DashboardData }) {
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

  const inlineWeekId = selectedWeek ?? week?.week_id ?? null;
  const inlineSummary = summaryRows.find((w) => w.week_id === inlineWeekId) ?? null;
  const runsFor = (weekId: string | null) =>
    weekId
      ? data.runs.filter((r) => isoWeekId(r.run_date) === weekId).sort((a, b) => a.run_date.localeCompare(b.run_date))
      : [];
  const inlineRuns = runsFor(inlineWeekId);
  const modalSummary = selectedWeek ? summaryRows.find((w) => w.week_id === selectedWeek) ?? null : null;
  const modalRuns = runsFor(selectedWeek);

  return (
    <>
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
        <Panel title="Weekly distance trend" subtitle="คลิกที่แท่งเพื่อดูรายละเอียดสัปดาห์นั้น" className="span-12">
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
            title={`Week detail ${inlineWeekId ?? "-"}`}
            subtitle="คลิกแท่งในกราฟเพื่อเปลี่ยนสัปดาห์"
            className="span-12 report-detail-box"
          >
            {weekReportBody(inlineSummary, inlineRuns, data.criteria)}
          </Panel>
        )}

        <Panel title="Coach recommendation" subtitle="คำแนะนำปรับแผน" className="span-8">
          <div className="coach-card">
            {(week?.coach_recommendation ?? "-").split("\n").map((line) => (
              <p key={line}>{thaiText(line)}</p>
            ))}
          </div>
        </Panel>

        <Panel title="Readiness flags" subtitle="ธงเตือนประจำสัปดาห์" className="span-4">
          <div className="issue-card">
            <AlertTriangle size={22} />
            <p>{thaiText(week?.readiness_issues, "ไม่พบธงเตือนความพร้อมเพิ่มเติม")}</p>
          </div>
        </Panel>
      </div>

      {modalSummary && (
        <div className="cal-modal-overlay report-detail-modal" onClick={() => setSelectedWeek(null)}>
          <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-header">
              <strong style={{ fontSize: "1rem", color: "var(--color-ink)" }}>สัปดาห์ {selectedWeek}</strong>
              <button className="cal-modal-close" onClick={() => setSelectedWeek(null)} type="button"><X size={18} /></button>
            </div>
            {weekReportBody(modalSummary, modalRuns, data.criteria)}
          </div>
        </div>
      )}
    </>
  );
}

function MonthlyView({ data }: { data: DashboardData }) {
  const months = buildMonths(data);
  const latestMonth = months[months.length - 1] ?? null;
  const prev = months.length >= 2 ? months[months.length - 2] : null;
  const [selected, setSelected] = useState<string | null>(null);

  const inlineMonth = selected ?? latestMonth?.month ?? null;
  const inlineAgg = months.find((m) => m.month === inlineMonth) ?? null;
  const runsFor = (month: string | null) =>
    month
      ? data.runs.filter((r) => r.run_date?.slice(0, 7) === month).sort((a, b) => (a.run_date ?? "").localeCompare(b.run_date ?? ""))
      : [];
  const inlineRuns = runsFor(inlineMonth);
  const modalAgg = selected ? months.find((m) => m.month === selected) ?? null : null;
  const modalRuns = runsFor(selected);

  const volDelta = latestMonth && prev && prev.distance > 0
    ? ((latestMonth.distance - prev.distance) / prev.distance) * 100
    : null;

  const chartRows = months.slice(-12).map((m) => ({
    label: m.label,
    month: m.month,
    km: Number(m.distance.toFixed(1)),
    paceMin: m.paceSec ? Number((m.paceSec / 60).toFixed(2)) : null,
  }));

  return (
    <>
      <div className="metric-grid">
        <MetricCard label="เดือนล่าสุด" value={latestMonth?.label ?? "-"} detail={`${latestMonth?.runs ?? 0} ครั้ง`} icon={CalendarRange} />
        <MetricCard
          label="ระยะรวมเดือนนี้"
          value={km(latestMonth?.distance ?? null)}
          detail={volDelta == null ? undefined : `${volDelta >= 0 ? "▲" : "▼"} ${Math.abs(volDelta).toFixed(0)}% จากเดือนก่อน`}
          icon={Activity}
          tone={volDelta != null && volDelta > 30 ? "warn" : "neutral"}
        />
        <MetricCard label="เวลารวม" value={minutes(latestMonth?.duration ?? null)} icon={Clock3} />
        <MetricCard
          label="วิ่งยาว · คุณภาพ"
          value={`${latestMonth?.longRuns ?? 0} · ${latestMonth?.quality ?? 0}`}
          detail={`avg pace ${pace(latestMonth?.paceSec)}`}
          icon={Mountain}
        />
      </div>

      <div className="content-grid">
        <Panel title="Monthly distance · pace" subtitle="คลิกที่แท่งเพื่อดู runs ในเดือนนั้น · เพซยิ่งต่ำยิ่งเร็ว" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" reversed {...chartAxis} />
              <ChartTooltip />
              <Bar
                yAxisId="left"
                dataKey="km"
                fill="url(#primaryBar)"
                radius={[8, 8, 0, 0]}
                name="ระยะ km"
                cursor="pointer"
                onClick={(d: { payload?: { month?: string } }) => d?.payload?.month && setSelected(d.payload.month)}
              />
              <Line yAxisId="right" dataKey="paceMin" stroke={chartColors.blue} strokeWidth={3} dot={{ r: 3, fill: chartColors.blue, strokeWidth: 0 }} name="เพซ นาที/กม." connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        {inlineAgg && (
          <Panel
            title={`Month report ${inlineAgg.label}`}
            subtitle="คลิกแท่งในกราฟเพื่อเปลี่ยนเดือน"
            className="span-12 report-detail-box"
          >
            {monthReportBody(inlineAgg, inlineRuns, data)}
          </Panel>
        )}
      </div>

      {modalAgg && (
        <div className="cal-modal-overlay report-detail-modal" onClick={() => setSelected(null)}>
          <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-header">
              <strong style={{ fontSize: "1rem", color: "var(--color-ink)" }}>รายงานเดือน {modalAgg.label}</strong>
              <button className="cal-modal-close" onClick={() => setSelected(null)} type="button"><X size={18} /></button>
            </div>
            {monthReportBody(modalAgg, modalRuns, data)}
          </div>
        </div>
      )}
    </>
  );
}

export function Reports({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  return (
    <section className="page-stack">
      <div className="cal-view-toggle" role="tablist" aria-label="สลับมุมมองรายงาน">
        <button className={`cal-btn${mode === "week" ? " cal-btn-active" : ""}`} onClick={() => setMode("week")} type="button" role="tab" aria-selected={mode === "week"}>
          รายสัปดาห์
        </button>
        <button className={`cal-btn${mode === "month" ? " cal-btn-active" : ""}`} onClick={() => setMode("month")} type="button" role="tab" aria-selected={mode === "month"}>
          รายเดือน
        </button>
      </div>
      {mode === "week" ? <WeeklyView data={data} /> : <MonthlyView data={data} />}
    </section>
  );
}
