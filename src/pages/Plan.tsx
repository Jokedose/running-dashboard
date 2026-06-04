import { Activity, CalendarCheck, Clock3, Flag, Footprints, Gauge } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, TrainingPlan } from "../types";
import { latest } from "../utils/data";
import { km, minutes, pace } from "../utils/format";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(status: TrainingPlan["status"]): "neutral" | "good" | "warn" | "hot" {
  if (status === "done") return "good";
  if (status === "adjusted") return "warn";
  if (status === "skipped") return "hot";
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

function planDistance(rows: TrainingPlan[]) {
  const total = rows.reduce((sum, item) => sum + (item.target_distance_km ?? 0), 0);
  return total ? total : null;
}

export function Plan({ data }: { data: DashboardData }) {
  const today = todayIso();
  const sortedPlan = [...data.plan].sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  const upcoming = sortedPlan.filter((item) => item.plan_date >= today);
  const todayPlan = upcoming.find((item) => item.plan_date === today) ?? upcoming[0] ?? latest(sortedPlan, "plan_date");
  const activeWeek = todayPlan?.week_id ?? upcoming[0]?.week_id ?? null;
  const weekPlan = activeWeek ? sortedPlan.filter((item) => item.week_id === activeWeek) : upcoming.slice(0, 7);
  const nextKeySession = upcoming.find((item) => item.priority === "high" || item.priority === "race");
  const plannedKm = planDistance(weekPlan);
  const completed = weekPlan.filter((item) => item.status === "done").length;

  return (
    <section className="page-stack">
      <div className={`plan-hero ${statusTone(todayPlan?.status ?? null)}`}>
        <div>
          <span className="readiness-status-badge">แผนหลัก</span>
          <h2>{todayPlan?.title ?? "ยังไม่มีแผนในฐานข้อมูล"}</h2>
          <p>
            {todayPlan
              ? `${todayPlan.plan_date} · ${todayPlan.session_type ?? "ซ้อม"} · ${priorityLabel(todayPlan.priority)}`
              : "สร้างตาราง training_plan แล้วเพิ่มแผน เพื่อให้หน้านี้เป็นศูนย์กลางของสัปดาห์"}
          </p>
        </div>
        <div className="plan-hero-metrics">
          <span>{km(todayPlan?.target_distance_km)}</span>
          <span>{minutes(todayPlan?.target_duration_min)}</span>
          <span>{pace(todayPlan?.target_pace_sec_per_km)}</span>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="แผนสัปดาห์นี้" value={activeWeek ?? "-"} detail={`${weekPlan.length} รายการซ้อม`} icon={CalendarCheck} />
        <MetricCard label="ระยะตามแผน" value={km(plannedKm)} detail="รวมในสัปดาห์ที่เลือก" icon={Activity} />
        <MetricCard label="ทำแล้ว" value={`${completed}/${weekPlan.length || 0}`} detail="รายการซ้อมที่เสร็จแล้ว" icon={Flag} tone={completed ? "good" : "neutral"} />
        <MetricCard
          label="ซ้อมสำคัญถัดไป"
          value={nextKeySession?.session_type ?? "-"}
          detail={nextKeySession ? `${nextKeySession.plan_date} · ${nextKeySession.title}` : undefined}
          icon={Gauge}
          tone={nextKeySession?.priority === "race" ? "hot" : "warn"}
        />
      </div>

      <div className="content-grid">
        <Panel title="วันนี้ / รายการถัดไป" subtitle={todayPlan?.plan_date ?? "ยังไม่มีข้อมูลใน training_plan"} className="span-5">
          <div className="latest-run">
            <strong>{todayPlan?.title ?? "-"}</strong>
            <div className="mini-metrics">
              <span>{todayPlan?.session_type ?? "-"}</span>
              <span>{km(todayPlan?.target_distance_km)}</span>
              <span>{minutes(todayPlan?.target_duration_min)}</span>
              <span>{pace(todayPlan?.target_pace_sec_per_km)}</span>
            </div>
            <div className="chip-row">
              <span>ความหนัก: {todayPlan?.intensity ?? "-"}</span>
              <span>ความสำคัญ: {priorityLabel(todayPlan?.priority ?? null)}</span>
              <span>สถานะ: {statusLabel(todayPlan?.status ?? null)}</span>
              {todayPlan?.planned_shoe && (
                <span>
                  <Footprints size={14} /> {todayPlan.planned_shoe}
                </span>
              )}
            </div>
            {todayPlan?.notes && <p className="run-note">{todayPlan.notes}</p>}
          </div>
        </Panel>

        <Panel title="จุดเน้นของสัปดาห์" subtitle={activeWeek ?? "แสดงจากแผนที่กำลังจะมาถึง"} className="span-7">
          <div className="plan-focus-grid">
            {weekPlan.slice(0, 4).map((item) => (
              <article className={`plan-focus-card ${item.priority ?? "normal"}`} key={item.id}>
                <span>{item.plan_date}</span>
                <strong>{item.title}</strong>
                <p>{item.notes ?? item.session_type ?? "-"}</p>
              </article>
            ))}
            {!weekPlan.length && <p className="run-note">ยังไม่มีแผนในฐานข้อมูล</p>}
          </div>
        </Panel>

        <Panel title="ตารางซ้อมถัดไป" subtitle="อ่านจากตาราง training_plan ใน Supabase" className="span-12">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>แผน</th>
                  <th>ระยะ</th>
                  <th>เวลา</th>
                  <th>เพซ</th>
                  <th>รองเท้า</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {(upcoming.length ? upcoming : sortedPlan).slice(0, 14).map((item) => (
                  <tr key={item.id}>
                    <td>{item.plan_date}</td>
                    <td>{item.session_type ?? "-"}</td>
                    <td>{item.title}</td>
                    <td>{km(item.target_distance_km)}</td>
                    <td>{minutes(item.target_duration_min)}</td>
                    <td>{pace(item.target_pace_sec_per_km)}</td>
                    <td>{item.planned_shoe ?? "-"}</td>
                    <td>
                      <span className={`table-status ${item.status ?? "planned"}`}>{statusLabel(item.status ?? null)}</span>
                    </td>
                  </tr>
                ))}
                {!sortedPlan.length && (
                  <tr>
                    <td colSpan={8}>ยังไม่มีข้อมูลแผนซ้อม</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  );
}
