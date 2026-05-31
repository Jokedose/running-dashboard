import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { latest } from "../utils/data";
import { km, minutes } from "../utils/format";

export function Weekly({ data }: { data: DashboardData }) {
  const week = latest(data.weekly, "week_id");
  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="สัปดาห์ล่าสุด" value={week?.week_id ?? "-"} icon={CalendarDays} />
        <MetricCard label="ระยะรวม" value={km(week?.total_distance_km)} icon={Activity} />
        <MetricCard label="เวลารวม" value={minutes(week?.total_duration_min)} icon={Clock3} />
        <MetricCard label="จำนวนครั้ง" value={week?.run_count == null ? "-" : String(week.run_count)} detail={`long ${week?.long_run_count ?? 0} · quality ${week?.quality_count ?? 0}`} icon={CheckCircle2} />
      </div>
      <div className="content-grid">
        <Panel title="Coach recommendation" subtitle="คำแนะนำปรับแผน" className="span-8">
          <div className="coach-card">
            {(week?.coach_recommendation ?? "-").split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Panel>
        <Panel title="Readiness issues" subtitle="ธงเตือนประจำสัปดาห์" className="span-4">
          <div className="issue-card">
            <AlertTriangle size={22} />
            <p>{week?.readiness_issues || "ไม่พบ readiness issue เพิ่มเติม"}</p>
          </div>
        </Panel>
      </div>
    </section>
  );
}
