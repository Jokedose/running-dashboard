import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DailyReadiness, DashboardData, RunLog, TrainingPlan } from "../types";
import { km, minutes, pace, percent } from "../utils/format";
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

function sessionTypeColor(type: string | null | undefined): string {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("long") || t.includes("ยาว")) return "#8b5cf6";
  if (t.includes("tempo") || t.includes("threshold") || t.includes("interval") || t.includes("quality")) return "#f97316";
  if (t.includes("easy") || t.includes("recovery") || t.includes("เบา") || t.includes("ฟื้น")) return "#3b82f6";
  if (t.includes("race") || t.includes("แข่ง")) return "#f59e0b";
  if (t.includes("rest") || t.includes("off") || t.includes("พัก")) return "#6b7280";
  return "#64748b";
}

function statusDot(status: TrainingPlan["status"] | null): { char: string; color: string } {
  if (status === "done") return { char: "✓", color: "#22c55e" };
  if (status === "skipped") return { char: "✗", color: "#ef4444" };
  if (status === "adjusted") return { char: "~", color: "#fbbf24" };
  return { char: "·", color: "#94a3b8" };
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

const navBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, borderRadius: 6,
  border: "1px solid var(--border, rgba(255,255,255,0.12))",
  cursor: "pointer", background: "transparent", color: "inherit",
};

