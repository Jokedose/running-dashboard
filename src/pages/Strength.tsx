import { useEffect, useState } from "react";
import { CalendarCheck, CircleCheck, Dumbbell, Flame, ShieldCheck, TriangleAlert } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { TaperBanner } from "../components/TaperBanner";
import { KB_GROUP_LABEL, kbExercises, kbRoutine, type KbGroup } from "../data/kbExercises";
import type { DashboardData } from "../types";
import { todayIso } from "../utils/calendarDates";
import { buildTrainingContext } from "../utils/context";
import { strengthSummary, strengthWeekBuckets } from "../utils/strength";

const GROUPS: KbGroup[] = ["power", "upper", "core", "stability"];
const framesByName = new Map(kbExercises.map((e) => [e.name, e.frames]));
const safeByName = new Map(kbExercises.map((e) => [e.name, e.injurySafe]));

// สลับ 2 เฟรม (start/end) แทน gif เคลื่อนไหว
function FlipImage({ frames, alt, className, onClick }: { frames: [string, string]; alt: string; className?: string; onClick?: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v === 0 ? 1 : 0)), 700);
    return () => clearInterval(id);
  }, []);
  return <img src={frames[i]} alt={alt} loading="lazy" className={className} onClick={onClick} />;
}

export function Strength({ data }: { data: DashboardData }) {
  const [safeOnly, setSafeOnly] = useState(true);
  const [zoom, setZoom] = useState<{ frames: [string, string]; name: string } | null>(null);
  const todayWeekday = new Date().getDay(); // 0=อา 1=จ ...
  // กติกาแผน: ช่วง taper งดเวททั้งหมด — ตรวจจาก training_phases อัตโนมัติ
  const ctx = buildTrainingContext(data);
  const isTaper = /taper/i.test(ctx.phase?.phase_name ?? "");

  const list = safeOnly ? kbExercises.filter((e) => e.injurySafe) : kbExercises;

  // strength_plan คือแผนจริงที่ sync มาจาก running-results ส่วน kbRoutine ข้างล่าง
  // เป็นคลังท่าแบบ static — หน้านี้เคยมีแต่คลังท่า จึงตอบไม่ได้ว่า "ทำจริงไหม"
  const today = todayIso();
  const summary = strengthSummary(data.strengthPlan, today);
  const weekBars = strengthWeekBuckets(data.strengthPlan, today, 8);
  const weekRatio = summary.weekPlanned > 0 ? summary.weekDone / summary.weekPlanned : null;

  return (
    <section className="page-stack">
      {isTaper && <TaperBanner phaseName={ctx.phase?.phase_name ?? ""} />}

      {data.strengthPlan.length > 0 && (
        <>
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
        title="Kettlebell (8kg) — daily plan + exercises"
        subtitle="แผน KB แต่ละวัน + คลังท่า (gif) · injury-safe = ทำได้ช่วงขาเจ็บ"
      >
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
          คลังท่า: แสดงเฉพาะที่ปลอดภัยช่วงขาเจ็บ (ซ่อนท่าลงขากระแทก)
        </label>
        <p className="chart-note" style={{ marginTop: 8 }}>
          🩹 ช่วงฟื้น shin: เลี่ยง thruster / pistol / lunge — เน้น press, row, swing, TGU, goblet
        </p>
      </Panel>

      {/* ตาราง KB รายวัน */}
      <div className="content-grid">
        {kbRoutine.map((d) => {
          const isToday = d.weekday === todayWeekday;
          return (
            <Panel
              key={d.weekday}
              title={`${d.day} · ${d.label}`}
              subtitle={isToday ? "📌 วันนี้" : `${d.items.length} ท่า`}
              className="span-6"
            >
              <div className={`kb-day${isToday ? " today" : ""}`}>
                {d.items.map((it, i) => {
                  const safe = safeByName.get(it.name);
                  return (
                    <div className="kb-day-row" key={`${it.name}-${i}`}>
                      <FlipImage frames={framesByName.get(it.name) ?? ["", ""]} alt={it.name} className="kb-day-thumb" onClick={() => setZoom({ frames: framesByName.get(it.name) ?? ["", ""], name: it.name })} />
                      <span className="kb-day-name">
                        {it.name}
                        {safe === false && <TriangleAlert size={12} style={{ marginLeft: 4, verticalAlign: "-1px", color: "#9d1c37" }} />}
                      </span>
                      <strong className="kb-day-sets">{it.sets}</strong>
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* คลังท่าทั้งหมด */}
      {GROUPS.map((g) => {
        const items = list.filter((e) => e.group === g);
        if (!items.length) return null;
        return (
          <Panel key={g} title={`Exercise library · ${KB_GROUP_LABEL[g]}`} subtitle={`${items.length} ท่า`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {items.map((ex) => (
                <div key={ex.name} className="kb-card">
                  <FlipImage frames={ex.frames} alt={ex.name} className="kb-gif" onClick={() => setZoom({ frames: ex.frames, name: ex.name })} />
                  <div className="kb-card-body">
                    <div className="kb-card-head">
                      <strong>{ex.name}</strong>
                      {ex.injurySafe ? (
                        <span className="kb-badge good"><ShieldCheck size={12} /> safe</span>
                      ) : (
                        <span className="kb-badge hot"><TriangleAlert size={12} /> เลี่ยง</span>
                      )}
                    </div>
                    <span className="kb-target">{ex.target}</span>
                    <span className="kb-note">{ex.note}</span>
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
