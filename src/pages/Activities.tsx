import { Activity, AlertCircle, Clock3, Gauge, Timer } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, RunLog } from "../types";
import { km, minutes, pace, percent } from "../utils/format";
import { thaiText } from "../utils/thaiText";

function painLevel(pain: string | null): "none" | "mild" | "moderate" | "high" {
  if (!pain) return "none";
  const p = pain.toLowerCase();
  if (p.includes("ไม่มี") || p.includes("หาย") || p.includes("none") || p === "-") return "none";
  const match = p.match(/(\d+)\s*\/\s*10/);
  if (match) {
    const n = parseInt(match[1]);
    if (n >= 7) return "high";
    if (n >= 4) return "moderate";
    return "mild";
  }
  if (p.includes("ตึง") || p.includes("เจ็บ") || p.includes("ปวด")) return "mild";
  return "none";
}

function painColor(level: ReturnType<typeof painLevel>): string {
  switch (level) {
    case "high": return "#9d1c37";
    case "moderate": return "#c2410c";
    case "mild": return "#b45309";
    default: return "#d8eee5";
  }
}

function painText(level: ReturnType<typeof painLevel>): string {
  switch (level) {
    case "high": return "หนัก";
    case "moderate": return "ปานกลาง";
    case "mild": return "เบา";
    default: return "OK";
  }
}

export function Activities({ data }: { data: DashboardData }) {
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const totalDuration = data.runs.reduce((sum, run) => sum + (run.duration_min ?? 0), 0);
  const avgPaceSeconds = totalDistance > 0 && totalDuration > 0 ? (totalDuration * 60) / totalDistance : null;
  const totalActivities = data.runs.length;
  const recentPain = data.runs.slice(-30).map((run: RunLog) => ({
    date: run.run_date,
    level: painLevel(run.pain),
    pain: run.pain,
    session: run.session_type,
  }));
  const painCount = recentPain.filter((p) => p.level !== "none").length;

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="กิจกรรมทั้งหมด" value={String(totalActivities)} detail="รายการที่บันทึกไว้" icon={Activity} />
        <MetricCard label="เวลารวมทั้งหมด" value={minutes(totalDuration || null)} detail="รวมเวลาที่ใช้ทุกกิจกรรม" icon={Timer} tone="good" />
        <MetricCard label="ระยะรวม" value={km(totalDistance || null)} detail="รวมจากบันทึกวิ่งทั้งหมด" icon={Gauge} />
        <MetricCard label="เพซเฉลี่ยรวม" value={pace(avgPaceSeconds)} detail="คำนวณจากเวลารวมและระยะรวม" icon={Clock3} />
      </div>

      <Panel title="Pain / soreness timeline" subtitle={`30 ครั้งล่าสุด · มีอาการ ${painCount} ครั้ง`}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {recentPain.map((p) => (
            <div key={p.date} title={`${p.date} · ${p.session ?? ""} · ${p.pain ?? "ไม่มี"}`}
              style={{
                width: 24, height: 24, borderRadius: 5,
                background: painColor(p.level),
                border: "1px solid var(--color-line-soft)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {p.level !== "none" && <AlertCircle size={12} color="#fff" />}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: "0.75rem", color: "var(--color-muted)" }}>
          {(["none", "mild", "moderate", "high"] as const).map((lvl) => (
            <span key={lvl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: painColor(lvl), display: "inline-block" }} />
              {painText(lvl)}
            </span>
          ))}
        </div>
      </Panel>

      <div className="table-panel">
        <div className="panel-head">
          <div>
            <h2>บันทึกกิจกรรม</h2>
            <p>รายการวิ่งล่าสุด เรียงจากใหม่ไปเก่า พร้อมเวลาที่ใช้แต่ละครั้ง</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ประเภท</th>
                <th>ระยะ</th>
                <th>เวลา</th>
                <th>เพซ</th>
                <th>ชีพจร</th>
                <th>Z2</th>
                <th>การไหล</th>
                <th>Cadence</th>
                <th>รองเท้า</th>
              </tr>
            </thead>
            <tbody>
              {[...data.runs].reverse().map((run) => (
                <tr key={run.id}>
                  <td>{run.run_date}</td>
                  <td>{thaiText(run.session_type)}</td>
                  <td>{km(run.distance_km)}</td>
                  <td>{minutes(run.duration_min)}</td>
                  <td>{pace(run.pace_sec_per_km)}</td>
                  <td>{run.avg_hr_bpm?.toFixed(1) ?? "-"} bpm</td>
                  <td>{percent(run.z2_percent)}</td>
                  <td>{run.drift_bpm?.toFixed(1) ?? "-"} bpm</td>
                  <td style={{ color: run.cadence_spm != null && run.cadence_spm < 168 ? "#c2410c" : undefined }}>
                    {run.cadence_spm?.toFixed(0) ?? "-"} spm
                  </td>
                  <td>{thaiText(run.shoe_slug)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
