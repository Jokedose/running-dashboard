import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DailyReadiness, DashboardData, RunLog, TrainingPlan } from "../types";
import { km, minutes, pace, percent, sessionLabel, workoutSegments } from "../utils/format";
import { RunLaps } from "../components/RunLaps";
import { thaiText } from "../utils/thaiText";

const WEEKDAYS_SHORT = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

type ViewMode = "month" | "week";

type DayData = {
  date: string;
  plans: TrainingPlan[];
  run: RunLog | null;
  readiness: DailyReadiness | null;
};

type MatchResult = {
  verdict: string;
  bgColor: string;
  textColor: string;
  checks: { label: string; planned: string; actual: string; ok: boolean }[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekDates(refDate: string): string[] {
  const d = new Date(refDate);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().slice(0, 10);
  });
}

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDow = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array(leadingDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sessionTypeColor(type: string | null | undefined): { bg: string; border: string; text: string } {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("long") || t.includes("ยาว")) return { bg: "#ede9fe", border: "#7c3aed", text: "#5b21b6" };
  if (t.includes("tempo") || t.includes("threshold") || t.includes("interval") || t.includes("quality"))
    return { bg: "#ffedd5", border: "#c2410c", text: "#9a3412" };
  if (t.includes("easy") || t.includes("recovery") || t.includes("เบา") || t.includes("ฟื้น"))
    return { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" };
  if (t.includes("race") || t.includes("แข่ง")) return { bg: "#fef3c7", border: "#b45309", text: "#92400e" };
  if (t.includes("rest") || t.includes("off") || t.includes("พัก")) return { bg: "#f3f4f6", border: "#6b7280", text: "#374151" };
  return { bg: "#e0f2fe", border: "#0369a1", text: "#075985" };
}

function statusDot(status: TrainingPlan["status"] | null): { char: string; color: string } {
  if (status === "done") return { char: "✓", color: "#1a6847" };
  if (status === "skipped") return { char: "✗", color: "#9d1c37" };
  if (status === "adjusted") return { char: "~", color: "#7a5300" };
  return { char: "·", color: "#668086" };
}

function statusLabel(status: TrainingPlan["status"] | null) {
  if (status === "done") return "ทำแล้ว";
  if (status === "skipped") return "ข้าม";
  if (status === "adjusted") return "ปรับแผน";
  return "ตามแผน";
}

function priorityLabel(priority: TrainingPlan["priority"] | null) {
  if (priority === "race") return "วันแข่ง 🏆";
  if (priority === "high") return "สำคัญ";
  if (priority === "low") return "เบา";
  return "ปกติ";
}

function noteField(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const line = notes.split("\n").find((l) => l.trim().startsWith(`${label}:`));
  return line?.split(":").slice(1).join(":").trim() || null;
}

function analyzeMatch(plan: TrainingPlan, run: RunLog): MatchResult {
  const checks: MatchResult["checks"] = [];

  if (plan.target_distance_km != null && run.distance_km != null) {
    const pct = (run.distance_km - plan.target_distance_km) / plan.target_distance_km;
    checks.push({ label: "ระยะ", planned: km(plan.target_distance_km), actual: km(run.distance_km), ok: pct >= -0.1 && pct <= 0.15 });
  }
  if (plan.target_pace_sec_per_km != null && run.pace_sec_per_km != null) {
    checks.push({ label: "เพซ", planned: pace(plan.target_pace_sec_per_km), actual: pace(run.pace_sec_per_km), ok: Math.abs(run.pace_sec_per_km - plan.target_pace_sec_per_km) <= 20 });
  }
  if (plan.target_duration_min != null && run.duration_min != null) {
    checks.push({ label: "เวลา", planned: minutes(plan.target_duration_min), actual: minutes(run.duration_min), ok: Math.abs(run.duration_min - plan.target_duration_min) <= 5 });
  }

  if (!checks.length) return { verdict: "วิ่งแล้ว", bgColor: "#d8eee5", textColor: "#1a6847", checks };

  const allOk = checks.every((c) => c.ok);
  const d = plan.target_distance_km;
  const rd = run.distance_km;

  let verdict: string, bgColor: string, textColor: string;
  if (allOk) {
    verdict = "ตามแผน ✓"; bgColor = "#d8eee5"; textColor = "#1a6847";
  } else if (d != null && rd != null && rd > d * 1.12) {
    verdict = "เกินแผน"; bgColor = "#fef3c7"; textColor = "#7a5300";
  } else if (d != null && rd != null && rd < d * 0.9) {
    verdict = "ต่ำกว่าแผน"; bgColor = "#fee2e8"; textColor = "#9d1c37";
  } else {
    verdict = "ใกล้เคียง"; bgColor = "#dff7f2"; textColor = "#1a6847";
  }
  return { verdict, bgColor, textColor, checks };
}

export function Calendar({ data }: { data: DashboardData }) {
  const today = todayIso();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [navDate, setNavDate] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);

  const planByDate = useMemo(() => {
    const map = new Map<string, TrainingPlan[]>();
    for (const p of data.plan) {
      const arr = map.get(p.plan_date) ?? [];
      arr.push(p);
      map.set(p.plan_date, arr);
    }
    return map;
  }, [data.plan]);

  const runByDate = useMemo(() => {
    const map = new Map<string, RunLog>();
    for (const r of data.runs) map.set(r.run_date, r);
    return map;
  }, [data.runs]);

  const readinessByDate = useMemo(() => {
    const map = new Map<string, DailyReadiness>();
    for (const d of data.daily) map.set(d.log_date, d);
    return map;
  }, [data.daily]);

  function dayData(date: string): DayData {
    return { date, plans: planByDate.get(date) ?? [], run: runByDate.get(date) ?? null, readiness: readinessByDate.get(date) ?? null };
  }

  const navYear = parseInt(navDate.slice(0, 4));
  const navMonth = parseInt(navDate.slice(5, 7));

  function prevPeriod() {
    if (viewMode === "month") {
      const d = new Date(navYear, navMonth - 2, 1);
      setNavDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    } else setNavDate(addDays(navDate, -7));
  }
  function nextPeriod() {
    if (viewMode === "month") {
      const d = new Date(navYear, navMonth, 1);
      setNavDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    } else setNavDate(addDays(navDate, 7));
  }

  const grid = useMemo(() => monthGrid(navYear, navMonth), [navYear, navMonth]);
  const weekDays = useMemo(() => weekDates(navDate), [navDate]);
  const selectedDay = selected ? dayData(selected) : null;
  const periodLabel = viewMode === "month"
    ? `${MONTHS_TH[navMonth - 1]} ${navYear}`
    : `${weekDays[0].slice(5).replace("-", "/")} – ${weekDays[6].slice(5).replace("-", "/")}`;

  return (
    <section className="page-stack">
      <div className="cal-controls">
        <div className="cal-view-toggle">
          <button className={`cal-btn${viewMode === "month" ? " cal-btn-active" : ""}`} onClick={() => setViewMode("month")} type="button">เดือน</button>
          <button className={`cal-btn${viewMode === "week" ? " cal-btn-active" : ""}`} onClick={() => setViewMode("week")} type="button">สัปดาห์</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <button className="cal-nav-btn" onClick={prevPeriod} type="button"><ChevronLeft size={16} /></button>
          <strong className="cal-period-label">{periodLabel}</strong>
          <button className="cal-nav-btn" onClick={nextPeriod} type="button"><ChevronRight size={16} /></button>
          <button className="cal-today-btn" onClick={() => setNavDate(today)} type="button">วันนี้</button>
        </div>
      </div>

      {viewMode === "month"
        ? <MonthView grid={grid} dayData={dayData} today={today} onSelect={setSelected} />
        : <WeekView dates={weekDays} dayData={dayData} today={today} onSelect={setSelected} />}

      <div className="cal-legend">
        {[
          { color: "#1a6847", label: "ตามแผน" },
          { color: "#7a5300", label: "ปรับ/เกิน" },
          { color: "#9d1c37", label: "ข้าม/ต่ำ" },
          { color: "#2563eb", label: "วิ่งเบา" },
          { color: "#7c3aed", label: "วิ่งยาว" },
          { color: "#c2410c", label: "คุณภาพ" },
          { color: "#b45309", label: "วันแข่ง" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="cal-legend-dot" style={{ background: color }} />{label}
          </span>
        ))}
      </div>

      {selected && selectedDay && <DayModal day={selectedDay} onClose={() => setSelected(null)} />}
    </section>
  );
}

