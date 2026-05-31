import { Activity, Clock3, Gauge, Trophy } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ListPanel, Panel } from "../components/Panel";
import { MetricCard } from "../components/MetricCard";
import type { DashboardData, RunLog } from "../types";
import { chartMargin } from "../utils/data";
import { raceTime, shortDate } from "../utils/format";

const RACE_DATE = "2026-07-19";
const TARGET_MINUTES = 90;
const CUTOFF_MINUTES = 120;

type ProjectionPoint = {
  date: string;
  label: string;
  session: string;
  distance: number;
  estimate: number;
  target: number;
  cutoff: number;
};

function projectionPenalty(run: RunLog) {
  const distance = run.distance_km ?? 0;
  let penalty = 0.16;
  if (distance >= 9.5) penalty = 0;
  else if (distance >= 8) penalty = 0.03;
  else if (distance >= 6) penalty = 0.06;
  else if (distance >= 4) penalty = 0.1;

  if ((run.z2_percent ?? 0) >= 85 && (run.drift_bpm ?? 99) <= 5) penalty -= 0.02;
  if ((run.drift_bpm ?? 0) > 8) penalty += 0.04;
  return Math.max(0, penalty);
}

function estimate10kMinutes(run: RunLog) {
  if (!run.pace_sec_per_km || !run.distance_km || run.distance_km < 4) return null;
  const base = (run.pace_sec_per_km * 10) / 60;
  return base * (1 + projectionPenalty(run));
}

function raceProjection(runs: RunLog[]) {
  const bestByDate = new Map<string, ProjectionPoint>();
  runs.forEach((run) => {
    const estimate = estimate10kMinutes(run);
    if (estimate == null || !run.run_date || !run.distance_km) return;
    const current = bestByDate.get(run.run_date);
    const next = {
      date: run.run_date,
      label: shortDate(run.run_date),
      session: run.session_type ?? "-",
      distance: run.distance_km,
      estimate: Number(estimate.toFixed(1)),
      target: TARGET_MINUTES,
      cutoff: CUTOFF_MINUTES,
    };
    if (!current || next.distance > current.distance || next.estimate < current.estimate) {
      bestByDate.set(run.run_date, next);
    }
  });
  return [...bestByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function planForecast(points: ProjectionPoint[], daysLeft: number | null) {
  if (!points.length) return null;
  const longOrRecent = points.filter((point) => point.distance >= 8 || point.date >= "2026-04-01");
  const baseline = Math.min(...(longOrRecent.length ? longOrRecent : points).map((point) => point.estimate));
  const weeksLeft = daysLeft == null ? 0 : Math.max(0, daysLeft / 7);
  const expectedGain = Math.min(8, weeksLeft * 0.8);
  return Math.max(TARGET_MINUTES, baseline - expectedGain);
}

export function Race({ data }: { data: DashboardData }) {
  const race = data.race;
  const raceDate = race?.race_date ?? RACE_DATE;
  const daysLeft = Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000);
  const projection = raceProjection(data.runs);
  const latestPoint = projection.at(-1);
  const bestPoint = projection.reduce<ProjectionPoint | null>(
    (best, point) => (!best || point.estimate < best.estimate ? point : best),
    null,
  );
  const forecast = planForecast(projection, daysLeft);
  const forecastDelta = forecast == null ? null : forecast - CUTOFF_MINUTES;

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="Countdown" value={`${daysLeft} วัน`} detail={raceDate} icon={Clock3} tone="hot" />
        <MetricCard label="Readiness" value={race?.readiness_score == null ? "-" : `${race.readiness_score}/100`} detail="race score" icon={Trophy} tone="good" />
        <MetricCard label="คาดการณ์วันแข่ง" value={raceTime(forecast)} detail={forecastDelta == null ? undefined : forecastDelta <= 0 ? `เร็วกว่า cutoff ${Math.abs(forecastDelta).toFixed(1)} นาที` : `ช้ากว่า cutoff ${forecastDelta.toFixed(1)} นาที`} icon={Activity} tone={forecastDelta != null && forecastDelta <= 0 ? "good" : "warn"} />
        <MetricCard label="ตำแหน่งล่าสุด" value={raceTime(latestPoint?.estimate)} detail={latestPoint ? `${latestPoint.date} · ${latestPoint.session}` : undefined} icon={Gauge} />
      </div>

      <div className="content-grid">
        <Panel title="กราฟเป้าหมาย 10K" subtitle="เส้น projection จากผลซ้อมรายวัน เทียบเป้า 1:30 และ cutoff 2:00" className="span-12">
          <div className="race-summary-row">
            <span>ล่าสุด: {latestPoint ? `${raceTime(latestPoint.estimate)} จาก ${latestPoint.distance.toFixed(2)} km` : "-"}</span>
            <span>ดีที่สุดในข้อมูล: {bestPoint ? `${raceTime(bestPoint.estimate)} วันที่ ${bestPoint.date}` : "-"}</span>
            <span>เป้าวันแข่ง: 1:30:00 · Cutoff: 2:00:00</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={projection} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis domain={[80, "dataMax + 10"]} tickFormatter={(value) => raceTime(Number(value)).slice(0, 4)} />
              <Tooltip
                formatter={(value, name) => [raceTime(Number(value)), name]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as ProjectionPoint | undefined;
                  return point ? `${point.date} · ${point.session} · ${point.distance.toFixed(2)} km` : "";
                }}
              />
              <ReferenceLine y={TARGET_MINUTES} stroke="#2a7f62" strokeDasharray="5 5" label="1:30" />
              <ReferenceLine y={CUTOFF_MINUTES} stroke="#cf244f" strokeDasharray="5 5" label="2:00 cutoff" />
              <Line type="monotone" dataKey="estimate" name="คาดการณ์ 10K" stroke="#172026" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="chart-note">
            สูตรนี้เป็น projection จากการซ้อม ไม่ใช่ race prediction ทางการ: pace ปัจจุบันคูณ 10K แล้วเพิ่ม/ลด penalty ตามระยะซ้อม, Z2 และ drift เพื่อสะท้อนความพร้อม endurance
          </p>
        </Panel>

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
