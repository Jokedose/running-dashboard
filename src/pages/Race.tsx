import { Activity, Clock3, Gauge, Sparkles, Trophy } from "lucide-react";
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
import { thaiText } from "../utils/thaiText";

const B_RACE_DATE = "2026-07-19";
const B_RACE_TARGET = 87;
const A_RACE_DATE = "2026-12-06";
const A_RACE_TARGET = 80;
const CUTOFF_MINUTES = 120;

const _today = new Date().toISOString().slice(0, 10);
const RACE_DATE = _today <= B_RACE_DATE ? B_RACE_DATE : A_RACE_DATE;
const TARGET_MINUTES = _today <= B_RACE_DATE ? B_RACE_TARGET : A_RACE_TARGET;
const IS_B_RACE = RACE_DATE === B_RACE_DATE;

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
      session: thaiText(run.session_type),
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
    label: raceDate.slice(5).replace("-", "/"),
    session: "เป้าวันแข่ง",
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

function smartForecast(
  points: ActualProjectionPoint[],
  coros10kMin: number | null,
  recentRuns: RunLog[],
  daysLeft: number | null,
) {
  const repForecast = planForecast(points, daysLeft);
  if (coros10kMin == null) return repForecast;

  const recentCadences = recentRuns
    .slice(-10)
    .map((r) => r.cadence_spm)
    .filter((v): v is number => v != null);
  const avgCadence = recentCadences.length ? recentCadences.reduce((a, b) => a + b, 0) / recentCadences.length : null;
  const cadenceFactor = avgCadence == null ? 1.0
    : avgCadence >= 168 ? 0.98
    : avgCadence >= 165 ? 1.01
    : avgCadence >= 160 ? 1.03
    : 1.06;

  const recentZ2 = recentRuns
    .slice(-10)
    .map((r) => r.z2_percent)
    .filter((v): v is number => v != null);
  const avgZ2 = recentZ2.length ? recentZ2.reduce((a, b) => a + b, 0) / recentZ2.length : null;
  const z2Factor = avgZ2 == null ? 1.0
    : avgZ2 >= 85 ? 0.98
    : avgZ2 >= 75 ? 1.0
    : 1.03;

  const adjusted = coros10kMin * cadenceFactor * z2Factor;
  return repForecast == null ? adjusted : (adjusted + repForecast) / 2;
}

function finishPace(value: number | null | undefined) {
  return value == null ? "-" : pace((value * 60) / 10);
}

