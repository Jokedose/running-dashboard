import { Activity, Clock3, Gauge, Timer } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import type { DashboardData } from "../types";
import { km, minutes, pace, percent } from "../utils/format";
import { thaiText } from "../utils/thaiText";

export function Activities({ data }: { data: DashboardData }) {
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const totalDuration = data.runs.reduce((sum, run) => sum + (run.duration_min ?? 0), 0);
  const avgPaceSeconds = totalDistance > 0 && totalDuration > 0 ? (totalDuration * 60) / totalDistance : null;
  const totalActivities = data.runs.length;

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="กิจกรรมทั้งหมด" value={String(totalActivities)} detail="รายการที่บันทึกไว้" icon={Activity} />
        <MetricCard label="เวลารวมทั้งหมด" value={minutes(totalDuration || null)} detail="รวมเวลาที่ใช้ทุกกิจกรรม" icon={Timer} tone="good" />
        <MetricCard label="ระยะรวม" value={km(totalDistance || null)} detail="รวมจากบันทึกวิ่งทั้งหมด" icon={Gauge} />
        <MetricCard label="เพซเฉลี่ยรวม" value={pace(avgPaceSeconds)} detail="คำนวณจากเวลารวมและระยะรวม" icon={Clock3} />
      </div>

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
