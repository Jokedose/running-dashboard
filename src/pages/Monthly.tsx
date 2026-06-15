import { useState } from "react";
import { Activity, CalendarRange, Clock3, Mountain, X } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, RunLog } from "../types";
import { km, minutes, pace, percent, sessionLabel } from "../utils/format";
import { classifySession } from "../utils/session";

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

export function Monthly({ data }: { data: DashboardData }) {
  const months = buildMonths(data);
  const latest = months[months.length - 1] ?? null;
  const prev = months.length >= 2 ? months[months.length - 2] : null;
  const [selected, setSelected] = useState<string | null>(null);

  // Desktop box always shows a month (default latest); mobile modal opens only on click.
  const inlineMonth = selected ?? latest?.month ?? null;
  const inlineAgg = months.find((m) => m.month === inlineMonth) ?? null;
  const runsFor = (month: string | null) =>
    month
      ? data.runs.filter((r) => r.run_date?.slice(0, 7) === month).sort((a, b) => (a.run_date ?? "").localeCompare(b.run_date ?? ""))
      : [];
  const inlineRuns = runsFor(inlineMonth);
  const modalAgg = selected ? months.find((m) => m.month === selected) ?? null : null;
  const modalRuns = runsFor(selected);

  function reportBody(agg: MonthAgg, runs: RunLog[]) {
    const summary = data.monthly.find((m) => m.month === agg.month) ?? null;
    return (
      <>
        <div className="cal-data-grid" style={{ marginBottom: 12 }}>
          <DataRow label="ระยะรวม" value={km(agg.distance)} />
          <DataRow label="เวลารวม" value={minutes(agg.duration)} />
          <DataRow label="จำนวนวิ่ง" value={`${agg.runs} ครั้ง`} />
          <DataRow label="วิ่งยาว" value={`${agg.longRuns} ครั้ง`} />
          <DataRow label="ซ้อมคุณภาพ" value={`${agg.quality} ครั้ง`} />
          <DataRow label="avg pace" value={pace(agg.paceSec)} />
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
                {runs.map((r: RunLog) => (
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

  const volDelta = latest && prev && prev.distance > 0
    ? ((latest.distance - prev.distance) / prev.distance) * 100
    : null;

  const chartRows = months.slice(-12).map((m) => ({
    label: m.label,
    month: m.month,
    km: Number(m.distance.toFixed(1)),
    paceMin: m.paceSec ? Number((m.paceSec / 60).toFixed(2)) : null,
  }));

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="เดือนล่าสุด" value={latest?.label ?? "-"} detail={`${latest?.runs ?? 0} ครั้ง`} icon={CalendarRange} />
        <MetricCard
          label="ระยะรวมเดือนนี้"
          value={km(latest?.distance ?? null)}
          detail={volDelta == null ? undefined : `${volDelta >= 0 ? "▲" : "▼"} ${Math.abs(volDelta).toFixed(0)}% จากเดือนก่อน`}
          icon={Activity}
          tone={volDelta != null && volDelta > 30 ? "warn" : "neutral"}
        />
        <MetricCard label="เวลารวม" value={minutes(latest?.duration ?? null)} icon={Clock3} />
        <MetricCard
          label="วิ่งยาว · คุณภาพ"
          value={`${latest?.longRuns ?? 0} · ${latest?.quality ?? 0}`}
          detail={`avg pace ${pace(latest?.paceSec)}`}
          icon={Mountain}
        />
      </div>

      <div className="content-grid">
        <Panel title="ระยะ · เพซ รายเดือน" subtitle="คลิกที่แท่งเพื่อดู runs ในเดือนนั้น · เพซยิ่งต่ำยิ่งเร็ว" className="span-12">
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

        {/* Desktop: inline box below chart, fixed-height + inner scroll */}
        {inlineAgg && (
          <Panel
            title={`รายงานเดือน ${inlineAgg.label}`}
            subtitle="คลิกแท่งในกราฟเพื่อเปลี่ยนเดือน"
            className="span-12 report-detail-box"
          >
            {reportBody(inlineAgg, inlineRuns)}
          </Panel>
        )}
      </div>

      {/* Mobile: half-screen bottom-sheet modal */}
      {modalAgg && (
        <div className="cal-modal-overlay report-detail-modal" onClick={() => setSelected(null)}>
          <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-header">
              <strong style={{ fontSize: "1rem", color: "var(--color-ink)" }}>รายงานเดือน {modalAgg.label}</strong>
              <button className="cal-modal-close" onClick={() => setSelected(null)} type="button"><X size={18} /></button>
            </div>
            {reportBody(modalAgg, modalRuns)}
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
