import { Activity, Clock3, Gauge, Trophy } from "lucide-react";
import { ListPanel, Panel } from "../components/Panel";
import { MetricCard } from "../components/MetricCard";
import type { DashboardData } from "../types";
import { km, pace } from "../utils/format";

export function Race({ data }: { data: DashboardData }) {
  const race = data.race;
  const daysLeft = race ? Math.ceil((new Date(race.race_date).getTime() - Date.now()) / 86400000) : null;
  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="Countdown" value={daysLeft == null ? "-" : `${daysLeft} วัน`} detail={race?.race_date} icon={Clock3} tone="hot" />
        <MetricCard label="Readiness" value={race?.readiness_score == null ? "-" : `${race.readiness_score}/100`} detail="race score" icon={Trophy} tone="good" />
        <MetricCard label="Long runs" value={race?.long_runs == null ? "-" : String(race.long_runs)} detail={`longest ${km(race?.longest_distance_km)}`} icon={Activity} />
        <MetricCard label="Quality logs" value={race?.quality_logs == null ? "-" : String(race.quality_logs)} detail={`fastest ${pace(race?.fastest_quality_pace_sec_per_km)}`} icon={Gauge} />
      </div>

      <div className="content-grid">
        <Panel title="Race decision" subtitle="แนวทางวันแข่ง" className="span-12">
          <div className="coach-card race-decision">
            <p>{race?.race_decision ?? "-"}</p>
          </div>
        </Panel>
        <ListPanel title="จุดแข็ง" items={race?.strengths ?? []} className="span-6 good-list" />
        <ListPanel title="ความเสี่ยง" items={race?.risks ?? []} className="span-6 warn-list" />
      </div>
    </section>
  );
}