function MonthView({ grid, dayData, today, onSelect }: {
  grid: (string | null)[]; dayData: (d: string) => DayData; today: string; onSelect: (d: string) => void;
}) {
  return (
    <div className="cal-month-grid">
      <div className="cal-month-header">
        {WEEKDAYS_SHORT.map((d) => <div key={d} className="cal-month-header-cell">{d}</div>)}
      </div>
      <div className="cal-month-body">
        {grid.map((date, idx) =>
          date
            ? <DayCell key={date} dd={dayData(date)} isToday={date === today} isPast={date < today} onSelect={onSelect} />
            : <div key={`e-${idx}`} className="cal-day-cell cal-day-empty" />
        )}
      </div>
    </div>
  );
}

function DayCell({ dd, isToday, isPast, onSelect }: {
  dd: DayData; isToday: boolean; isPast: boolean; onSelect: (d: string) => void;
}) {
  const dayNum = parseInt(dd.date.slice(8));
  const hasContent = dd.plans.length > 0 || dd.run !== null;
  const plan = dd.plans[0];
  const match = plan && dd.run && isPast ? analyzeMatch(plan, dd.run) : null;

  return (
    <div
      className={`cal-day-cell${hasContent ? " cal-day-clickable" : ""}${isToday ? " cal-day-today" : ""}${isPast && !isToday ? " cal-day-past" : ""}`}
      onClick={() => hasContent && onSelect(dd.date)}
    >
      <div className="cal-day-top">
        <span className="cal-day-num">{dayNum}</span>
        {match && <span className="cal-match-tiny" style={{ color: match.textColor }}>{match.verdict.replace(" ✓", "")}</span>}
        {!match && dd.readiness?.recovery_percent != null && (
          <span className="cal-recov-tiny">{dd.readiness.recovery_percent}%</span>
        )}
      </div>
      <div className="cal-chips">
        {dd.plans.slice(0, 2).map((p) => {
          const c = sessionTypeColor(p.session_type);
          const dot = statusDot(p.status);
          return (
            <div key={p.id} className="cal-chip" style={{ background: c.bg, borderLeftColor: c.border }}>
              <span className="cal-chip-dot" style={{ color: dot.color }}>{dot.char}</span>
              <span className="cal-chip-text" style={{ color: c.text }}>{sessionLabel(p.title).slice(0, 11)}</span>
            </div>
          );
        })}
        {dd.plans.length > 2 && <span className="cal-chip-more">+{dd.plans.length - 2}</span>}
        {dd.run && !dd.plans.length && (
          <div className="cal-chip" style={{ background: "#e0e7ff", borderLeftColor: "#6366f1" }}>
            <span className="cal-chip-dot" style={{ color: "#6366f1" }}>🏃</span>
            <span className="cal-chip-text" style={{ color: "#4338ca" }}>{dd.run.distance_km?.toFixed(1)}km</span>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekView({ dates, dayData, today, onSelect }: {
  dates: string[]; dayData: (d: string) => DayData; today: string; onSelect: (d: string) => void;
}) {
  return (
    <div className="cal-week-grid">
      {dates.map((date) => {
        const dd = dayData(date);
        const isToday = date === today;
        const isPast = date < today;
        const hasContent = dd.plans.length > 0 || dd.run !== null;
        const dowIdx = (new Date(date).getDay() + 6) % 7;
        const plan = dd.plans[0];
        const match = plan && dd.run && isPast ? analyzeMatch(plan, dd.run) : null;

        return (
          <div
            key={date}
            className={`cal-week-card${hasContent ? " cal-day-clickable" : ""}${isToday ? " cal-day-today" : ""}${isPast && !isToday ? " cal-day-past" : ""}`}
            onClick={() => hasContent && onSelect(date)}
          >
            <div className="cal-week-hdr">
              <span className="cal-week-dow">{WEEKDAYS_SHORT[dowIdx]}</span>
              <span className={`cal-day-num${isToday ? " cal-day-num-today" : ""}`}>{parseInt(date.slice(8))}</span>
            </div>
            <div className="cal-week-body">
              {dd.plans.map((p) => {
                const c = sessionTypeColor(p.session_type);
                const dot = statusDot(p.status);
                return (
                  <div key={p.id} className="cal-week-session" style={{
                    background: p.status === "done" ? "#d8eee5" : p.status === "skipped" ? "#fee2e8" : p.status === "adjusted" ? "#fef3c7" : c.bg,
                    borderLeftColor: c.border,
                  }}>
                    <div className="cal-week-session-title">
                      <span style={{ color: dot.color, fontWeight: 750 }}>{dot.char}</span>
                      <span style={{ color: "var(--color-ink)" }}>{sessionLabel(p.title)}</span>
                    </div>
                    {p.target_distance_km != null && (
                      <div className="cal-week-session-meta">{p.target_distance_km.toFixed(1)} km</div>
                    )}
                    {p.skip_reason && (
                      <div style={{
                        fontSize: "0.7rem",
                        color: p.status === "skipped" ? "#9d1c37" : "#7a5300",
                        marginTop: 2,
                        lineHeight: 1.4,
                        fontStyle: "italic",
                      }}>
                        {p.skip_reason.length > 60 ? p.skip_reason.slice(0, 57) + "…" : p.skip_reason}
                      </div>
                    )}
                  </div>
                );
              })}
              {dd.run && !dd.plans.length && (
                <div className="cal-week-session" style={{ background: "#e0e7ff", borderLeftColor: "#6366f1" }}>
                  <div className="cal-week-session-title" style={{ color: "var(--color-ink)" }}>วิ่งนอกแผน</div>
                  <div className="cal-week-session-meta">{dd.run.distance_km?.toFixed(1)} km</div>
                </div>
              )}
              {match && (
                <span className="cal-match-badge" style={{ background: match.bgColor, color: match.textColor }}>{match.verdict}</span>
              )}
              {dd.readiness?.recovery_percent != null && (
                <div className="cal-week-readiness">💚 {dd.readiness.recovery_percent}%{dd.readiness.hrv_avg_ms != null ? ` · HRV ${dd.readiness.hrv_avg_ms}` : ""}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayModal({ day, onClose }: { day: DayData; onClose: () => void }) {
  const { date, plans, run, readiness } = day;
  const plan = plans[0] ?? null;
  const today = todayIso();
  const isPast = date < today;
  const match = plan && run ? analyzeMatch(plan, run) : null;

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <strong style={{ fontSize: "1rem", color: "var(--color-ink)" }}>{date}</strong>
            {plan && (() => { const c = sessionTypeColor(plan.session_type); return (
              <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text }}>{sessionLabel(plan.session_type)}</span>
            ); })()}
            {match && (
              <span className="cal-match-badge" style={{ background: match.bgColor, color: match.textColor }}>{match.verdict}</span>
            )}
          </div>
          <button className="cal-modal-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {plan && (
          <div className="cal-block" style={{ borderLeftColor: sessionTypeColor(plan.session_type).border }}>
            <div className="cal-block-head">
              <strong>{sessionLabel(plan.title)}</strong>
              <span className="cal-status-pill" data-status={plan.status ?? "planned"}>{statusLabel(plan.status)}</span>
            </div>
            <div className="cal-data-grid">
              {plan.target_distance_km != null && <DataRow label="ระยะเป้า" value={km(plan.target_distance_km)} />}
              {plan.target_duration_min != null && <DataRow label="เวลาเป้า" value={minutes(plan.target_duration_min)} />}
              {plan.target_pace_sec_per_km != null && <DataRow label="เพซเป้า" value={pace(plan.target_pace_sec_per_km)} />}
              {plan.planned_shoe && <DataRow label="รองเท้า" value={thaiText(plan.planned_shoe)} />}
              {plan.priority && <DataRow label="ความสำคัญ" value={priorityLabel(plan.priority)} />}
            </div>
            {(() => {
              const segments = workoutSegments(noteField(plan.notes, "รายการซ้อม"));
              // session เดียว ไม่มี "+" คั่น (เช่น "Easy 45 นาที") -> โชว์บรรทัดเดียวแบบเดิม
              // session หลาย segment (WU/main/CD) -> แยกเป็น list ให้เห็น HR/pace ต่อรอบชัด
              if (segments.length <= 1) {
                return segments.length === 1 && (
                  <div className="cal-note-line"><b>รายการ:</b> {segments[0]}</div>
                );
              }
              return (
                <div className="cal-note-line">
                  <b>รายการซ้อม:</b>
                  <ol className="clean-list" style={{ marginTop: 4 }}>
                    {segments.map((segment, i) => <li key={i}>{segment}</li>)}
                  </ol>
                </div>
              );
            })()}
            {noteField(plan.notes, "เป้าหมายหลัก") && <div className="cal-note-line"><b>เป้าหมาย:</b> {noteField(plan.notes, "เป้าหมายหลัก")}</div>}
            {noteField(plan.notes, "เกณฑ์ผ่าน") && <div className="cal-note-line"><b>เกณฑ์ผ่าน:</b> {noteField(plan.notes, "เกณฑ์ผ่าน")}</div>}
          </div>
        )}

        {match && match.checks.length > 0 && (
          <div className="cal-block cal-block-match" style={{ background: match.bgColor, borderLeftColor: match.textColor }}>
            <span className="cal-block-title" style={{ color: match.textColor }}>📊 วิเคราะห์ vs แผน — {match.verdict}</span>
            <div className="cal-compare-table">
              <div className="cal-compare-head">
                <span>ตัวชี้วัด</span><span>แผน</span><span>จริง</span><span></span>
              </div>
              {match.checks.map((c) => (
                <div key={c.label} className="cal-compare-row">
                  <span>{c.label}</span>
                  <span>{c.planned}</span>
                  <span style={{ fontWeight: 650 }}>{c.actual}</span>
                  <span style={{ color: c.ok ? "#1a6847" : "#9d1c37", fontWeight: 750 }}>{c.ok ? "✓" : "✗"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {run && (
          <div className="cal-block" style={{ borderLeftColor: "#add9c9", background: "#f0faf5" }}>
            <span className="cal-block-title">📊 ผลจริง</span>
            <div className="cal-data-grid">
              {run.distance_km != null && <DataRow label="ระยะ" value={km(run.distance_km)} />}
              {run.duration_min != null && <DataRow label="เวลา" value={minutes(run.duration_min)} />}
              {run.pace_sec_per_km != null && <DataRow label="เพซ" value={pace(run.pace_sec_per_km)} />}
              {run.avg_hr_bpm != null && <DataRow label="ชีพจร" value={`${run.avg_hr_bpm.toFixed(0)} bpm`} />}
              {run.z2_percent != null && <DataRow label="Zone 2" value={percent(run.z2_percent)} />}
              {run.rpe && <DataRow label="RPE" value={thaiText(run.rpe)} />}
              {run.shoe_slug && <DataRow label="รองเท้า" value={thaiText(run.shoe_slug)} />}
              {run.pain && run.pain !== "none" && <DataRow label="เจ็บ" value={thaiText(run.pain)} />}
            </div>
            {run.note && <div className="cal-note-line" style={{ marginTop: 8, borderTop: "1px solid var(--color-line-soft)", paddingTop: 6 }}>{run.note}</div>}
          </div>
        )}

        {run && <RunLaps laps={run.laps} />}

        {plan?.skip_reason && (
          <div className="cal-block" style={{ background: "#fef9ec", borderLeftColor: "#eed28b" }}>
            <span className="cal-block-title" style={{ color: "#7a5300" }}>
              {plan.status === "skipped" ? "📋 เหตุผลที่ข้าม" : "📋 เหตุผลที่ปรับแผน"}
            </span>
            <div style={{ fontSize: "0.82rem", color: "var(--color-ink)", marginTop: 4, lineHeight: 1.5 }}>
              {plan.skip_reason}
            </div>
          </div>
        )}

        {!run && plan && isPast && plan.status !== "skipped" && !plan.skip_reason && (
          <div className="cal-block" style={{ background: "#fef9ec", borderLeftColor: "#eed28b" }}>
            <span style={{ color: "#7a5300", fontSize: "0.82rem" }}>⚠️ ยังไม่มีบันทึกการวิ่ง</span>
          </div>
        )}

        {readiness && (
          <div className="cal-block" style={{ borderLeftColor: "var(--color-primary)", background: "var(--color-primary-soft)" }}>
            <span className="cal-block-title">💚 ความพร้อมร่างกาย</span>
            <div className="cal-data-grid">
              {readiness.recovery_percent != null && <DataRow label="ฟื้นตัว" value={`${readiness.recovery_percent}%`} />}
              {readiness.sleep_score != null && <DataRow label="คะแนนนอน" value={String(readiness.sleep_score)} />}
              {readiness.sleep_minutes != null && <DataRow label="นอน" value={`${Math.floor(readiness.sleep_minutes / 60)}h ${readiness.sleep_minutes % 60}m`} />}
              {readiness.hrv_avg_ms != null && <DataRow label="HRV" value={`${readiness.hrv_avg_ms} ms`} />}
              {readiness.resting_hr_bpm != null && <DataRow label="HR พัก" value={`${readiness.resting_hr_bpm} bpm`} />}
            </div>
            {readiness.recommendation && (
              <div className="cal-note-line" style={{ marginTop: 8, borderTop: "1px solid var(--color-line)", paddingTop: 6 }}>{thaiText(readiness.recommendation)}</div>
            )}
            {readiness.tags && readiness.tags.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {readiness.tags.map((tag) => (
                  <span key={tag} style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: 10, background: "rgba(58,169,158,0.15)", color: "var(--color-ink)" }}>{thaiText(tag)}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!plan && !run && !readiness && (
          <div style={{ textAlign: "center", padding: "28px 0", color: "var(--color-muted)" }}>ไม่มีข้อมูลสำหรับวันนี้</div>
        )}
      </div>
    </div>
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
