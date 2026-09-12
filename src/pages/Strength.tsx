import { useEffect, useState } from "react";
import { CalendarCheck, CircleCheck, Dumbbell, Flame, ShieldCheck, TriangleAlert } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { PageSummary } from "../components/PageSummary";
import { Panel } from "../components/Panel";
import { TaperBanner } from "../components/TaperBanner";
import {
  MOVE_GROUP_LABEL,
  movesByKey,
  sessionIdFromText,
  strengthMoves,
  strengthSessions,
  type MoveGroup,
  type StrengthMove,
} from "../data/strengthMoves";
import type { DashboardData } from "../types";
import { todayIso } from "../utils/calendarDates";
import { buildTrainingContext } from "../utils/context";
import { strengthSummary, strengthWeekBuckets } from "../utils/strength";
import { strengthPanelSummary } from "../utils/summary";

const GROUPS: MoveGroup[] = ["core", "push", "pull", "posterior", "progression"];

// สลับ 2 เฟรม (start/end) แทน gif เคลื่อนไหว
function FlipImage({ frames, alt, className, onClick }: { frames: [string, string]; alt: string; className?: string; onClick?: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v === 0 ? 1 : 0)), 700);
    return () => clearInterval(id);
  }, []);
  return <img src={frames[i]} alt={alt} loading="lazy" className={className} onClick={onClick} />;
}

// ท่าที่ free-exercise-db ไม่มีรูป — ขึ้นกล่องข้อความแทน ไม่ยืมรูปท่าอื่นมาใส่
const sessionsOf = (key: string) =>
  strengthSessions
    .filter((s) => s.items.some((item) => item.key === key))
    .map((s) => s.id)
    .join(" · ") || "ท่าเสริม (ยังไม่อยู่ใน session ไหน)";

function MoveThumb({ move, className, onClick }: { move: StrengthMove; className: string; onClick?: () => void }) {
  if (!move.frames) return <span className={`${className} kb-noimg`} aria-label={`${move.name} — ไม่มีภาพ`}>ไม่มีภาพ</span>;
  return <FlipImage frames={move.frames} alt={move.name} className={className} onClick={onClick} />;
}

