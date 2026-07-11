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
import { km, pace, percent, raceTime, sessionLabel, shortDate } from "../utils/format";
import { classifySession, isSteadyAerobic } from "../utils/session";
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

// แผนวันแข่ง Disney Run — ปรับตาม elevation จริง (สะพานพระราม 8 ×2 + ทางยกระดับบรมราชชนนี) · เป้า A 1:30
const DISNEY_ROUTE_SPLITS: { km: number; pace: string; cum: string; note: string; phase: "climb" | "flat" | "descent" | "finish" }[] = [
  { km: 1, pace: "9:20", cum: "9:20", note: "ออกจาก S/F ขึ้นสะพานพระราม 8 — คุม ออกช้า", phase: "climb" },
  { km: 2, pace: "9:40", cum: "19:00", note: "⛰️ climb หนักสุด: สะพาน + ramp ขึ้นทางยกระดับ — วิ่งด้วย effort", phase: "climb" },
  { km: 3, pace: "8:55", cum: "27:55", note: "ขึ้นทางยกระดับแล้ว ตั้งจังหวะ goal effort", phase: "flat" },
  { km: 4, pace: "8:45", cum: "36:40", note: "ราบ ลมโล่ง", phase: "flat" },
  { km: 5, pace: "8:55", cum: "45:35", note: "เลี้ยวกลับปลายทาง (Decision gate)", phase: "flat" },
  { km: 6, pace: "8:45", cum: "54:20", note: "ขากลับบนทางยกระดับ", phase: "flat" },
  { km: 7, pace: "8:45", cum: "63:05", note: "เริ่มล้า รักษา effort", phase: "flat" },
  { km: 8, pace: "8:40", cum: "71:45", note: "⬇️ ลง ramp — ได้ pace ฟรี ปล่อยไหล ฟอร์มดี", phase: "descent" },
  { km: 9, pace: "8:55", cum: "80:40", note: "🌉 ข้ามสะพานพระราม 8 รอบ 2 (เนินเตี้ย) แล้วลง", phase: "climb" },
  { km: 10, pace: "8:40", cum: "89:20", note: "🏁 เข้าเส้น S/F", phase: "finish" },
];

