import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DailyReadiness, StrengthPlan } from "../types";
import { thaiText } from "../utils/thaiText";
import { MONTHS_TH, WEEKDAYS_SHORT, addDays, monthGrid, todayIso, weekDates } from "../utils/calendarDates";

type ViewMode = "month" | "week";

export type StrengthDayData = { date: string; plans: StrengthPlan[]; readiness: DailyReadiness | null };
type DayData = StrengthDayData;

export function strengthTypeColor(type: string | null | undefined): { bg: string; border: string; text: string } {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("kb") || t.includes("kettlebell")) return { bg: "#ede9fe", border: "#7c3aed", text: "#5b21b6" };
  if (t.includes("core")) return { bg: "#e0f2fe", border: "#0369a1", text: "#075985" };
  return { bg: "#f3f4f6", border: "#6b7280", text: "#374151" };
}

// สีตาม status เดียวกับปฏิทินวิ่ง (Calendar.tsx: statusDot/statusLabel)
export function strengthStatusDot(status: StrengthPlan["status"]): { char: string; color: string } {
  if (status === "done") return { char: "✓", color: "#1a6847" };
  if (status === "skipped") return { char: "✗", color: "#9d1c37" };
  return { char: "·", color: "#668086" };
}

function statusLabel(status: StrengthPlan["status"]) {
  if (status === "done") return "ทำแล้ว";
  if (status === "skipped") return "ข้าม";
  return "ตามแผน";
}

// planned_moves / actual_moves เขียนเป็นข้อความเดียว คั่นแต่ละท่าด้วย " · "
function splitMoves(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
}

