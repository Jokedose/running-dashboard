import type { DashboardData } from "../types";
import { km, pace, percent } from "../utils/format";
import { thaiText } from "../utils/thaiText";

export function Activities({ data }: { data: DashboardData }) {
  return (
    <section className="table-panel">
      <div className="panel-head">
        <div>
          <h2>บันทึกวิ่ง</h2>
          <p>รายการวิ่งล่าสุด เรียงจากใหม่ไปเก่า</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ประเภท</th>
              <th>ระยะ</th>
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
    </section>
  );
}
