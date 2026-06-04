import { Activity, Clock3, Gauge, Trophy } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { BrandLogo } from "../components/BrandLogo";
import { ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { ListPanel, Panel } from "../components/Panel";
import { MetricCard } from "../components/MetricCard";
import type { DashboardData, RunLog } from "../types";
import { pace, raceTime, shortDate } from "../utils/format";

const RACE_DATE = "2026-07-19";
const TARGET_MINUTES = 90;
const CUTOFF_MINUTES = 120;

type ProjectionPoint = {
  date: string;
  label: string;
  session: string;
  distance: number;
  actual: number | null;
  expected: number;
  target: number;
  cutoff: number;
};

type ActualProjectionPoint = Omit<ProjectionPoint, "expected"> & {
  actual: number;
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
  const bestByDate = new Map<string, ActualProjectionPoint>();
  runs.forEach((run) => {
    const estimate = estimate10kMinutes(run);
    if (estimate == null || !run.run_date || !run.distance_km) return;
    const current = bestByDate.get(run.run_date);
    const next = {
      date: run.run_date,
      label: shortDate(run.run_date),
      session: run.session_type ?? "-",
      distance: run.distance_km,
      actual: Number(estimate.toFixed(1)),
      target: TARGET_MINUTES,
      cutoff: CUTOFF_MINUTES,
    };
    if (!current || next.distance > current.distance || next.actual < current.actual) {
      bestByDate.set(run.run_date, next);
    }
  });
  return [...bestByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function expectedAt(date: string, startDate: string, startValue: number, raceDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(raceDate).getTime();
  const current = new Date(date).getTime();
  const progress = end === start ? 1 : Math.max(0, Math.min(1, (current - start) / (end - start)));
  return startValue + (TARGET_MINUTES - startValue) * progress;
}

function chartProjection(points: ActualProjectionPoint[], raceDate: string) {
  if (!points.length) return [];
  const startDate = points[0].date;
  const startValue = Math.max(points[0].actual, CUTOFF_MINUTES);
  const rows: ProjectionPoint[] = points.map((point) => ({
    ...point,
    expected: Number(expectedAt(point.date, startDate, startValue, raceDate).toFixed(1)),
  }));
  rows.push({
    date: raceDate,
    label: "19/07",
    session: "Race day target",
    distance: 10,
    actual: null,
    expected: TARGET_MINUTES,
    target: TARGET_MINUTES,
    cutoff: CUTOFF_MINUTES,
  });
  return rows;
}

function planForecast(points: ActualProjectionPoint[], daysLeft: number | null) {
  if (!points.length) return null;
  const longOrRecent = points.filter((point) => point.distance >= 8 || point.date >= "2026-04-01");
  const baseline = Math.min(...(longOrRecent.length ? longOrRecent : points).map((point) => point.actual));
  const weeksLeft = daysLeft == null ? 0 : Math.max(0, daysLeft / 7);
  const expectedGain = Math.min(8, weeksLeft * 0.8);
  return Math.max(TARGET_MINUTES, baseline - expectedGain);
}

function finishPace(value: number | null | undefined) {
  return value == null ? "-" : pace((value * 60) / 10);
}

export function Race({ data }: { data: DashboardData }) {
  const race = data.race;
  const raceDate = race?.race_date ?? RACE_DATE;
  const daysLeft = Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000);
  const actualProjection = raceProjection(data.runs);
  const projection = chartProjection(actualProjection, raceDate);
  const latestPoint = actualProjection.at(-1);
  const latestExpected = projection.find((point) => point.date === latestPoint?.date)?.expected ?? null;
  const bestPoint = actualProjection.reduce<ActualProjectionPoint | null>(
    (best, point) => (!best || point.actual < best.actual ? point : best),
    null,
  );
  const forecast = planForecast(actualProjection, daysLeft);
  const forecastDelta = forecast == null ? null : forecast - CUTOFF_MINUTES;
  const latestGap = latestPoint && latestExpected ? latestPoint.actual - latestExpected : null;

  return (
    <section className="page-stack">
      <div className="race-hero-card">
        <BrandLogo />
        <div>
          <p>10K Race Progress</p>
          <h2>เส้นทางสู่วันที่ 19 กรกฎาคม</h2>
          <span>เส้นทึบคือสถานะจากผลซ้อมจริง ส่วนเส้นประคือ pace/เวลาที่ควรค่อย ๆ พัฒนาไปหาเป้า 1:30</span>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="Countdown" value={`${daysLeft} วัน`} detail={raceDate} icon={Clock3} tone="hot" />
        <MetricCard label="Readiness" value={race?.readiness_score == null ? "-" : `${race.readiness_score}/100`} detail="race score" icon={Trophy} tone="good" />
        <MetricCard label="คาดการณ์วันแข่ง" value={raceTime(forecast)} detail={forecastDelta == null ? undefined : forecastDelta <= 0 ? `เร็วกว่า cutoff ${Math.abs(forecastDelta).toFixed(1)} นาที` : `ช้ากว่า cutoff ${forecastDelta.toFixed(1)} นาที`} icon={Activity} tone={forecastDelta != null && forecastDelta <= 0 ? "good" : "warn"} />
        <MetricCard label="ตำแหน่งล่าสุด" value={raceTime(latestPoint?.actual)} detail={latestPoint ? `${finishPace(latestPoint.actual)} · ${latestPoint.date}` : undefined} icon={Gauge} />
      </div>

      <div className="content-grid">
        <Panel title="กราฟเป้าหมาย 10K" subtitle="เปรียบเทียบสถานะจริงกับเส้นพัฒนาที่ควรเป็นจนถึงวันแข่ง" className="span-12 race-panel">
          <div className="race-stat-grid">
            <div>
              <span>สถานะล่าสุด</span>
              <strong>{raceTime(latestPoint?.actual)}</strong>
              <small>{latestPoint ? `${latestPoint.distance.toFixed(2)} km · ${latestPoint.session}` : "-"}</small>
            </div>
            <div>
              <span>ควรอยู่แถวนี้</span>
              <strong>{raceTime(latestExpected)}</strong>
              <small>{latestGap == null ? "-" : latestGap > 0 ? `ยังช้ากว่าเส้นแผน ${latestGap.toFixed(1)} นาที` : `เร็วกว่าเส้นแผน ${Math.abs(latestGap).toFixed(1)} นาที`}</small>
            </div>
            <div>
              <span>pace ปัจจุบัน</span>
              <strong>{finishPace(latestPoint?.actual)}</strong>
              <small>ถ้าคง effort นี้ถึง 10K</small>
            </div>
            <div>
              <span>pace เป้าหมาย</span>
              <strong>9:00/km</strong>
              <small>1:30:00 สำหรับ 10K</small>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={projection} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis domain={[80, "dataMax + 10"]} tickFormatter={(value) => raceTime(Number(value)).slice(0, 4)} {...chartAxis} />
              <ChartTooltip
                formatter={(value, name) => [raceTime(Number(value)), name]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as ProjectionPoint | undefined;
                  return point ? `${point.date} · ${point.session} · ${point.distance.toFixed(2)} km` : "";
                }}
              />
              <ReferenceLine y={TARGET_MINUTES} stroke={chartColors.primary} strokeDasharray="6 6" label="1:30" />
              <ReferenceLine y={CUTOFF_MINUTES} stroke={chartColors.accent} strokeDasharray="6 6" label="2:00 cutoff" />
              <Line type="monotone" dataKey="expected" name="เส้นพัฒนาที่ควรเป็น" stroke={chartColors.blue} strokeWidth={3} strokeDasharray="8 8" dot={false} />
              <Line
                type="monotone"
                dataKey="actual"
                name="สถานะจริงจากผลซ้อม"
                stroke={chartColors.ink}
                strokeWidth={3.5}
                dot={{ r: 4, fill: chartColors.ink, strokeWidth: 0 }}
                activeDot={{ r: 7, strokeWidth: 0 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="chart-note">
            เส้นทึบคำนวณจาก pace ของ session ที่ระยะอย่างน้อย 4 km แล้วปรับด้วยระยะ, Z2 และ drift ส่วนเส้นประเป็นเส้นเป้าหมายที่ค่อย ๆ ลดเวลาจบไปสู่ 1:30:00 ในวันแข่ง
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