export function StrengthCalendar({ plans, daily }: { plans: StrengthPlan[]; daily: DailyReadiness[] }) {
  const today = todayIso();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [navDate, setNavDate] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);

  const planByDate = useMemo(() => {
    const map = new Map<string, StrengthPlan[]>();
    for (const p of plans) {
      const arr = map.get(p.plan_date) ?? [];
      arr.push(p);
      map.set(p.plan_date, arr);
    }
    return map;
  }, [plans]);

  const readinessByDate = useMemo(() => {
    const map = new Map<string, DailyReadiness>();
    for (const d of daily) map.set(d.log_date, d);
    return map;
  }, [daily]);

  function dayData(date: string): DayData {
    return { date, plans: planByDate.get(date) ?? [], readiness: readinessByDate.get(date) ?? null };
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

  const monthPrefix = `${navYear}-${String(navMonth).padStart(2, "0")}`;
  const adherence = useMemo(() => {
    const rows = plans.filter((p) => p.plan_date.startsWith(monthPrefix));
    const done = rows.filter((p) => p.status === "done").length;
    return { done, total: rows.length };
  }, [plans, monthPrefix]);

  return (
    <div className="cal-sub">
      <strong className="cal-column-title">🏋️ Strength</strong>
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

      <p className="cal-adherence">
        {adherence.total > 0
          ? <>ทำแล้ว <strong>{adherence.done}/{adherence.total}</strong> เดือนนี้ ({Math.round((adherence.done / adherence.total) * 100)}%)</>
          : "ยังไม่มีแผนเดือนนี้"}
      </p>

      {viewMode === "month"
        ? (
          <div className="cal-month-grid">
            <div className="cal-month-header">
              {WEEKDAYS_SHORT.map((d) => <div key={d} className="cal-month-header-cell">{d}</div>)}
            </div>
            <div className="cal-month-body">
              {grid.map((date, idx) =>
                date
                  ? <StrengthDayCell key={date} dd={dayData(date)} isToday={date === today} isPast={date < today} onSelect={setSelected} />
                  : <div key={`e-${idx}`} className="cal-day-cell cal-day-empty" />
              )}
            </div>
          </div>
        )
        : <StrengthWeekView dates={weekDays} dayData={dayData} today={today} onSelect={setSelected} />}

      <div className="cal-legend">
        {[
          { color: "#1a6847", label: "ทำแล้ว" },
          { color: "#9d1c37", label: "ข้าม" },
          { color: "#668086", label: "ตามแผน" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="cal-legend-dot" style={{ background: color }} />{label}
          </span>
        ))}
      </div>

      {selected && selectedDay && <StrengthDayModal day={selectedDay} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StrengthDayCell({ dd, isToday, isPast, onSelect }: {
  dd: DayData; isToday: boolean; isPast: boolean; onSelect: (d: string) => void;
}) {
  const dayNum = parseInt(dd.date.slice(8));
  const hasContent = dd.plans.length > 0;

  return (
    <div
      className={`cal-day-cell${hasContent ? " cal-day-clickable" : ""}${isToday ? " cal-day-today" : ""}${isPast && !isToday ? " cal-day-past" : ""}`}
      onClick={() => hasContent && onSelect(dd.date)}
    >
      <div className="cal-day-top">
        <span className="cal-day-num">{dayNum}</span>
        {dd.readiness?.recovery_percent != null && (
          <span className="cal-recov-tiny">{dd.readiness.recovery_percent}%</span>
        )}
      </div>
      <div className="cal-chips">
        {dd.plans.slice(0, 2).map((p) => {
          const c = strengthTypeColor(p.session_type);
          const dot = strengthStatusDot(p.status);
          return (
            <div key={p.id} className="cal-chip" style={{ background: c.bg, borderLeftColor: c.border }}>
              <span className="cal-chip-dot" style={{ color: dot.color }}>{dot.char}</span>
              <span className="cal-chip-text" style={{ color: c.text }}>{(p.session_type ?? "-").slice(0, 11)}</span>
            </div>
          );
        })}
        {dd.plans.length > 2 && <span className="cal-chip-more">+{dd.plans.length - 2}</span>}
      </div>
    </div>
  );
}

function StrengthWeekView({ dates, dayData, today, onSelect }: {
  dates: string[]; dayData: (d: string) => DayData; today: string; onSelect: (d: string) => void;
}) {
  return (
    <div className="cal-week-grid">
      {dates.map((date) => {
        const dd = dayData(date);
        const isToday = date === today;
        const isPast = date < today;
        const hasContent = dd.plans.length > 0;
        const dowIdx = (new Date(date).getDay() + 6) % 7;

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
                const c = strengthTypeColor(p.session_type);
                const dot = strengthStatusDot(p.status);
                const firstMove = splitMoves(p.planned_moves)[0];
                return (
                  <div key={p.id} className="cal-week-session" style={{
                    background: p.status === "done" ? "#d8eee5" : p.status === "skipped" ? "#fee2e8" : c.bg,
                    borderLeftColor: c.border,
                  }}>
                    <div className="cal-week-session-title">
                      <span style={{ color: dot.color, fontWeight: 750 }}>{dot.char}</span>
                      <span style={{ color: "var(--color-ink)" }}>{p.session_type ?? "Strength"}</span>
                    </div>
                    {firstMove && <div className="cal-week-session-meta">{firstMove}</div>}
                  </div>
                );
              })}
              {dd.readiness?.recovery_percent != null && (
                <div className="cal-week-readiness">💚 {dd.readiness.recovery_percent}%{dd.readiness.hrv_avg_ms != null ? ` · HRV ${dd.readiness.hrv_avg_ms}` : ""}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StrengthDayModal({ day, onClose }: { day: DayData; onClose: () => void }) {
  const { date, plans } = day;
  const plan = plans[0] ?? null;
  const plannedMoves = splitMoves(plan?.planned_moves);
  const actualMoves = splitMoves(plan?.actual_moves);

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <strong style={{ fontSize: "1rem", color: "var(--color-ink)" }}>{date}</strong>
            {plan && (() => { const c = strengthTypeColor(plan.session_type); return (
              <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text }}>{plan.session_type ?? "Strength"}</span>
            ); })()}
          </div>
          <button className="cal-modal-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {plan && (
          <div className="cal-block" style={{ borderLeftColor: strengthTypeColor(plan.session_type).border }}>
            <div className="cal-block-head">
              <strong>{plan.session_type ?? "Strength"}</strong>
              <span className="cal-status-pill" data-status={plan.status ?? "planned"}>{statusLabel(plan.status)}</span>
            </div>
            {plannedMoves.length > 0 && (
              <div className="cal-note-line">
                <b>แผน:</b>
                <ol className="clean-list" style={{ marginTop: 4 }}>
                  {plannedMoves.map((move, i) => <li key={i}>{move}</li>)}
                </ol>
              </div>
            )}
          </div>
        )}

        {plan && actualMoves.length > 0 && (
          <div className="cal-block" style={{ borderLeftColor: "#add9c9", background: "#f0faf5" }}>
            <span className="cal-block-title">📊 ทำจริง</span>
            <ol className="clean-list" style={{ marginTop: 4 }}>
              {actualMoves.map((move, i) => <li key={i}>{move}</li>)}
            </ol>
          </div>
        )}

        {plan && plan.status !== "skipped" && plan.status !== "planned" && actualMoves.length === 0 && (
          <div className="cal-block" style={{ background: "#fef9ec", borderLeftColor: "#eed28b" }}>
            <span style={{ color: "#7a5300", fontSize: "0.82rem" }}>⚠️ ยังไม่มีบันทึกท่าที่ทำจริง</span>
          </div>
        )}

        {plan?.notes && (
          <div className="cal-block" style={{ background: "#fef9ec", borderLeftColor: "#eed28b" }}>
            <span className="cal-block-title" style={{ color: "#7a5300" }}>📋 หมายเหตุ</span>
            <div style={{ fontSize: "0.82rem", color: "var(--color-ink)", marginTop: 4, lineHeight: 1.5 }}>
              {thaiText(plan.notes)}
            </div>
          </div>
        )}

        {!plan && (
          <div style={{ textAlign: "center", padding: "28px 0", color: "var(--color-muted)" }}>ไม่มีข้อมูลสำหรับวันนี้</div>
        )}
      </div>
    </div>
  );
}