export function Race({ data }: { data: DashboardData }) {
  const race = data.race;
  const raceDate = race?.race_date ?? RACE_DATE;
  const daysLeft = Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000);
  const bDaysLeft = Math.ceil((new Date(B_RACE_DATE).getTime() - Date.now()) / 86400000);
  const aDaysLeft = Math.ceil((new Date(A_RACE_DATE).getTime() - Date.now()) / 86400000);
  const actualProjection = raceProjection(data.runs);
  const projection = chartProjection(actualProjection, raceDate);
  const latestPoint = actualProjection.at(-1);
  const latestExpected = projection.find((point) => point.date === latestPoint?.date)?.expected ?? null;
  const bestPoint = actualProjection.reduce<ActualProjectionPoint | null>(
    (best, point) => (!best || point.actual < best.actual ? point : best),
    null,
  );
  const coros10k = race?.coros_pred_10k_min ?? null;
  const forecast = smartForecast(actualProjection, coros10k, data.runs, daysLeft);
  const forecastDelta = forecast == null ? null : forecast - (IS_B_RACE ? CUTOFF_MINUTES : A_RACE_TARGET);
  const corosDelta = coros10k == null ? null : coros10k - B_RACE_TARGET;
  const latestGap = latestPoint && latestExpected ? latestPoint.actual - latestExpected : null;
  const targetPaceSec = (TARGET_MINUTES * 60) / 10;

  return (
    <section className="page-stack">
      <div className="race-hero-card">
        <BrandLogo />
        <div>
          <p>{IS_B_RACE ? "B-race · ความคืบหน้า 10K" : "A-race · เส้นทางสู่ 80 นาที"}</p>
          <h2>
            {IS_B_RACE
              ? `เส้นทางสู่ ${B_RACE_DATE} (เป้า 1:22–1:32)`
              : `เส้นทางสู่ ${A_RACE_DATE} (เป้า 80 นาที)`}
          </h2>
          <span>
            เส้นทึบคือสถานะจากผลซ้อมจริง ส่วนเส้นประคือเวลาที่ควรค่อย ๆ พัฒนาไปหาเป้า {raceTime(TARGET_MINUTES)}
          </span>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label={IS_B_RACE ? "นับถอยหลัง B-race" : "นับถอยหลัง A-race"}
          value={`${daysLeft > 0 ? daysLeft : 0} วัน`}
          detail={raceDate}
          icon={Clock3}
          tone="hot"
        />
        <MetricCard
          label="ความพร้อม"
          value={race?.readiness_score == null ? "-" : `${race.readiness_score}/100`}
          detail="คะแนนวันแข่ง"
          icon={Trophy}
          tone="good"
        />
        <MetricCard
          label="คาดการณ์วันแข่ง"
          value={raceTime(forecast)}
          detail={
            forecastDelta == null
              ? undefined
              : forecastDelta <= 0
              ? `เร็วกว่าเป้า ${Math.abs(forecastDelta).toFixed(1)} นาที`
              : `ช้ากว่าเป้า ${forecastDelta.toFixed(1)} นาที`
          }
          icon={Activity}
          tone={forecastDelta != null && forecastDelta <= 0 ? "good" : "warn"}
        />
        <MetricCard
          label="ตำแหน่งล่าสุด"
          value={raceTime(latestPoint?.actual)}
          detail={latestPoint ? `${finishPace(latestPoint.actual)} · ${latestPoint.date}` : undefined}
          icon={Gauge}
        />
      </div>

      {(coros10k != null || race?.vo2max != null) && (
        <div className="metric-grid">
          <MetricCard
            label="VO2max (COROS)"
            value={race?.vo2max == null ? "-" : race.vo2max.toFixed(0)}
            detail={race?.coros_running_level == null ? undefined : `Running level ${race.coros_running_level.toFixed(0)}`}
            icon={Sparkles}
            tone="good"
          />
          <MetricCard
            label="COROS 10K prediction"
            value={raceTime(coros10k)}
            detail={corosDelta == null ? undefined : corosDelta <= 0 ? `เกินเป้า A ${Math.abs(corosDelta).toFixed(1)} นาที` : `ช้ากว่าเป้า A ${corosDelta.toFixed(1)} นาที`}
            icon={Trophy}
            tone={corosDelta != null && corosDelta <= 0 ? "good" : "warn"}
          />
          <MetricCard
            label="Threshold pace"
            value={race?.coros_threshold_pace_sec_per_km == null ? "-" : pace(race.coros_threshold_pace_sec_per_km)}
            detail="จาก COROS fitness assessment"
            icon={Activity}
          />
          <MetricCard
            label="5K prediction"
            value={raceTime(race?.coros_pred_5k_min ?? null)}
            detail="วัดความเร็วระยะสั้น"
            icon={Clock3}
          />
        </div>
      )}

      {IS_B_RACE && aDaysLeft > 0 && (
        <div className="smart-strip">
          <div>
            <span>B-race เหลือ</span>
            <strong>{bDaysLeft > 0 ? bDaysLeft : 0}</strong>
            <small>วัน · {B_RACE_DATE}</small>
          </div>
          <div>
            <span>A-race เหลือ</span>
            <strong>{aDaysLeft}</strong>
            <small>วัน · {A_RACE_DATE}</small>
          </div>
          <div>
            <span>เป้า B-race</span>
            <strong>{raceTime(B_RACE_TARGET)}</strong>
            <small>1:22–1:32</small>
          </div>
          <div>
            <span>เป้า A-race</span>
            <strong>{raceTime(A_RACE_TARGET)}</strong>
            <small>8:00/km</small>
          </div>
        </div>
      )}

      <div className="content-grid">
        <Panel
          title={`กราฟเป้าหมาย 10K · ${IS_B_RACE ? "B-race" : "A-race"}`}
          subtitle="เปรียบเทียบสถานะจริงกับเส้นพัฒนาที่ควรเป็นจนถึงวันแข่ง"
          className="span-12 race-panel"
        >
          <div className="race-stat-grid">
            <div>
              <span>สถานะล่าสุด</span>
              <strong>{raceTime(latestPoint?.actual)}</strong>
              <small>{latestPoint ? `${latestPoint.distance.toFixed(2)} km · ${latestPoint.session}` : "-"}</small>
            </div>
            <div>
              <span>ควรอยู่แถวนี้</span>
              <strong>{raceTime(latestExpected)}</strong>
              <small>
                {latestGap == null
                  ? "-"
                  : latestGap > 0
                  ? `ยังช้ากว่าเส้นแผน ${latestGap.toFixed(1)} นาที`
                  : `เร็วกว่าเส้นแผน ${Math.abs(latestGap).toFixed(1)} นาที`}
              </small>
            </div>
            <div>
              <span>เพซปัจจุบัน</span>
              <strong>{finishPace(latestPoint?.actual)}</strong>
              <small>ถ้าคงความรู้สึกหนักนี้ถึง 10K</small>
            </div>
            <div>
              <span>เพซเป้าหมาย</span>
              <strong>{pace(targetPaceSec)}</strong>
              <small>{raceTime(TARGET_MINUTES)} สำหรับ 10K</small>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={projection} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis
                domain={[TARGET_MINUTES - 10, "dataMax + 10"]}
                tickFormatter={(value) => raceTime(Number(value)).slice(0, 4)}
                {...chartAxis}
              />
              <ChartTooltip
                formatter={(value, name) => [raceTime(Number(value)), name]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as ProjectionPoint | undefined;
                  return point ? `${point.date} · ${point.session} · ${point.distance.toFixed(2)} km` : "";
                }}
              />
              <ReferenceLine
                y={TARGET_MINUTES}
                stroke={chartColors.primary}
                strokeDasharray="6 6"
                label={raceTime(TARGET_MINUTES).slice(0, 4)}
              />
              {IS_B_RACE && (
                <ReferenceLine
                  y={CUTOFF_MINUTES}
                  stroke={chartColors.accent}
                  strokeDasharray="6 6"
                  label="เส้นตัดตัว 2:00"
                />
              )}
              <Line
                type="monotone"
                dataKey="expected"
                name="เส้นพัฒนาที่ควรเป็น"
                stroke={chartColors.blue}
                strokeWidth={3}
                strokeDasharray="8 8"
                dot={false}
              />
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
            เส้นทึบคำนวณจากเพซของรายการซ้อมที่ระยะอย่างน้อย 4 km แล้วปรับด้วยระยะ, Z2 และการไหลของหัวใจ
            ส่วนเส้นประเป็นเส้นเป้าหมายที่ค่อย ๆ ลดเวลาจบไปสู่ {raceTime(TARGET_MINUTES)} ในวันแข่ง
          </p>
        </Panel>

        <Panel title="แนวทางตัดสินใจวันแข่ง" subtitle="แนวทางวันแข่ง" className="span-12">
          <div className="coach-card race-decision">
            <p>{thaiText(race?.race_decision)}</p>
          </div>
        </Panel>
        <ListPanel title="จุดแข็ง" items={(race?.strengths ?? []).map((item) => thaiText(item))} className="span-6 good-list" />
        <ListPanel title="ความเสี่ยง" items={(race?.risks ?? []).map((item) => thaiText(item))} className="span-6 warn-list" />
      </div>
    </section>
  );
}