// ─── Main export ────────────────────────────────────────────────────────────
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
    return {
      date,
      plans: planByDate.get(date) ?? [],
      run: runByDate.get(date) ?? null,
      readiness: readinessByDate.get(date) ?? null,
    };
  }

  const navYear = parseInt(navDate.slice(0, 4));
  const navMonth = parseInt(navDate.slice(5, 7));

  function prevPeriod() {
    if (viewMode === "month") {
      const d = new Date(navYear, navMonth - 2, 1);
      setNavDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    } else {
      setNavDate(addDays(navDate, -7));
    }
  }
  function nextPeriod() {
    if (viewMode === "month") {
      const d = new Date(navYear, navMonth, 1);
      setNavDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    } else {
      setNavDate(addDays(navDate, 7));
    }
  }

  const grid = useMemo(() => monthGrid(navYear, navMonth), [navYear, navMonth]);
  const weekDays = useMemo(() => weekDates(navDate), [navDate]);
  const selectedDay = selected ? dayData(selected) : null;

  const periodLabel =
    viewMode === "month"
      ? `${MONTHS_TH[navMonth - 1]} ${navYear}`
      : `${weekDays[0].slice(5).replace("-", "/")} – ${weekDays[6].slice(5).replace("-", "/")}`;

  return (
    <section className="page-stack">
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{
          display: "flex", borderRadius: 8, overflow: "hidden",
          border: "1px solid var(--border, rgba(255,255,255,0.12))",
        }}>
          {(["month", "week"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "5px 16px", border: "none", cursor: "pointer", fontSize: "0.83rem",
                background: viewMode === mode ? "var(--accent, #3b82f6)" : "transparent",
                color: viewMode === mode ? "#fff" : "inherit",
                fontFamily: "inherit",
              }}
            >
              {mode === "month" ? "เดือน" : "สัปดาห์"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <button onClick={prevPeriod} style={navBtnStyle}><ChevronLeft size={16} /></button>
          <strong style={{ minWidth: 150, textAlign: "center", fontSize: "0.88rem" }}>{periodLabel}</strong>
          <button onClick={nextPeriod} style={navBtnStyle}><ChevronRight size={16} /></button>
          <button
            onClick={() => setNavDate(today)}
            style={{
              padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem",
              border: "1px solid var(--border, rgba(255,255,255,0.12))",
              background: "transparent", color: "inherit", fontFamily: "inherit",
            }}
          >วันนี้</button>
        </div>
      </div>

      {/* View */}
      {viewMode === "month" ? (
        <MonthView grid={grid} dayData={dayData} today={today} onSelect={setSelected} />
      ) : (
        <WeekView dates={weekDays} dayData={dayData} today={today} onSelect={setSelected} />
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.73rem", opacity: 0.65 }}>
        {[
          { color: "#22c55e", label: "ทำแล้ว" },
          { color: "#fbbf24", label: "ปรับแผน" },
          { color: "#ef4444", label: "ข้าม" },
          { color: "#3b82f6", label: "วิ่งเบา/ฟื้นตัว" },
          { color: "#8b5cf6", label: "วิ่งยาว" },
          { color: "#f97316", label: "คุณภาพ/เทมโป" },
          { color: "#f59e0b", label: "วันแข่ง" },
          { color: "#6366f1", label: "วิ่งนอกแผน" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>

      {/* Modal */}
      {selected && selectedDay && (
        <DayModal day={selectedDay} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

// ─── Month grid ──────────────────────────────────────────────────────────────
function MonthView({
  grid, dayData, today, onSelect,
}: {
  grid: (string | null)[];
  dayData: (d: string) => DayData;
  today: string;
  onSelect: (d: string) => void;
}) {
  return (
    <div style={{
      background: "var(--surface, rgba(255,255,255,0.03))",
      borderRadius: 12, overflow: "hidden",
      border: "1px solid var(--border, rgba(255,255,255,0.08))",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: "0.73rem", fontWeight: 600, opacity: 0.55 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {grid.map((date, idx) =>
          date ? (
            <DayCell key={date} dd={dayData(date)} isToday={date === today} isPast={date < today} onSelect={onSelect} />
          ) : (
            <div key={`empty-${idx}`} style={{
              minHeight: 80,
              borderRight: "1px solid var(--border, rgba(255,255,255,0.05))",
              borderBottom: "1px solid var(--border, rgba(255,255,255,0.05))",
              background: "rgba(0,0,0,0.08)",
            }} />
          )
        )}
      </div>
    </div>
  );
}

function DayCell({
  dd, isToday, isPast, onSelect,
}: {
  dd: DayData;
  isToday: boolean;
  isPast: boolean;
  onSelect: (d: string) => void;
}) {
  const dayNum = parseInt(dd.date.slice(8));
  const hasContent = dd.plans.length > 0 || dd.run !== null;
  const hasReadiness = dd.readiness !== null;

  return (
    <div
      onClick={() => hasContent && onSelect(dd.date)}
      style={{
        minHeight: 80, padding: "5px 5px 4px",
        borderRight: "1px solid var(--border, rgba(255,255,255,0.05))",
        borderBottom: "1px solid var(--border, rgba(255,255,255,0.05))",
        cursor: hasContent ? "pointer" : "default",
        background: isToday
          ? "rgba(59,130,246,0.1)"
          : isPast
          ? "rgba(0,0,0,0.12)"
          : "transparent",
        transition: "background 0.12s",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 20, height: 20, borderRadius: "50%", fontSize: "0.75rem",
          background: isToday ? "#3b82f6" : "transparent",
          color: isToday ? "#fff" : isPast ? "rgba(255,255,255,0.45)" : "inherit",
          fontWeight: isToday ? 700 : 400,
        }}>{dayNum}</span>
        {hasReadiness && (
          <span style={{ fontSize: "0.6rem", opacity: 0.5 }}>
            {dd.readiness!.recovery_percent != null ? `${dd.readiness!.recovery_percent}%` : "💚"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {dd.plans.slice(0, 2).map((p) => {
          const dot = statusDot(p.status);
          const color = sessionTypeColor(p.session_type);
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 2,
              background: p.status === "done"
                ? "rgba(34,197,94,0.18)"
                : p.status === "skipped"
                ? "rgba(239,68,68,0.13)"
                : p.status === "adjusted"
                ? "rgba(251,191,36,0.14)"
                : `${color}1e`,
              borderLeft: `2px solid ${color}`,
              borderRadius: "0 3px 3px 0",
              padding: "1px 3px",
              fontSize: "0.63rem",
              overflow: "hidden",
            }}>
              <span style={{ color: dot.color, fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>{dot.char}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {thaiText(p.title).slice(0, 11)}
              </span>
            </div>
          );
        })}
        {dd.plans.length > 2 && (
          <span style={{ fontSize: "0.6rem", opacity: 0.45 }}>+{dd.plans.length - 2} อื่น</span>
        )}
        {dd.run && dd.plans.length === 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "rgba(99,102,241,0.18)", borderLeft: "2px solid #6366f1",
            borderRadius: "0 3px 3px 0", padding: "1px 3px", fontSize: "0.63rem",
          }}>
            🏃 {dd.run.distance_km?.toFixed(1)}km
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Week view ───────────────────────────────────────────────────────────────
function WeekView({
  dates, dayData, today, onSelect,
}: {
  dates: string[];
  dayData: (d: string) => DayData;
  today: string;
  onSelect: (d: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
      {dates.map((date) => {
        const dd = dayData(date);
        const isToday = date === today;
        const isPast = date < today;
        const dayNum = parseInt(date.slice(8));
        const dowIdx = (new Date(date).getDay() + 6) % 7;
        const hasContent = dd.plans.length > 0 || dd.run !== null;
        return (
          <div
            key={date}
            onClick={() => hasContent && onSelect(date)}
            style={{
              background: isToday
                ? "rgba(59,130,246,0.1)"
                : isPast
                ? "var(--surface, rgba(255,255,255,0.02))"
                : "var(--surface, rgba(255,255,255,0.04))",
              border: isToday
                ? "1px solid rgba(59,130,246,0.45)"
                : "1px solid var(--border, rgba(255,255,255,0.08))",
              borderRadius: 8, padding: "8px 7px 10px",
              cursor: hasContent ? "pointer" : "default",
              minHeight: 110,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: "0.7rem", opacity: 0.55 }}>{WEEKDAYS_SHORT[dowIdx]}</span>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 23, height: 23, borderRadius: "50%", fontSize: "0.8rem",
                background: isToday ? "#3b82f6" : "transparent",
                color: isToday ? "#fff" : "inherit", fontWeight: isToday ? 700 : 500,
              }}>{dayNum}</span>
            </div>

            {dd.plans.map((p) => {
              const color = sessionTypeColor(p.session_type);
              const dot = statusDot(p.status);
              return (
                <div key={p.id} style={{
                  marginBottom: 4, padding: "4px 6px",
                  background: p.status === "done"
                    ? "rgba(34,197,94,0.13)"
                    : p.status === "skipped"
                    ? "rgba(239,68,68,0.1)"
                    : p.status === "adjusted"
                    ? "rgba(251,191,36,0.11)"
                    : `${color}18`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: "0 5px 5px 0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.73rem" }}>
                    <span style={{ color: dot.color, fontWeight: 700, flexShrink: 0 }}>{dot.char}</span>
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {thaiText(p.title)}
                    </span>
                  </div>
                  {p.target_distance_km && (
                    <div style={{ fontSize: "0.65rem", opacity: 0.65, marginTop: 1 }}>{p.target_distance_km.toFixed(1)} km</div>
                  )}
                </div>
              );
            })}

            {dd.run && dd.plans.length === 0 && (
              <div style={{
                padding: "4px 6px", marginBottom: 4,
                background: "rgba(99,102,241,0.14)", borderLeft: "3px solid #6366f1",
                borderRadius: "0 5px 5px 0", fontSize: "0.73rem",
              }}>
                <div style={{ fontWeight: 600 }}>วิ่งนอกแผน</div>
                <div style={{ fontSize: "0.65rem", opacity: 0.65, marginTop: 1 }}>{dd.run.distance_km?.toFixed(1)} km</div>
              </div>
            )}

            {dd.readiness && (
              <div style={{ marginTop: 6, fontSize: "0.63rem", opacity: 0.55, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {dd.readiness.recovery_percent != null && (
                  <span>💚 {dd.readiness.recovery_percent}%</span>
                )}
                {dd.readiness.hrv_avg_ms != null && (
                  <span>HRV {dd.readiness.hrv_avg_ms}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day detail modal ────────────────────────────────────────────────────────
function DayModal({ day, onClose }: { day: DayData; onClose: () => void }) {
  const { date, plans, run, readiness } = day;
  const plan = plans[0] ?? null;
  const today = todayIso();
  const isPastWithoutRun = !run && plan && date < today && plan.status !== "skipped";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1200,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-raised, #1e293b)",
          borderRadius: "16px 16px 0 0",
          padding: "18px 18px 36px",
          width: "100%", maxWidth: 580,
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 -6px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <strong style={{ fontSize: "1rem" }}>{date}</strong>
            {plan && (
              <span style={{
                marginLeft: 8, fontSize: "0.78rem", opacity: 0.65,
                padding: "2px 7px", borderRadius: 4,
                background: `${sessionTypeColor(plan.session_type)}28`,
                color: sessionTypeColor(plan.session_type),
              }}>{thaiText(plan.session_type)}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "inherit" }}>
            <X size={20} />
          </button>
        </div>

        {/* Plan block */}
        {plan && (
          <div style={{
            marginBottom: 14, padding: "12px 14px",
            background: "rgba(255,255,255,0.04)", borderRadius: 10,
            borderLeft: `3px solid ${sessionTypeColor(plan.session_type)}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: "0.9rem" }}>{thaiText(plan.title)}</strong>
              <span style={{
                marginLeft: "auto", fontSize: "0.73rem",
                padding: "2px 8px", borderRadius: 4,
                background: plan.status === "done"
                  ? "rgba(34,197,94,0.18)"
                  : plan.status === "skipped"
                  ? "rgba(239,68,68,0.15)"
                  : plan.status === "adjusted"
                  ? "rgba(251,191,36,0.15)"
                  : "rgba(255,255,255,0.07)",
                color: statusDot(plan.status).color,
                fontWeight: 600,
              }}>
                {statusLabel(plan.status)}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 20px", fontSize: "0.8rem" }}>
              {plan.target_distance_km != null && <DataRow label="ระยะเป้า" value={km(plan.target_distance_km)} />}
              {plan.target_duration_min != null && <DataRow label="เวลาเป้า" value={minutes(plan.target_duration_min)} />}
              {plan.target_pace_sec_per_km != null && <DataRow label="เพซเป้า" value={pace(plan.target_pace_sec_per_km)} />}
              {plan.planned_shoe && <DataRow label="รองเท้าแผน" value={thaiText(plan.planned_shoe)} />}
              {plan.priority && <DataRow label="ความสำคัญ" value={priorityLabel(plan.priority)} />}
              {plan.intensity && <DataRow label="ความหนัก" value={plan.intensity} />}
            </div>
            {noteField(plan.notes, "รายการซ้อม") && (
              <div style={{ marginTop: 8, fontSize: "0.77rem", opacity: 0.75 }}>
                <span style={{ opacity: 0.6 }}>รายการ: </span>{noteField(plan.notes, "รายการซ้อม")}
              </div>
            )}
            {noteField(plan.notes, "เป้าหมายหลัก") && (
              <div style={{ marginTop: 4, fontSize: "0.77rem", opacity: 0.75 }}>
                <span style={{ opacity: 0.6 }}>เป้าหมาย: </span>{noteField(plan.notes, "เป้าหมายหลัก")}
              </div>
            )}
            {noteField(plan.notes, "เกณฑ์ผ่าน") && (
              <div style={{ marginTop: 4, fontSize: "0.77rem", opacity: 0.75 }}>
                <span style={{ opacity: 0.6 }}>เกณฑ์ผ่าน: </span>{noteField(plan.notes, "เกณฑ์ผ่าน")}
              </div>
            )}
          </div>
        )}

        {/* Extra sessions */}
        {plans.length > 1 && plans.slice(1).map((p) => (
          <div key={p.id} style={{
            marginBottom: 10, padding: "8px 12px",
            background: "rgba(255,255,255,0.03)", borderRadius: 8,
            borderLeft: `3px solid ${sessionTypeColor(p.session_type)}`,
            fontSize: "0.8rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: statusDot(p.status).color, fontWeight: 700 }}>{statusDot(p.status).char}</span>
              <strong>{thaiText(p.title)}</strong>
              <span style={{ marginLeft: "auto", opacity: 0.6 }}>{statusLabel(p.status)}</span>
            </div>
          </div>
        ))}

        {/* Actual run block */}
        {run && (
          <div style={{
            marginBottom: 14, padding: "12px 14px",
            background: "rgba(34,197,94,0.06)", borderRadius: 10,
            borderLeft: "3px solid #22c55e",
          }}>
            <strong style={{ fontSize: "0.85rem", marginBottom: 8, display: "block" }}>📊 ผลจริง</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 20px", fontSize: "0.8rem" }}>
              {run.distance_km != null && <DataRow label="ระยะจริง" value={km(run.distance_km)} />}
              {run.duration_min != null && <DataRow label="เวลาจริง" value={minutes(run.duration_min)} />}
              {run.pace_sec_per_km != null && <DataRow label="เพซจริง" value={pace(run.pace_sec_per_km)} />}
              {run.avg_hr_bpm != null && <DataRow label="ชีพจรเฉลี่ย" value={`${run.avg_hr_bpm.toFixed(0)} bpm`} />}
              {run.z2_percent != null && <DataRow label="Zone 2" value={percent(run.z2_percent)} />}
              {run.rpe && <DataRow label="RPE" value={thaiText(run.rpe)} />}
              {run.shoe_slug && <DataRow label="รองเท้าจริง" value={thaiText(run.shoe_slug)} />}
              {run.pain && run.pain !== "none" && <DataRow label="อาการเจ็บ" value={thaiText(run.pain)} />}
            </div>
            {plan?.target_distance_km != null && run.distance_km != null && (
              <div style={{ marginTop: 8, fontSize: "0.77rem" }}>
                <span style={{ opacity: 0.6 }}>เทียบแผน: </span>
                <span style={{
                  color: Math.abs(run.distance_km - plan.target_distance_km) <= 0.5 ? "#22c55e" : "#fbbf24",
                  fontWeight: 600,
                }}>
                  {run.distance_km >= plan.target_distance_km ? "+" : ""}
                  {(run.distance_km - plan.target_distance_km).toFixed(2)} km
                </span>
              </div>
            )}
            {run.note && (
              <div style={{ marginTop: 6, fontSize: "0.77rem", opacity: 0.7, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 6 }}>
                {run.note}
              </div>
            )}
          </div>
        )}

        {/* Past plan without run warning */}
        {isPastWithoutRun && (
          <div style={{
            marginBottom: 14, padding: "10px 14px",
            background: "rgba(251,191,36,0.07)", borderRadius: 10,
            borderLeft: "3px solid #fbbf24", fontSize: "0.8rem", opacity: 0.85,
          }}>
            ⚠️ ยังไม่มีบันทึกการวิ่งสำหรับวันนี้
          </div>
        )}

        {/* Readiness block */}
        {readiness && (
          <div style={{
            padding: "12px 14px",
            background: "rgba(99,102,241,0.06)", borderRadius: 10,
            borderLeft: "3px solid #6366f1",
          }}>
            <strong style={{ fontSize: "0.85rem", marginBottom: 8, display: "block" }}>💚 ความพร้อมร่างกาย</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 20px", fontSize: "0.8rem" }}>
              {readiness.recovery_percent != null && <DataRow label="ฟื้นตัว" value={`${readiness.recovery_percent}%`} />}
              {readiness.sleep_score != null && <DataRow label="คะแนนนอน" value={String(readiness.sleep_score)} />}
              {readiness.sleep_minutes != null && (
                <DataRow
                  label="ชั่วโมงนอน"
                  value={`${Math.floor(readiness.sleep_minutes / 60)}h ${readiness.sleep_minutes % 60}m`}
                />
              )}
              {readiness.hrv_avg_ms != null && <DataRow label="HRV" value={`${readiness.hrv_avg_ms} ms`} />}
              {readiness.resting_hr_bpm != null && <DataRow label="HR พัก" value={`${readiness.resting_hr_bpm} bpm`} />}
              {readiness.load_ratio != null && <DataRow label="Load ratio" value={readiness.load_ratio.toFixed(2)} />}
            </div>
            {readiness.recommendation && (
              <div style={{ marginTop: 8, fontSize: "0.77rem", opacity: 0.75, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 6 }}>
                {thaiText(readiness.recommendation)}
              </div>
            )}
            {readiness.tags && readiness.tags.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {readiness.tags.map((tag) => (
                  <span key={tag} style={{
                    fontSize: "0.68rem", padding: "2px 7px", borderRadius: 10,
                    background: "rgba(255,255,255,0.08)",
                  }}>{thaiText(tag)}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!plan && !run && !readiness && (
          <div style={{ textAlign: "center", padding: "28px 0", opacity: 0.45, fontSize: "0.85rem" }}>ไม่มีข้อมูลสำหรับวันนี้</div>
        )}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
      <span style={{ opacity: 0.55, flexShrink: 0, fontSize: "0.75rem" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
