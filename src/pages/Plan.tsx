import { Activity, CalendarCheck, CheckCircle2, Clock3, Flag, Footprints, Gauge, HeartPulse, Trophy } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, TrainingPlan } from "../types";
import { latest } from "../utils/data";
import { km, minutes, pace, percent, raceTime, sessionLabel } from "../utils/format";
import { thaiText } from "../utils/thaiText";

const B_RACE_DATE = "2026-07-19";
const A_RACE_DATE = "2026-12-06";
const TARGET_MINUTES = 80;

const PHASES = [
  { label: "Pre-race", sub: "มิ.ย.–ก.ค.", from: "2026-06-11", to: "2026-07-19" },
  { label: "Phase A", sub: "Recovery", from: "2026-07-20", to: "2026-08-01" },
  { label: "Phase B", sub: "Base Rebuild", from: "2026-08-03", to: "2026-09-05" },
  { label: "Phase C", sub: "Threshold", from: "2026-09-07", to: "2026-10-10" },
  { label: "Phase D", sub: "Race-Specific", from: "2026-10-12", to: "2026-11-14" },
  { label: "Phase E", sub: "Taper", from: "2026-11-16", to: "2026-12-06" },
];

function phaseFor(date: string) {
  return PHASES.find((p) => date >= p.from && date <= p.to) ?? null;
}