function DisneyRunPacingPlan() {
  const phaseBg: Record<string, string> = { climb: "#fef3c7", flat: "#dff7f2", descent: "#dbeafe", finish: "#fee2e8" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-line)" }}>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>Km</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>Pace</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>สะสม</th>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>โน้ต</th>
          </tr>
        </thead>
        <tbody>
          {DISNEY_ROUTE_SPLITS.map((r) => (
            <tr key={r.km} style={{ borderBottom: "1px solid var(--color-line-soft)" }}>
              <td style={{ padding: "8px 6px", fontWeight: 650 }}>
                <span style={{ background: phaseBg[r.phase], padding: "2px 8px", borderRadius: 4 }}>{r.km}</span>
              </td>
              <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{r.pace}</td>
              <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{r.cum}</td>
              <td style={{ padding: "8px 6px", fontSize: "0.8rem" }}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: "0.82rem", color: "var(--color-muted)" }}>
        <div>⏱ รวม ≈ <b style={{ color: "var(--color-ink)" }}>1:29:20</b> (buffer 40 วิ ใต้ 1:30) · เฉลี่ย ~8:56/km</div>
        <div>🌙 Gun start 04:00 น. = เย็นสุดของวัน ไม่มีแดด — heat ไม่ใช่ปัญหาใหญ่ แต่ชื้น จิบน้ำทุกจุด</div>
        <div>⛰ <b style={{ color: "var(--color-ink)" }}>climb อยู่ต้นเกม (กม.1-2)</b> ช้า/หนัก = ปกติ อย่าเร่งชด · ทุนอยู่ทางยกระดับ + descent กม.8</div>
        <div>🚦 <b style={{ color: "var(--color-ink)" }}>จุดตัดสินใจ กม.5:</b> HR นิ่ง → ลุย 1:30 / HR พุ่ง → ดรอป B (1:40-1:50)</div>
      </div>
    </div>
  );
}

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
    // Strides sessions have burst pace that is not representative of sustained
    // race pace, so they distort the 10K projection — skip them.
    if (classifySession(run.session_type) === "strides") return;
    const estimate = estimate10kMinutes(run);
    if (estimate == null || !run.run_date || !run.distance_km) return;
    const current = bestByDate.get(run.run_date);
    const next = {
      date: run.run_date,
      label: shortDate(run.run_date),
      session: sessionLabel(run.session_type),
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

  // Only steady aerobic runs reflect race-relevant efficiency — strides/tempo
  // have variable cadence/Z2 that would skew the efficiency factors.
  const steadyRuns = recentRuns.filter((r) => isSteadyAerobic(r.session_type)).slice(-10);

  const recentCadences = steadyRuns
    .map((r) => r.cadence_spm)
    .filter((v): v is number => v != null);
  const avgCadence = recentCadences.length ? recentCadences.reduce((a, b) => a + b, 0) / recentCadences.length : null;
  const cadenceFactor = avgCadence == null ? 1.0
    : avgCadence >= 168 ? 0.98
    : avgCadence >= 165 ? 1.01
    : avgCadence >= 160 ? 1.03
    : 1.06;

  const recentZ2 = steadyRuns
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

function RacePaceCalculator({ targetMin }: { targetMin: number }) {
  const targetSec = targetMin * 60;
  const avgPaceSec = targetSec / 10;
  // Conservative strategy: km 1-2 slower by 8%, km 3-7 at avg, km 8-9 same/slight push, km 10 same
  const splits = Array.from({ length: 10 }, (_, i) => {
    const km = i + 1;
    let factor = 1.0;
    if (km <= 2) factor = 1.06;
    else if (km <= 7) factor = 0.99;
    else if (km <= 9) factor = 0.98;
    else factor = 0.97;
    return { km, paceSec: Math.round(avgPaceSec * factor) };
  });
  // Normalize so cumulative time hits target
  const total = splits.reduce((acc, s) => acc + s.paceSec, 0);
  const correction = targetSec / total;
  let cumSec = 0;
  const rows = splits.map((s) => {
    const adjustedPace = Math.round(s.paceSec * correction);
    cumSec += adjustedPace;
    return {
      km: s.km,
      pace: adjustedPace,
      cum: cumSec,
    };
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-line)" }}>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>Km</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>Pace</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>Cumulative</th>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>Strategy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const note = r.km <= 2 ? "🐢 Conservative" : r.km <= 7 ? "⚖️ Steady" : r.km <= 9 ? "🔥 Push" : "🏁 Finish";
            const bg = r.km <= 2 ? "#dbeafe" : r.km <= 7 ? "#dff7f2" : r.km <= 9 ? "#fef3c7" : "#fee2e8";
            return (
              <tr key={r.km} style={{ borderBottom: "1px solid var(--color-line-soft)" }}>
                <td style={{ padding: "8px 6px", fontWeight: 650 }}>{r.km}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{pace(r.pace)}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{Math.floor(r.cum / 60)}:{String(r.cum % 60).padStart(2, "0")}</td>
                <td style={{ padding: "8px 6px" }}>
                  <span style={{ background: bg, padding: "2px 8px", borderRadius: 4, fontSize: "0.78rem" }}>{note}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: "0.78rem", color: "var(--color-muted)" }}>
        Average pace: <b style={{ color: "var(--color-ink)" }}>{pace(avgPaceSec)}</b> · ออกตัวช้าเพื่อคุม HR · เร่งช่วงท้ายถ้า effort ยังเหลือ
      </div>
    </div>
  );
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

  // Personal Records
  const longestRun = data.runs.reduce<RunLog | null>((best, r) =>
    !best || (r.distance_km ?? 0) > (best.distance_km ?? 0) ? r : best, null);
  const fastestEasy = data.runs
    .filter((r) => isSteadyAerobic(r.session_type) && r.pace_sec_per_km != null && (r.distance_km ?? 0) >= 4)
    .reduce<RunLog | null>((best, r) =>
      !best || (r.pace_sec_per_km ?? 99999) < (best.pace_sec_per_km ?? 99999) ? r : best, null);
  const fastestQuality = data.runs
    .filter((r) => {
      const kind = classifySession(r.session_type);
      return (kind === "tempo" || kind === "vo2" || kind === "test") && r.pace_sec_per_km != null;
    })
    .reduce<RunLog | null>((best, r) =>
      !best || (r.pace_sec_per_km ?? 99999) < (best.pace_sec_per_km ?? 99999) ? r : best, null);
  const bestZ2 = data.runs
    .filter((r) => (r.distance_km ?? 0) >= 6 && r.z2_percent != null)
    .reduce<RunLog | null>((best, r) =>
      !best || (r.z2_percent ?? 0) > (best.z2_percent ?? 0) ? r : best, null);
  const peakCadence = data.runs.reduce<RunLog | null>((best, r) =>
    !best || (r.cadence_spm ?? 0) > (best.cadence_spm ?? 0) ? r : best, null);

  const forecastDelta = forecast == null ? null : forecast - (IS_B_RACE ? CUTOFF_MINUTES : A_RACE_TARGET);
  const corosDelta = coros10k == null ? null : coros10k - B_RACE_TARGET;
  const latestGap = latestPoint && latestExpected ? latestPoint.actual - latestExpected : null;
  const targetPaceSec = (TARGET_MINUTES * 60) / 10;
  void bestPoint;

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
            label="COROS ทำนาย 10K"
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
          title={`10K goal chart · ${IS_B_RACE ? "B-race" : "A-race"}`}
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

        <Panel title="Race-day decision guide" subtitle="แนวทางวันแข่ง" className="span-12">
          <div className="coach-card race-decision">
            <p>{thaiText(race?.race_decision)}</p>
          </div>
        </Panel>
        <ListPanel title="Strengths" items={(race?.strengths ?? []).map((item) => thaiText(item))} className="span-6 good-list" />
        <ListPanel title="Risks" items={(race?.risks ?? []).map((item) => thaiText(item))} className="span-6 warn-list" />

        {IS_B_RACE && (
          <Panel
            title="🌉 Race-day plan · Disney Run · Rama 8 + expressway"
            subtitle="เป้า A 1:30 · ปรับตาม elevation จริง (สะพาน ×2, ทางยกระดับบรมราชชนนี, ออกตัว 04:00)"
            className="span-12"
          >
            <DisneyRunPacingPlan />
          </Panel>
        )}

        <Panel title="🏆 Personal Records" subtitle="สถิติส่วนตัวจากทุก session ที่ผ่านมา" className="span-12">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Longest run", value: km(longestRun?.distance_km), sub: longestRun?.run_date, icon: "🏔" },
              { label: "Fastest easy/long", value: pace(fastestEasy?.pace_sec_per_km), sub: fastestEasy?.run_date, icon: "⚡" },
              { label: "Fastest quality", value: pace(fastestQuality?.pace_sec_per_km), sub: fastestQuality?.run_date, icon: "🔥" },
              { label: "Best Z2 (long)", value: percent(bestZ2?.z2_percent), sub: bestZ2?.run_date, icon: "💚" },
              { label: "Peak cadence", value: peakCadence?.cadence_spm == null ? "-" : `${peakCadence.cadence_spm.toFixed(0)} spm`, sub: peakCadence?.run_date, icon: "🦵" },
            ].map((pr, i) => (
              <div key={i} style={{
                background: "var(--color-primary-soft)",
                border: "1px solid var(--color-line)",
                borderRadius: 8, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{pr.icon}</div>
                <div style={{ color: "var(--color-muted)", fontSize: "0.78rem" }}>{pr.label}</div>
                <div style={{ fontWeight: 750, fontSize: "1.1rem", color: "var(--color-ink)" }}>{pr.value}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 2 }}>{pr.sub ?? ""}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="🧮 Race pace calculator" subtitle={`แผน split สำหรับ ${raceTime(TARGET_MINUTES)} · กลยุทธ์ออกตัวแบบระมัดระวัง`} className="span-12">
          <RacePaceCalculator targetMin={TARGET_MINUTES} />
        </Panel>

        {race?.milestones && race.milestones.length > 0 && (
          <Panel title="🎯 Milestones before race day" subtitle={`${race.milestones.filter((m) => m.status === "done").length}/${race.milestones.length} เสร็จแล้ว`} className="span-12">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {race.milestones.map((m, i) => {
                const color = m.status === "done" ? "#1a6847" : m.status === "skipped" ? "#9d1c37" : "#7a5300";
                const bg = m.status === "done" ? "#d8eee5" : m.status === "skipped" ? "#fee2e8" : "#fef9ec";
                const icon = m.status === "done" ? "✓" : m.status === "skipped" ? "✗" : "○";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 8,
                    background: bg, borderLeft: `4px solid ${color}`,
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 750, color, minWidth: 18 }}>{icon}</span>
                    <span style={{ flex: 1, color: "var(--color-ink)", fontWeight: 600 }}>{m.name}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--color-muted)" }}>{m.due}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}
