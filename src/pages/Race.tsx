import { useState } from "react";
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
import type { DashboardData, PacingSplit, RunLog } from "../types";
import { resolveCurrentRaceGoal, todayIso } from "../utils/data";
import { diffDays, raceShortLabel } from "../utils/context";
import { km, pace, percent, raceTime, sessionLabel, shortDate } from "../utils/format";
import { classifySession, isSteadyAerobic } from "../utils/session";
import { thaiText } from "../utils/thaiText";

function RoutePacingPlan({ splits, rules }: { splits: PacingSplit[]; rules: string[] | null }) {
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
          {splits.map((r) => (
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
      {rules && rules.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: "0.82rem", color: "var(--color-muted)" }}>
          {rules.map((rule, i) => (
            <div key={i}>{rule}</div>
          ))}
        </div>
      )}
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

function raceProjection(runs: RunLog[], targetMinutes: number, cutoffMinutes: number) {
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
      target: targetMinutes,
      cutoff: cutoffMinutes,
    };
    if (!current || next.distance > current.distance || next.actual < current.actual) {
      bestByDate.set(run.run_date, next);
    }
  });
  return [...bestByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function expectedAt(date: string, startDate: string, startValue: number, raceDate: string, targetMinutes: number) {
  const start = new Date(startDate).getTime();
  const end = new Date(raceDate).getTime();
  const current = new Date(date).getTime();
  const progress = end === start ? 1 : Math.max(0, Math.min(1, (current - start) / (end - start)));
  return startValue + (targetMinutes - startValue) * progress;
}

function chartProjection(points: ActualProjectionPoint[], raceDate: string, targetMinutes: number, cutoffMinutes: number) {
  if (!points.length) return [];
  const startDate = points[0].date;
  const startValue = Math.max(points[0].actual, cutoffMinutes);
  const rows: ProjectionPoint[] = points.map((point) => ({
    ...point,
    expected: Number(expectedAt(point.date, startDate, startValue, raceDate, targetMinutes).toFixed(1)),
  }));
  rows.push({
    date: raceDate,
    label: raceDate.slice(5).replace("-", "/"),
    session: "เป้าวันแข่ง",
    distance: 10,
    actual: null,
    expected: targetMinutes,
    target: targetMinutes,
    cutoff: cutoffMinutes,
  });
  return rows;
}

function planForecast(points: ActualProjectionPoint[], daysLeft: number | null, targetMinutes: number) {
  if (!points.length) return null;
  const longOrRecent = points.filter((point) => point.distance >= 8 || point.date >= "2026-04-01");
  const baseline = Math.min(...(longOrRecent.length ? longOrRecent : points).map((point) => point.actual));
  const weeksLeft = daysLeft == null ? 0 : Math.max(0, daysLeft / 7);
  const expectedGain = Math.min(8, weeksLeft * 0.8);
  return Math.max(targetMinutes, baseline - expectedGain);
}

function smartForecast(
  points: ActualProjectionPoint[],
  coros10kMin: number | null,
  recentRuns: RunLog[],
  daysLeft: number | null,
  targetMinutes: number,
) {
  const repForecast = planForecast(points, daysLeft, targetMinutes);
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

function RaceResultCard({ race, heading }: { race: DashboardData["races"][number]; heading?: string }) {
  if (race.result_time_min == null) return null;
  const achievedTone =
    race.target_achieved === "A" || race.target_achieved === "B" ? "good"
    : race.target_achieved === "C" ? "warn" : "hot";
  return (
    <>
      {heading && (
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--color-ink)", marginBottom: -6 }}>{heading}</div>
      )}
      <div className="metric-grid">
        <MetricCard
          label="ผลแข่งจริง"
          value={raceTime(race.result_time_min)}
          detail={`${km(race.result_distance_km)} · ${shortDate(race.race_date)}`}
          icon={Trophy}
          tone="good"
        />
        <MetricCard
          label="เป้าที่ทำได้"
          value={race.target_achieved ?? "-"}
          detail={`วางแผนไว้เป้า ${race.target_planned ?? "-"}`}
          icon={Sparkles}
          tone={achievedTone}
        />
        <MetricCard
          label="Pace เฉลี่ย"
          value={pace(race.result_pace_sec_per_km)}
          detail="จากผลแข่งจริง"
          icon={Gauge}
          tone="good"
        />
        <MetricCard
          label="Buffer ก่อน cutoff"
          value={race.cutoff_buffer_min == null ? "-" : `${Math.round(race.cutoff_buffer_min)} นาที`}
          detail="เหลือก่อนเวลาตัด"
          icon={Clock3}
          tone={race.cutoff_buffer_min != null && race.cutoff_buffer_min >= 8 ? "good" : "warn"}
        />
      </div>
      {race.result_note ? (
        <Panel title="สรุปผลแข่ง" subtitle="บันทึกจาก race day">
          <p style={{ margin: 0, lineHeight: 1.7 }}>{thaiText(race.result_note)}</p>
        </Panel>
      ) : null}
    </>
  );
}

export function Race({ data }: { data: DashboardData }) {
  const today = todayIso();
  const goals = [...data.raceGoals].sort((a, b) => a.race_date.localeCompare(b.race_date));
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  // แข่งที่เลือกจาก list (default = แข่งถัดไปที่กำลังจะถึง)
  const currentGoal = goals.find((g) => g.race_slug === selectedSlug) ?? resolveCurrentRaceGoal(data.raceGoals, today);
  // readiness report ของแข่งปัจจุบัน (จะมีเมื่อ report ถูก sync ก่อนวันแข่ง)
  const race = data.races.find((row) => row.race_date === currentGoal?.race_date) ?? null;
  // COROS fitness (VO2max, prediction) เป็นค่าระดับนักวิ่ง ไม่ใช่ของแข่งใดแข่งหนึ่ง —
  // ถ้าแข่งปัจจุบันยังไม่มี report ใช้แถวล่าสุดแทน (races เรียง race_date desc)
  const fitness = race ?? data.races[0] ?? null;
  // "เป้า" = target_a_min ที่ล็อกแล้วเท่านั้น — ห้าม fallback ไป cutoff_min
  // (Allianz cutoff 2:30:00 เคยโผล่เป็น "เป้า 2:30 ชม" ทั้งหน้า ทั้งที่เป้ายังไม่ล็อก)
  const targetMinutes = currentGoal?.target_a_min ?? null;
  const targetLocked = targetMinutes != null;
  const cutoffMinutes = currentGoal?.cutoff_min ?? null;
  const raceDate = currentGoal?.race_date ?? race?.race_date ?? null;
  const raceCompleted = race?.result_time_min != null;

  const daysLeft = raceDate == null ? null : Math.round((Date.parse(raceDate) - Date.parse(today)) / 86400000);

  const actualProjection = targetMinutes != null ? raceProjection(data.runs, targetMinutes, cutoffMinutes ?? targetMinutes) : [];
  const projection = targetMinutes != null && raceDate != null
    ? chartProjection(actualProjection, raceDate, targetMinutes, cutoffMinutes ?? targetMinutes)
    : [];
  const latestPoint = actualProjection.at(-1);
  const latestExpected = projection.find((point) => point.date === latestPoint?.date)?.expected ?? null;
  const bestPoint = actualProjection.reduce<ActualProjectionPoint | null>(
    (best, point) => (!best || point.actual < best.actual ? point : best),
    null,
  );
  const coros10k = fitness?.coros_pred_10k_min ?? null;
  const forecast = targetMinutes != null ? smartForecast(actualProjection, coros10k, data.runs, daysLeft, targetMinutes) : null;

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

  const forecastDelta = forecast == null || targetMinutes == null ? null : forecast - targetMinutes;
  const corosDelta = coros10k == null || targetMinutes == null ? null : coros10k - targetMinutes;
  const latestGap = latestPoint && latestExpected != null ? latestPoint.actual - latestExpected : null;
  const targetPaceSec = targetMinutes != null ? (targetMinutes * 60) / 10 : null;
  void bestPoint;

  if (!data.races.length && !currentGoal) {
    return (
      <section className="page-stack">
        <Panel title="ยังไม่มีการตั้งเป้าแข่งขัน" subtitle="เพิ่มไฟล์เป้าหมายใน running-results/goals/ แล้ว sync เพื่อดูหน้านี้">
          <p className="chart-note">ยังไม่มีข้อมูล race goal หรือผลแข่งในระบบ</p>
        </Panel>
      </section>
    );
  }

  return (
    <section className="page-stack">
      {goals.length > 1 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {goals.map((g) => {
            const result = data.races.find((r) => r.race_date === g.race_date && r.result_time_min != null);
            const isSelected = g.race_slug === currentGoal?.race_slug;
            const days = diffDays(today, g.race_date);
            const status = result
              ? `✓ ${raceTime(result.result_time_min)}`
              : days >= 0
              ? `อีก ${days} วัน`
              : "ยังไม่มีผล";
            return (
              <button
                key={g.race_slug}
                type="button"
                onClick={() => setSelectedSlug(g.race_slug)}
                style={{
                  display: "grid", gap: 2, textAlign: "left", minWidth: 148, maxWidth: 220, flexShrink: 0,
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer", font: "inherit", color: "var(--color-ink)",
                  border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-line)",
                  background: isSelected ? "rgba(79,138,120,0.10)" : "#fff",
                }}
              >
                <strong style={{ fontSize: "0.88rem" }}>{raceShortLabel(g)}</strong>
                <span style={{ fontSize: "0.74rem", color: "var(--color-muted)" }}>
                  {g.race_date} · {status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="race-hero-card">
        <BrandLogo />
        <div>
          <p>{currentGoal?.race_name ? `${currentGoal.race_name} · ความคืบหน้า 10K` : "ความคืบหน้า 10K"}</p>
          <h2>
            {raceDate
              ? // โชว์เป้าในวงเล็บเฉพาะเมื่อเป็นเวลาจริง (target_a_min มีค่า) — goal ที่ยัง
                // ไม่ล็อกเป้าจะเป็นประโยคอธิบายยาว ไม่เหมาะกับ h2
                `เส้นทางสู่ ${raceDate}${currentGoal?.target_a_min != null && currentGoal.target_a_text ? ` (เป้า ${currentGoal.target_a_text})` : ""}`
              : "ยังไม่มีเป้าแข่งขันที่ตั้งไว้"}
          </h2>
          <span>
            {targetLocked
              ? `เส้นทึบคือสถานะจากผลซ้อมจริง ส่วนเส้นประคือเวลาที่ควรค่อย ๆ พัฒนาไปหาเป้า ${raceTime(targetMinutes)}`
              : "เป้าเวลายังไม่ล็อก — จะกำหนดหลังผ่าน Go/No-Go gate ระหว่างนี้ดูฟอร์มจากผลซ้อมจริง"}
          </span>
        </div>
      </div>

      {race ? <RaceResultCard race={race} /> : null}

      {!raceCompleted && (
        <div className="metric-grid">
          <MetricCard
            label={currentGoal?.race_name ? `นับถอยหลัง ${currentGoal.race_name}` : "นับถอยหลังวันแข่ง"}
            value={`${daysLeft != null && daysLeft > 0 ? daysLeft : 0} วัน`}
            detail={raceDate ?? "-"}
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
                ? targetLocked
                  ? undefined
                  : "รอล็อกเป้าหลัง Go/No-Go gate"
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
      )}

      {(coros10k != null || fitness?.vo2max != null) && (
        <div className="metric-grid">
          <MetricCard
            label="VO2max (COROS)"
            value={fitness?.vo2max == null ? "-" : fitness.vo2max.toFixed(0)}
            detail={fitness?.coros_running_level == null ? undefined : `Running level ${fitness.coros_running_level.toFixed(0)}`}
            icon={Sparkles}
            tone="good"
          />
          <MetricCard
            label="COROS ทำนาย 10K"
            value={raceTime(coros10k)}
            detail={corosDelta == null ? undefined : corosDelta <= 0 ? `เกินเป้า ${Math.abs(corosDelta).toFixed(1)} นาที` : `ช้ากว่าเป้า ${corosDelta.toFixed(1)} นาที`}
            icon={Trophy}
            tone={corosDelta != null && corosDelta <= 0 ? "good" : "warn"}
          />
          <MetricCard
            label="Threshold pace"
            value={fitness?.coros_threshold_pace_sec_per_km == null ? "-" : pace(fitness.coros_threshold_pace_sec_per_km)}
            detail="จาก COROS fitness assessment"
            icon={Activity}
          />
          <MetricCard
            label="5K prediction"
            value={raceTime(fitness?.coros_pred_5k_min ?? null)}
            detail="วัดความเร็วระยะสั้น"
            icon={Clock3}
          />
        </div>
      )}

      <div className="content-grid">
        {!targetLocked && currentGoal && (
          <Panel
            title="เป้าเวลายังไม่ล็อก"
            subtitle={`${currentGoal.race_name ?? currentGoal.race_slug} · ${currentGoal.race_date}`}
            className="span-12"
          >
            <div style={{ display: "grid", gap: 8 }}>
              {currentGoal.target_a_text && (
                <p style={{ margin: 0, lineHeight: 1.7 }}>เป้า A: {thaiText(currentGoal.target_a_text)}</p>
              )}
              {currentGoal.target_b_text && (
                <p style={{ margin: 0, lineHeight: 1.7 }}>เป้า B: {thaiText(currentGoal.target_b_text)}</p>
              )}
              {currentGoal.cutoff_min != null && (
                <div className="chip-row">
                  <span>
                    Cutoff {raceTime(currentGoal.cutoff_min)} (เพซเฉลี่ย ~{pace((currentGoal.cutoff_min * 60) / 10)}) — เส้นตัดตัว ไม่ใช่เป้า
                  </span>
                </div>
              )}
            </div>
          </Panel>
        )}

        {targetMinutes != null && raceDate != null && (
          <Panel
            title={`10K goal chart · ${currentGoal?.race_name ?? "-"}`}
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
                <small>{targetMinutes != null ? raceTime(targetMinutes) : "-"} สำหรับ 10K</small>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={projection} margin={chartMargin}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="label" {...chartAxis} />
                <YAxis
                  domain={[targetMinutes - 10, "dataMax + 10"]}
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
                  y={targetMinutes}
                  stroke={chartColors.primary}
                  strokeDasharray="6 6"
                  label={raceTime(targetMinutes).slice(0, 4)}
                />
                {cutoffMinutes != null && (
                  <ReferenceLine
                    y={cutoffMinutes}
                    stroke={chartColors.accent}
                    strokeDasharray="6 6"
                    label={`เส้นตัดตัว ${raceTime(cutoffMinutes).slice(0, 4)}`}
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
              ส่วนเส้นประเป็นเส้นเป้าหมายที่ค่อย ๆ ลดเวลาจบไปสู่ {raceTime(targetMinutes)} ในวันแข่ง
            </p>
          </Panel>
        )}

        {race?.race_decision && (
          <Panel title="Race-day decision guide" subtitle="แนวทางวันแข่ง" className="span-12">
            <div className="coach-card race-decision">
              <p>{thaiText(race.race_decision)}</p>
            </div>
          </Panel>
        )}
        {race && (
          <>
            <ListPanel title="Strengths" items={(race.strengths ?? []).map((item) => thaiText(item))} className="span-6 good-list" />
            <ListPanel title="Risks" items={(race.risks ?? []).map((item) => thaiText(item))} className="span-6 warn-list" />
          </>
        )}

        {currentGoal?.pacing_splits && currentGoal.pacing_splits.length > 0 && (
          <Panel
            title={`🌉 Race-day plan · ${currentGoal.race_name ?? ""}`}
            subtitle={
              raceCompleted
                ? "แผนก่อนวันแข่ง — race จบแล้ว เก็บไว้เป็นข้อมูลอ้างอิง"
                : "แผน pacing ตามเส้นทางจริง"
            }
            className="span-12"
          >
            <RoutePacingPlan splits={currentGoal.pacing_splits} rules={currentGoal.route_rules} />
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

        {targetMinutes != null && (
          <Panel
            title="🧮 Race pace calculator"
            subtitle={
              raceCompleted
                ? `แผน split เดิมก่อนแข่ง สำหรับ ${raceTime(targetMinutes)} — race จบแล้ว เก็บไว้เป็นข้อมูลอ้างอิง`
                : `แผน split สำหรับ ${raceTime(targetMinutes)} · กลยุทธ์ออกตัวแบบระมัดระวัง`
            }
            className="span-12"
          >
            <RacePaceCalculator targetMin={targetMinutes} />
          </Panel>
        )}

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