function groupByPhase(rows: TrainingPlan[]) {
  const groups: { label: string; sub: string; items: TrainingPlan[] }[] = [];
  for (const row of rows) {
    const phase = phaseFor(row.plan_date);
    const label = phase?.label ?? "อื่น ๆ";
    const sub = phase?.sub ?? "";
    const last = groups.at(-1);
    if (last?.label === label) {
      last.items.push(row);
    } else {
      groups.push({ label, sub, items: [row] });
    }
  }
  return groups;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function statusTone(status: TrainingPlan["status"]): "neutral" | "good" | "warn" | "hot" {
  if (status === "done") return "good";
  if (status === "adjusted") return "warn";
  if (status === "skipped") return "hot";
  return "neutral";
}

function readinessTone(status: string | null): "neutral" | "good" | "warn" | "hot" {
  const text = thaiText(status).toLowerCase();
  if (text.includes("green") || text.includes("เขียว") || text.includes("ดี") || text.includes("ทำ")) return "good";
  if (text.includes("yellow") || text.includes("เหลือง") || text.includes("ระวัง")) return "warn";
  if (text.includes("red") || text.includes("แดง") || text.includes("พัก")) return "hot";
  return "neutral";
}

function priorityLabel(priority: TrainingPlan["priority"]) {
  if (priority === "race") return "วันแข่ง";
  if (priority === "high") return "สำคัญ";
  if (priority === "low") return "เบา";
  return "ปกติ";
}

function statusLabel(status: TrainingPlan["status"]) {
  if (status === "done") return "ทำแล้ว";
  if (status === "skipped") return "ข้าม";
  if (status === "adjusted") return "ปรับแผน";
  return "ตามแผน";
}

function plannedDistance(rows: TrainingPlan[]) {
  const total = rows.reduce((sum, item) => sum + (item.target_distance_km ?? 0), 0);
  return total ? total : null;
}

function completionLabel(rows: TrainingPlan[]) {
  if (!rows.length) return "0/0";
  const completed = rows.filter((item) => item.status === "done").length;
  return `${completed}/${rows.length}`;
}

function weekProgress(rows: TrainingPlan[]) {
  if (!rows.length) return 0;
  return Math.round((rows.filter((item) => item.status === "done").length / rows.length) * 100);
}

function noteField(item: TrainingPlan | null | undefined, label: string) {
  if (!item?.notes) return null;
  const line = item.notes.split("\n").find((part) => part.trim().startsWith(`${label}:`));
  return line?.split(":").slice(1).join(":").trim() || null;
}

function workoutDetail(item: TrainingPlan | null | undefined) {
  return noteField(item, "รายการซ้อม") ?? item?.intensity ?? item?.session_type ?? null;
}

function passCriteria(item: TrainingPlan | null | undefined) {
  return noteField(item, "เกณฑ์ผ่าน");
}

function sessionMeta(item: TrainingPlan) {
  const values = [
    item.target_distance_km ? km(item.target_distance_km) : null,
    item.target_duration_min ? minutes(item.target_duration_min) : null,
    item.target_pace_sec_per_km ? pace(item.target_pace_sec_per_km) : null,
    item.planned_shoe,
  ].filter(Boolean);
  return values.join(" · ");
}

export function Plan({ data }: { data: DashboardData }) {
  const today = todayIso();
  const sortedPlan = [...data.plan].sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  const upcoming = sortedPlan.filter((item) => item.plan_date >= today);
  const scheduleRows = upcoming.length ? upcoming : sortedPlan;
  const todayPlan = upcoming.find((item) => item.plan_date === today) ?? upcoming[0] ?? latest(sortedPlan, "plan_date");
  const activeWeek = todayPlan?.week_id ?? upcoming[0]?.week_id ?? null;
  const weekPlan = activeWeek ? sortedPlan.filter((item) => item.week_id === activeWeek) : upcoming.slice(0, 7);
  const nextKeySession = upcoming.find((item) => item.priority === "high" || item.priority === "race");
  const nextRaceDate = today <= B_RACE_DATE ? B_RACE_DATE : A_RACE_DATE;
  const raceCountdown = daysUntil(nextRaceDate);
  const aRaceCountdown = daysUntil(A_RACE_DATE);
  const todayReadiness = latest(data.daily, "log_date");
  const latestRun = latest(data.runs, "run_date");
  const plannedKm = plannedDistance(weekPlan);
  const progress = weekProgress(weekPlan);
  const heroTone = readinessTone(todayReadiness?.readiness_status ?? null);
  const phaseGroups = groupByPhase(scheduleRows);

  return (
    <section className="page-stack home-dashboard">
      <div className={`home-hero ${heroTone}`}>
        <div className="home-hero-copy">
          <span className="readiness-status-badge">แผน 10K 80 นาที</span>
          <h2>{todayPlan ? sessionLabel(todayPlan.title) : "แผน 10K พร้อมเริ่ม"}</h2>
          <p>
            {todayPlan
              ? `${todayPlan.plan_date} · ${sessionLabel(todayPlan.session_type, "ซ้อม")} · ${priorityLabel(todayPlan.priority)}`
              : "เพิ่มแผนลง Supabase แล้วหน้านี้จะสรุปสิ่งที่ต้องทำถัดไปให้อัตโนมัติ"}
          </p>
          <div className="hero-action-row">
            <a href="#/today">ดูความพร้อมวันนี้</a>
            <a href="#/race">ดูกราฟวันแข่ง</a>
          </div>
        </div>

        <div className="race-countdown">
          <span>เหลือ</span>
          <strong>{raceCountdown >= 0 ? raceCountdown : 0}</strong>
          <small>{nextRaceDate === B_RACE_DATE ? "วัน B-race" : "วัน A-race"}</small>
          <i>{nextRaceDate}</i>
        </div>
      </div>

      <div className="smart-strip">
        <div>
          <span>A-race เป้าหมาย</span>
          <strong>{raceTime(TARGET_MINUTES)}</strong>
          <small>8:00/km</small>
        </div>
        <div>
          <span>พร้อมซ้อม</span>
          <strong>{todayReadiness?.recovery_percent == null ? "-" : `${todayReadiness.recovery_percent}%`}</strong>
          <small>{thaiText(todayReadiness?.readiness_status, "ยังไม่มีข้อมูล")}</small>
        </div>
        <div>
          <span>แผนสัปดาห์</span>
          <strong>{completionLabel(weekPlan)}</strong>
          <small>{activeWeek ?? "ยังไม่มีสัปดาห์"}</small>
        </div>
        <div>
          <span>A-race เหลือ</span>
          <strong>{aRaceCountdown >= 0 ? aRaceCountdown : 0}</strong>
          <small>วัน · {A_RACE_DATE}</small>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="ระยะตามแผน" value={km(plannedKm)} detail="รวมในสัปดาห์นี้" icon={Activity} />
        <MetricCard label="ความคืบหน้า" value={`${progress}%`} detail="รายการซ้อมที่ทำแล้ว" icon={CheckCircle2} tone={progress >= 60 ? "good" : "neutral"} />
        <MetricCard label="วิ่งล่าสุด" value={km(latestRun?.distance_km)} detail={latestRun ? `${pace(latestRun.pace_sec_per_km)} · Z2 ${percent(latestRun.z2_percent)}` : undefined} icon={Gauge} />
        <MetricCard label="ซ้อมสำคัญถัดไป" value={sessionLabel(nextKeySession?.session_type)} detail={nextKeySession ? `${nextKeySession.plan_date} · ${sessionLabel(nextKeySession.title)}` : undefined} icon={Trophy} tone={nextKeySession?.priority === "race" ? "hot" : "warn"} />
      </div>

      <div className="mobile-plan-stack">
        <article className={`next-session-card ${statusTone(todayPlan?.status ?? null)}`}>
          <div>
            <span>รายการถัดไป</span>
            <strong>{sessionLabel(todayPlan?.title, "ยังไม่มีแผน")}</strong>
            <p>{todayPlan ? workoutDetail(todayPlan) : "เพิ่มรายการซ้อมเพื่อเริ่มติดตาม"}</p>
          </div>
          <div className="session-pills">
            <span>
              <Activity size={14} />
              {km(todayPlan?.target_distance_km)}
            </span>
            <span>
              <Clock3 size={14} />
              {minutes(todayPlan?.target_duration_min)}
            </span>
            <span>
              <Gauge size={14} />
              {pace(todayPlan?.target_pace_sec_per_km)}
            </span>
            {todayPlan?.planned_shoe && (
              <span>
                <Footprints size={14} />
                {thaiText(todayPlan.planned_shoe)}
              </span>
            )}
          </div>
          {todayPlan && (
            <div className="plan-detail-block">
              {noteField(todayPlan, "เป้าหมายหลัก") && (
                <p>
                  <b>เป้าหมาย:</b> {noteField(todayPlan, "เป้าหมายหลัก")}
                </p>
              )}
              {passCriteria(todayPlan) && (
                <p>
                  <b>เกณฑ์ผ่าน:</b> {passCriteria(todayPlan)}
                </p>
              )}
              {todayPlan.skip_reason && (
                <p style={{ color: todayPlan.status === "skipped" ? "#9d1c37" : "#7a5300" }}>
                  <b>{todayPlan.status === "skipped" ? "ข้ามเพราะ:" : "ปรับเพราะ:"}</b> {todayPlan.skip_reason}
                </p>
              )}
              <small>{statusLabel(todayPlan.status)} · {priorityLabel(todayPlan.priority)}</small>
            </div>
          )}
        </article>

        <article className={`readiness-mini ${heroTone}`}>
          <HeartPulse size={20} />
          <div>
            <span>เช็กก่อนซ้อม</span>
            <strong>{thaiText(todayReadiness?.planned_session, "ยังไม่มีแผนวันนี้")}</strong>
            <p>{thaiText(todayReadiness?.recommendation, "ยังไม่มีคำแนะนำวันนี้")}</p>
          </div>
        </article>
      </div>

      <div className="content-grid">
        <Panel title="โฟกัสสัปดาห์นี้" subtitle={activeWeek ?? "แสดงจากแผนที่กำลังจะมาถึง"} className="span-7">
          <div className="plan-focus-grid smart-plan-grid">
            {weekPlan.slice(0, 4).map((item) => (
              <article className={`plan-focus-card ${item.priority ?? "normal"}`} key={item.id}>
                <span>{item.plan_date}</span>
                <strong>{sessionLabel(item.title)}</strong>
                <p>{workoutDetail(item)}</p>
                {passCriteria(item) && <small>{passCriteria(item)}</small>}
              </article>
            ))}
            {!weekPlan.length && <p className="run-note">ยังไม่มีแผนในฐานข้อมูล</p>}
          </div>
        </Panel>

        <Panel title="สัญญาณสำคัญ" subtitle="ดูง่ายก่อนตัดสินใจซ้อม" className="span-5">
          <div className="signal-list">
            <div>
              <CalendarCheck size={18} />
              <span>สถานะแผน</span>
              <strong>{statusLabel(todayPlan?.status ?? null)}</strong>
            </div>
            <div>
              <Flag size={18} />
              <span>ความสำคัญ</span>
              <strong>{priorityLabel(todayPlan?.priority ?? null)}</strong>
            </div>
            <div>
              <HeartPulse size={18} />
              <span>โหลดวันนี้</span>
              <strong>{todayReadiness?.load_ratio?.toFixed(2) ?? "-"}</strong>
            </div>
          </div>
        </Panel>

        <Panel title="ตารางซ้อมถัดไป" subtitle="จัดกลุ่มตาม Phase · sync จาก repo schedule" className="span-12">
          <div
            className="upcoming-training-scroll"
            style={{ maxHeight: "min(65vh, 480px)", overflowX: "auto", overflowY: "auto" }}
          >
            <div className="mobile-schedule-list">
              {phaseGroups.map(({ label, sub, items }) => (
                <div key={label}>
                  <div
                    style={{
                      padding: "6px 12px",
                      marginTop: "8px",
                      background: "var(--surface-raised, rgba(255,255,255,0.06))",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "baseline",
                      gap: "8px",
                    }}
                  >
                    <strong style={{ fontSize: "0.8rem", letterSpacing: "0.04em" }}>{label}</strong>
                    {sub && <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>{sub}</span>}
                  </div>
                  {items.map((item) => (
                    <article key={item.id}>
                      <time>{item.plan_date.slice(5)}</time>
                      <div>
                        <strong>{sessionLabel(item.title)}</strong>
                        <span>{workoutDetail(item)}</span>
                        <em>{sessionMeta(item) || "ไม่มี metric เพิ่มเติม"}</em>
                        {item.skip_reason && (
                          <em style={{
                            color: item.status === "skipped" ? "#9d1c37" : "#7a5300",
                            fontStyle: "italic",
                            fontSize: "0.72rem",
                          }}>
                            {item.status === "skipped" ? "ข้ามเพราะ: " : "ปรับเพราะ: "}{item.skip_reason}
                          </em>
                        )}
                      </div>
                      <small className={`table-status ${item.status ?? "planned"}`}>{statusLabel(item.status ?? null)}</small>
                    </article>
                  ))}
                </div>
              ))}
              {!sortedPlan.length && <p className="run-note">ยังไม่มีข้อมูลแผนซ้อม</p>}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