export function Strength({ data }: { data: DashboardData }) {
  const [safeOnly, setSafeOnly] = useState(true);
  const [zoom, setZoom] = useState<{ frames: [string, string]; name: string } | null>(null);
  // กติกาแผน: ช่วง taper งดเวททั้งหมด — ตรวจจาก training_phases อัตโนมัติ
  const ctx = buildTrainingContext(data);
  const isTaper = /taper/i.test(ctx.phase?.phase_name ?? "");

  const list = safeOnly ? strengthMoves.filter((m) => m.shinSafe) : strengthMoves;

  // strength_plan คือแผนจริงที่ sync มาจาก running-results ส่วนตาราง Session A-E
  // ข้างล่างเป็นคลังท่าแบบ static (mirror ของ rules/kettlebell-core-strength.md)
  const today = todayIso();
  const summary = strengthSummary(data.strengthPlan, today);
  const weekBars = strengthWeekBuckets(data.strengthPlan, today, 8);
  const weekRatio = summary.weekPlanned > 0 ? summary.weekDone / summary.weekPlanned : null;
  // แถวแผนเก็บชื่อชุดไว้ในคอลัมน์หมายเหตุ ("Session D — ...") จึงอ่านตัวอักษรจากตรงนั้น
  const nextSessionId = sessionIdFromText(summary.nextSession?.notes, summary.nextSession?.session_type);
  const pageSummary = strengthPanelSummary({
    weekDone: summary.weekDone,
    weekPlanned: summary.weekPlanned,
    streakWeeks: summary.streakWeeks,
    monthDone: summary.monthDone,
    nextDate: summary.nextSession?.plan_date ?? null,
    isTaper,
  });

  return (
    <section className="page-stack">
      {isTaper && <TaperBanner phaseName={ctx.phase?.phase_name ?? ""} />}

      {data.strengthPlan.length > 0 && (
        <>
          <PageSummary summary={pageSummary} />
          <div className="metric-grid">
            <MetricCard
              label="สัปดาห์นี้ทำแล้ว"
              value={`${summary.weekDone}/${summary.weekPlanned}`}
              detail={summary.weekPlanned === 0 ? "สัปดาห์นี้ไม่มีแผนเวท" : weekRatio === 1 ? "ครบตามแผนแล้ว" : "ยังเหลืออยู่"}
              icon={CircleCheck}
              tone={summary.weekPlanned === 0 ? "neutral" : weekRatio === 1 ? "good" : weekRatio != null && weekRatio >= 0.5 ? "warn" : "hot"}
            />
            <MetricCard
              label="streak สัปดาห์ที่ทำครบ"
              value={`${summary.streakWeeks} สัปดาห์`}
              detail="นับต่อเนื่องย้อนหลัง — สัปดาห์นี้ที่ยังไม่จบไม่ตัด streak"
              icon={Flame}
              tone={summary.streakWeeks >= 3 ? "good" : summary.streakWeeks > 0 ? "warn" : "neutral"}
            />
            <MetricCard
              label="เซสชันสะสมเดือนนี้"
              value={String(summary.monthDone)}
              detail={`เดือน ${today.slice(0, 7)} · นับเฉพาะที่ทำจริง`}
              icon={Dumbbell}
            />
            <MetricCard
              label="วันถัดไปที่วางแผนไว้"
              value={summary.nextSession ? summary.nextSession.plan_date.slice(5) : "-"}
              detail={summary.nextSession?.session_type ?? (summary.nextSession ? "ไม่ระบุประเภท" : "ยังไม่มีแผนข้างหน้า")}
              icon={CalendarCheck}
            />
          </div>

          <Panel
            title="ทำตามแผนไหม — 8 สัปดาห์ย้อนหลัง"
            subtitle="แท่งซ้าย = วางแผนไว้ · แท่งขวา = ทำจริง (group ตามวันที่ในแผนเป็น ISO week)"
          >
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={weekBars} margin={chartMargin}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="label" {...chartAxis} />
                <YAxis allowDecimals={false} {...chartAxis} />
                <ChartTooltip />
                <Bar dataKey="planned" fill={chartColors.grid} radius={[6, 6, 0, 0]} name="วางแผน" />
                <Bar dataKey="done" fill={chartColors.primary} radius={[6, 6, 0, 0]} name="ทำจริง" />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="signal-list">
              {[...weekBars].reverse().slice(0, 4).map((week) => (
                <div key={week.isoWeek}>
                  <Dumbbell size={16} />
                  <span>{week.isoWeek}</span>
                  <strong>
                    <span className="metric-trend good">ทำแล้ว {week.done}</span>
                    {week.skipped > 0 && <span className="metric-trend hot" style={{ marginLeft: 6 }}>ข้าม {week.skipped}</span>}
                    {week.planned - week.done - week.skipped > 0 && (
                      <span className="metric-trend neutral" style={{ marginLeft: 6 }}>
                        ค้าง {week.planned - week.done - week.skipped}
                      </span>
                    )}
                  </strong>
                </div>
              ))}
            </div>
            <p className="chart-note">
              สัปดาห์ที่ไม่มีแผนเลยจะขึ้นเป็นแท่งศูนย์ — ช่องว่างตรงนั้นคือข้อมูล ไม่ใช่ข้อมูลหาย
            </p>
          </Panel>
        </>
      )}

      {zoom && (
        <div className="kb-lightbox" role="dialog" aria-label={zoom.name} onClick={() => setZoom(null)}>
          <div className="kb-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="kb-lightbox-close" onClick={() => setZoom(null)} aria-label="ปิด" type="button">✕</button>
            <FlipImage frames={zoom.frames} alt={zoom.name} className="kb-lightbox-gif" />
            <strong className="kb-lightbox-name">{zoom.name}</strong>
          </div>
        </div>
      )}
      <Panel
        title="คลังท่า — Session A–E"
        subtitle="ท่าทั้งหมดตาม rules/kettlebell-core-strength.md · รูปจาก free-exercise-db (public domain) · กดรูปเพื่อขยาย"
      >
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
          แสดงเฉพาะท่าที่เล่นได้ระหว่างหน้าแข้งขวา OPEN
        </label>
        <p className="chart-note" style={{ marginTop: 8 }}>
          🩹 ระหว่างขาขวายัง OPEN: เล่นได้เฉพาะ Session A · C · D · E — งด Session B ทั้งชุด
          (Goblet Squat) และงด lunge / step-up / ท่ากระโดด / calf-tibialis raise แบบมีโหลด
        </p>
        <p className="chart-note">
          5 ท่า (Bird Dog · Clamshell · Wall Sit · Elevated Pike Push-up · KB Halo) ยังไม่มีภาพใน
          free-exercise-db — การ์ดจะขึ้นเป็นกล่อง “ไม่มีภาพ” พร้อมคำอธิบายท่าแทน ไม่ใช้รูปท่าอื่นมาแทน
        </p>
      </Panel>

      {/* ตารางท่าราย Session ตามแผนจริง */}
      <div className="content-grid">
        {strengthSessions.map((session) => {
          const isNext = session.id === nextSessionId;
          return (
            <Panel
              key={session.id}
              title={session.title}
              subtitle={isNext ? `📌 รอบถัดไป (${summary.nextSession?.plan_date.slice(5)}) · ${session.format}` : session.format}
              className="span-6"
            >
              {session.suspended && (
                <p className="chart-note" style={{ color: "#9d1c37", fontWeight: 700 }}>
                  <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {session.suspended}
                </p>
              )}
              <div className={`kb-day${isNext ? " today" : ""}`}>
                {session.items.map((item, i) => {
                  const move = movesByKey.get(item.key);
                  if (!move) return null;
                  return (
                    <div className="kb-day-row" key={`${item.key}-${i}`}>
                      <MoveThumb
                        move={move}
                        className="kb-day-thumb"
                        onClick={() => move.frames && setZoom({ frames: move.frames, name: move.name })}
                      />
                      <span className="kb-day-name">
                        {move.name}
                        {!move.shinSafe && <TriangleAlert size={12} style={{ marginLeft: 4, verticalAlign: "-1px", color: "#9d1c37" }} />}
                      </span>
                      <strong className="kb-day-sets">{item.dose}</strong>
                    </div>
                  );
                })}
              </div>
              {session.finisher && <p className="chart-note">{session.finisher}</p>}
            </Panel>
          );
        })}
      </div>

      {/* คลังท่าทั้งหมด */}
      {GROUPS.map((g) => {
        const items = list.filter((m) => m.group === g);
        if (!items.length) return null;
        return (
          <Panel key={g} title={`Exercise library · ${MOVE_GROUP_LABEL[g]}`} subtitle={`${items.length} ท่า`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {items.map((move) => (
                <div key={move.key} className="kb-card">
                  <MoveThumb
                    move={move}
                    className="kb-gif"
                    onClick={() => move.frames && setZoom({ frames: move.frames, name: move.name })}
                  />
                  <div className="kb-card-body">
                    <div className="kb-card-head">
                      <strong>{move.name}</strong>
                      {move.shinSafe ? (
                        <span className="kb-badge good"><ShieldCheck size={12} /> safe</span>
                      ) : (
                        <span className="kb-badge hot"><TriangleAlert size={12} /> เลี่ยง</span>
                      )}
                    </div>
                    <span className="kb-target">{move.target}</span>
                    <span className="kb-note">{move.cue}</span>
                    {move.warn && <span className="kb-note" style={{ color: "#9d1c37" }}>⚠️ {move.warn}</span>}
                    {move.imageNote && <span className="kb-note">📷 {move.imageNote}</span>}
                    <span className="kb-note">อยู่ใน: {sessionsOf(move.key)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </section>
  );
}
