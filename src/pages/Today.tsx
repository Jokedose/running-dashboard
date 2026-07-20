import { Activity, AlertTriangle, Brain, CalendarClock, Cross, Flame, HeartPulse, Moon, ShieldCheck, Timer, Trophy, Zap } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { CoreFeatures } from "../components/CoreFeatures";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { PhaseStrip } from "../components/PhaseStrip";
import type { DashboardData, RunLog, SessionCriteria } from "../types";
import { average, latest } from "../utils/data";
import { buildTrainingContext, type TrainingContext } from "../utils/context";
import { criteriaFor, evaluateRun, type RunEvaluation } from "../utils/evaluate";
import { km, minutes, pace, percent, raceTime, sessionLabel, shortDate } from "../utils/format";
import { classifySession, isSteadyAerobic, painLevel } from "../utils/session";
import { thaiText } from "../utils/thaiText";

/* ─────────────────────────────────────────────
   ReadinessRing — วงแหวนคะแนน readiness
   แสดงผล recovery_percent เป็น SVG ring
   ───────────────────────────────────────────── */
function ReadinessRing({
  score,
  tone = "neutral",
}: {
  score: number | null | undefined;
  tone?: "neutral" | "good" | "warn" | "hot";
}) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  const colors = {
    neutral: { stroke: "var(--color-primary)", glow: "rgba(79,138,120,0.18)" },
    good:    { stroke: "#2a7f62",              glow: "rgba(42,127,98,0.22)"  },
    warn:    { stroke: "#b08642",              glow: "rgba(176,134,66,0.22)" },
    hot:     { stroke: "#b0593f",              glow: "rgba(176,89,63,0.22)"  },
  };
  const c = colors[tone] ?? colors.neutral;

  return (
    <div className="readiness-ring">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <circle
          cx="66" cy="66" r={r}
          fill="none"
          stroke="rgba(79,138,120,0.12)"
          strokeWidth="10"
        />
        <circle
          cx="66" cy="66" r={r}
          fill="none"
          stroke={c.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "66px 66px", transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="readiness-ring-inner">
        <strong>{score == null ? "–" : `${score}`}</strong>
        <span>พร้อมซ้อม</span>
      </div>
    </div>
  );
}

function readinessTone(status: string | null): "neutral" | "good" | "warn" | "hot" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("green") || s.includes("เขียว") || s.includes("ดี")) return "good";
  if (s.includes("yellow") || s.includes("เหลือง") || s.includes("ระวัง")) return "warn";
  if (s.includes("red") || s.includes("แดง") || s.includes("พัก")) return "hot";
  return "neutral";
}

/* ─────────────────────────────────────────────
   Context banners — widget stack ส่วนบน เรียงตาม TrainingContext
   (race recap → race week → injury) แสดงเฉพาะเมื่อบริบทเข้าเงื่อนไข
   ───────────────────────────────────────────── */

const BANNER_STYLE: Record<"celebrate" | "race" | "injury", { bg: string; border: string; color: string }> = {
  celebrate: { bg: "#d8eee5", border: "#2a7f62", color: "#1a6847" },
  race:      { bg: "#fef9ec", border: "#b08642", color: "#7a5300" },
  injury:    { bg: "#fee2e8", border: "#b0593f", color: "#9d1c37" },
};

function ContextBanner({
  kind,
  icon,
  title,
  detail,
  chips,
}: {
  kind: "celebrate" | "race" | "injury";
  icon: React.ReactNode;
  title: string;
  detail?: string | null;
  chips?: Array<string | null | undefined>;
}) {
  const style = BANNER_STYLE[kind];
  const shown = (chips ?? []).filter((chip): chip is string => Boolean(chip));
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 10,
        background: style.bg, borderLeft: `4px solid ${style.border}`,
      }}
    >
      <span style={{ color: style.border, marginTop: 2 }}>{icon}</span>
      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ color: style.color }}>{title}</strong>
        {detail && <span style={{ fontSize: "0.86rem", color: "var(--color-ink)" }}>{thaiText(detail)}</span>}
        {shown.length > 0 && (
          <div className="chip-row">
            {shown.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContextBanners({ ctx }: { ctx: TrainingContext }) {
  const banners: React.ReactNode[] = [];

  if (ctx.justRaced && ctx.lastRace) {
    const { goal, result, runLog } = ctx.lastRace;
    const time = result?.result_time_min ?? runLog?.duration_min ?? null;
    const paceValue = result?.result_pace_sec_per_km ?? runLog?.pace_sec_per_km ?? null;
    banners.push(
      <ContextBanner
        key="recap"
        kind="celebrate"
        icon={<Trophy size={20} />}
        title={`🎉 จบแข่ง ${goal.race_name ?? goal.race_slug} แล้ว — ช่วงนี้คือ recovery`}
        detail={result?.result_note ?? "เก็บผลไว้ที่หน้า Race — สัปดาห์นี้เน้นฟื้นตัว อย่ารีบกลับไป quality"}
        chips={[
          time != null ? `เวลา ${raceTime(time)}` : null,
          paceValue != null ? `เพซ ${pace(paceValue)}` : null,
          result?.target_achieved ? `เป้า ${result.target_achieved}` : null,
          result?.cutoff_buffer_min != null ? `เหลือจาก cutoff ${Math.round(result.cutoff_buffer_min)} นาที` : null,
        ]}
      />,
    );
  } else if (ctx.raceWeek && ctx.currentRace) {
    banners.push(
      <ContextBanner
        key="race-week"
        kind="race"
        icon={<Timer size={20} />}
        title={
          ctx.daysToRace === 0
            ? `🏁 วันนี้วันแข่ง ${ctx.currentRace.race_name ?? ctx.currentRace.race_slug}!`
            : `🏁 อีก ${ctx.daysToRace} วันถึง ${ctx.currentRace.race_name ?? ctx.currentRace.race_slug}`
        }
        detail="สัปดาห์แข่ง — ดู pacing plan และกติกาเส้นทางที่หน้า Race, งดของใหม่ทุกอย่าง"
        chips={[
          ctx.currentRace.target_a_text ? `เป้า A: ${ctx.currentRace.target_a_text}` : null,
          ctx.currentRace.cutoff_min != null ? `Cutoff ${raceTime(ctx.currentRace.cutoff_min)}` : null,
        ]}
      />,
    );
  }

  if (ctx.openInjury) {
    banners.push(
      <ContextBanner
        key="injury"
        kind="injury"
        icon={<Cross size={20} />}
        title={`อาการที่ต้องตาม: ${ctx.openInjury.title ?? ctx.openInjury.injury_slug} (${ctx.openInjury.status})`}
        detail={ctx.openInjury.current_rule ?? ctx.openInjury.trend}
        chips={[ctx.openInjury.last_symptom_date ? `อาการล่าสุด ${ctx.openInjury.last_symptom_date}` : null]}
      />,
    );
  }

  if (!banners.length) return null;
  return <div style={{ display: "grid", gap: 10 }}>{banners}</div>;
}

/* ─────────────────────────────────────────────
   Gate verdict — ผลจาก evaluateGate (rules จาก db)
   ───────────────────────────────────────────── */

function GateVerdict({ ctx }: { ctx: TrainingContext }) {
  const gate = ctx.gate;
  if (!gate || !gate.matched.length) return null;
  const tone = gate.severity === "ok" ? "good" : gate.severity === "caution" ? "warn" : "hot";
  const color = tone === "good" ? "#1a6847" : tone === "warn" ? "#7a5300" : "#9d1c37";
  const bg = tone === "good" ? "#d8eee5" : tone === "warn" ? "#fef9ec" : "#fee2e8";
  return (
    <Panel title="Readiness gate" subtitle="ตัดสินจากกติกา gate ที่ sync จาก repo" className="span-12">
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: bg, borderLeft: `4px solid ${color}` }}>
          <span style={{ fontSize: 16 }}>{tone === "good" ? "✅" : tone === "warn" ? "⚠️" : "🛑"}</span>
          <span style={{ color: "var(--color-ink)", fontWeight: 650 }}>{thaiText(gate.decision)}</span>
        </div>
        <div className="chip-row">
          {gate.matched.map((rule) => (
            <span key={rule.rule_order}>{thaiText(rule.signal)}</span>
          ))}
          {gate.unverified.includes("hrv_status") && <span>ยังไม่ได้เทียบ HRV status</span>}
        </div>
      </div>
    </Panel>
  );
}

/* ─────────────────────────────────────────────
   Next session — จาก training_plan + เกณฑ์ผ่านของ session นั้น
   ───────────────────────────────────────────── */

function criteriaChips(criteria: SessionCriteria | null): string[] {
  if (!criteria) return [];
  const chips: string[] = [];
  if (criteria.z2_min_percent != null) chips.push(`Z2 ≥ ${criteria.z2_min_percent}%`);
  if (criteria.drift_max_bpm != null) chips.push(`Drift ≤ ${criteria.drift_max_bpm} bpm`);
  if (criteria.decoupling_max_percent != null) chips.push(`Decoupling ≤ ${criteria.decoupling_max_percent}%`);
  if (criteria.hr_avg_max_bpm != null) chips.push(`HR ≤ ${criteria.hr_avg_max_bpm} bpm`);
  if (criteria.z4z5_max_percent != null) chips.push(`Z4+Z5 ≤ ${criteria.z4z5_max_percent}%`);
  return chips;
}

function NextSessionCard({ ctx, criteria }: { ctx: TrainingContext; criteria: SessionCriteria[] }) {
  const session = ctx.nextSession;
  if (!session) return null;
  const days = Math.round((Date.parse(session.plan_date) - Date.parse(ctx.today)) / 86_400_000);
  const kind = classifySession(session.session_type ?? session.title);
  const chips = criteriaChips(criteriaFor(kind, criteria));
  return (
    <Panel
      title="Session ถัดไปตามแผน"
      subtitle={days === 0 ? "วันนี้" : `อีก ${days} วัน · ${session.plan_date}`}
      className="span-12"
      action={<CalendarClock size={18} />}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <strong>{sessionLabel(session.session_type ?? session.title)}</strong>
        <span style={{ fontSize: "0.86rem", color: "var(--color-muted)" }}>{thaiText(session.title)}</span>
        <div className="chip-row">
          {session.target_distance_km != null && <span>{km(session.target_distance_km)}</span>}
          {session.target_duration_min != null && <span>{minutes(session.target_duration_min)}</span>}
          {session.target_pace_sec_per_km != null && <span>{pace(session.target_pace_sec_per_km)}</span>}
          {session.planned_shoe && <span>รองเท้า: {session.planned_shoe}</span>}
        </div>
        {chips.length > 0 && (
          <div className="chip-row">
            <span style={{ fontWeight: 650 }}>เกณฑ์ผ่าน:</span>
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ─────────────────────────────────────────────
   Coach verdict — จาก evaluateRun (เกณฑ์ session_criteria ใน db)
   ───────────────────────────────────────────── */

function runVerdict(run: RunLog | undefined, evaluation: RunEvaluation | null) {
  if (!run) {
    return {
      tone: "neutral" as const,
      title: "ยังไม่มีผลวิ่งล่าสุด",
      message: "เมื่อ sync run log แล้ว หน้านี้จะสรุปว่าผ่านเกณฑ์ไหมและควรระวังอะไรต่อ",
      failed: [] as string[],
    };
  }
  const hasPain = painLevel(run.pain) !== "none";
  if (!evaluation || evaluation.verdict === "unknown") {
    return {
      tone: hasPain ? ("warn" as const) : ("neutral" as const),
      title: hasPain ? "ต้องเช็กอาการขาก่อน" : "Session นี้ไม่มีเกณฑ์ตัวเลข",
      message: hasPain
        ? "มี pain/soreness note ให้ดูอาการก่อน session ถัดไป"
        : "ดูตามบริบท (RPE, อากาศ, readiness) ประกอบ",
      failed: [] as string[],
    };
  }
  const failed = evaluation.checks.filter((check) => !check.ok).map((check) => `${check.label}: ${check.actual.toFixed(1)} (เกณฑ์ ${check.limit})`);
  if (evaluation.verdict === "pass") {
    return {
      tone: hasPain ? ("warn" as const) : ("good" as const),
      title: hasPain ? "ผ่านเกณฑ์ แต่ต้องเช็กอาการขา" : `ผ่านเกณฑ์ ${sessionLabel(run.session_type)}`,
      message: hasPain
        ? "ตัวเลขผ่านทุกข้อ แต่มี pain note — ดูอาการก่อน session คุณภาพครั้งถัดไป"
        : `ผ่านครบทั้ง ${evaluation.checks.length} ข้อของเกณฑ์ (sync จาก rules/session-criteria.md)`,
      failed,
    };
  }
  if (evaluation.verdict === "warn") {
    return {
      tone: "warn" as const,
      title: "ผ่านบางส่วน — มี 1 ข้อหลุดเกณฑ์",
      message: "ดูรายการที่หลุดด้านล่าง แล้วปรับใน session ถัดไป",
      failed,
    };
  }
  return {
    tone: "hot" as const,
    title: "หลุดเกณฑ์หลายข้อ",
    message: "ลดความหนัก/เพิ่ม recovery ก่อนกลับไปตามแผน",
    failed,
  };
}

/* ─────────────────────────────────────────────
   Today page — widget stack เรียงตาม TrainingContext
   ───────────────────────────────────────────── */
export function Today({ data }: { data: DashboardData }) {
  const ctx = buildTrainingContext(data);
  const today = ctx.todayReadiness ?? latest(data.daily, "log_date");
  const lastRun = ctx.lastRun ?? undefined;
  const recentRuns = data.runs.slice(-8);
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const avgZ2 = average(data.runs.map((run) => run.z2_percent));
  const tone = readinessTone(today?.readiness_status ?? null);
  const evaluation = lastRun ? evaluateRun(lastRun, data.criteria) : null;
  const verdict = runVerdict(lastRun, evaluation);

  const easyRuns = data.runs
    .filter((r) => isSteadyAerobic(r.session_type) && r.pace_sec_per_km != null)
    .slice(-10).map((r) => r.pace_sec_per_km as number);
  const paceConsistencyCoV = (() => {
    if (easyRuns.length < 3) return null;
    const avg = easyRuns.reduce((a, b) => a + b, 0) / easyRuns.length;
    const variance = easyRuns.reduce((acc, p) => acc + (p - avg) ** 2, 0) / easyRuns.length;
    return (Math.sqrt(variance) / avg) * 100;
  })();
  const consistencyTone: "neutral" | "good" | "warn" | "hot" =
    paceConsistencyCoV == null ? "neutral" : paceConsistencyCoV < 3 ? "good" : paceConsistencyCoV < 6 ? "warn" : "hot";

  const isQualityType = (v: string | null | undefined) => { const k = classifySession(v); return k === "tempo" || k === "vo2" || k === "test" || k === "race"; };
  const nextQuality = data.plan.filter((p) => p.plan_date >= ctx.today && isQualityType(p.session_type ?? p.title)).sort((a, b) => a.plan_date.localeCompare(b.plan_date))[0] ?? null;
  const nextQualityDays = nextQuality == null ? null : Math.max(0, Math.round((Date.parse(nextQuality.plan_date) - Date.parse(ctx.today)) / 86400000));

  const loadRatio = today?.load_ratio ?? null;
  const acwrTone: "neutral" | "good" | "warn" | "hot" = loadRatio == null ? "neutral" : loadRatio >= 0.8 && loadRatio <= 1.3 ? "good" : loadRatio < 0.8 ? "warn" : loadRatio <= 1.5 ? "warn" : "hot";
  const acwrLabel = loadRatio == null ? "ไม่มีข้อมูล" : loadRatio < 0.8 ? "Detraining · เริ่มถดถอย" : loadRatio <= 1.3 ? "Optimized · zone ปลอดภัย" : loadRatio <= 1.5 ? "Functional overreach" : "Injury risk สูง — ลดโหลด";

  const latestHrv = today?.hrv_avg_ms;
  const avgHrv7 = average(data.daily.slice(-8, -1).map((d) => d.hrv_avg_ms));
  const hrvTone: "neutral" | "good" | "warn" = latestHrv == null ? "neutral" : latestHrv >= (avgHrv7 ?? latestHrv) * 0.95 ? "good" : "warn";

  const coachAdvice = (() => {
    const advice: { tone: "good" | "warn" | "hot"; text: string }[] = [];
    if (today?.recovery_percent != null && today.recovery_percent < 60) advice.push({ tone: "hot", text: `Recovery ${today.recovery_percent}% ต่ำ — ทำได้แค่ recovery easy` });
    if (latestHrv != null && avgHrv7 != null && latestHrv < avgHrv7 * 0.9) advice.push({ tone: "warn", text: `HRV ต่ำกว่า baseline 7 วัน — ลดความหนักลง` });
    if (today?.sleep_minutes != null && today.sleep_minutes < 330) advice.push({ tone: "warn", text: `นอนน้อย ${Math.round(today.sleep_minutes / 60)}h — ห้ามทำ quality วันนี้` });
    if (loadRatio != null && loadRatio > 1.5) advice.push({ tone: "hot", text: `Load ratio ${loadRatio.toFixed(2)} สูงเสี่ยงบาดเจ็บ — พัก/easy 2-3 วัน` });
    if (painLevel(lastRun?.pain) !== "none") advice.push({ tone: "warn", text: `Run ล่าสุดมี pain note — เช็คก่อน quality ครั้งถัดไป` });
    if (lastRun?.cadence_spm != null && lastRun.cadence_spm < 165) advice.push({ tone: "warn", text: `Cadence ${lastRun.cadence_spm.toFixed(0)} spm ต่ำ — ฝึก cuing 170 ใน easy run` });
    if (!advice.length) advice.push({ tone: "good", text: "Signal ทุกตัวอยู่ในเกณฑ์ดี — ทำตามแผนได้เต็ม" });
    return advice;
  })();

  const recentDaily = data.daily.slice(-14).map((d) => ({ date: shortDate(d.log_date), hrv: d.hrv_avg_ms ?? null, sleepHours: d.sleep_minutes == null ? null : Math.round(d.sleep_minutes / 6) / 10 }));
  const chartRows = recentRuns.map((run) => ({ date: shortDate(run.run_date), distance: run.distance_km ?? 0, z2: run.z2_percent ?? null }));

  return (
    <section className="page-stack">

      {/* ── Context banners: race recap / race week / injury ── */}
      <ContextBanners ctx={ctx} />

      {/* ── Readiness hero ── */}
      <div className={`readiness-hero ${tone}`}>
        <div className="readiness-hero-copy">
          <span className="readiness-status-badge">{thaiText(today?.readiness_status, "ไม่มีข้อมูล")}</span>
          <p className="readiness-session">{thaiText(today?.planned_session, "ยังไม่มีแผนวันนี้")}</p>
          <p className="readiness-rec">{thaiText(today?.recommendation)}</p>
          <div className="chip-row">
            <span>รองเท้า: {thaiText(today?.recommended_shoe)}</span>
            <span>โหลด: {today?.load_ratio?.toFixed(2) ?? "-"}</span>
            <span>ชีพจรพัก: {today?.resting_hr_bpm ?? "-"} bpm</span>
            {today?.tags?.map((tag) => <span key={tag}>{thaiText(tag)}</span>)}
          </div>
        </div>
        <div className="readiness-hero-ring">
          <ReadinessRing score={today?.recovery_percent} tone={tone} />
        </div>
      </div>

      {/* ── Gate verdict + next session + phase strip ── */}
      <div className="content-grid">
        <GateVerdict ctx={ctx} />
        <NextSessionCard ctx={ctx} criteria={data.criteria} />
        <PhaseStrip ctx={ctx} data={data} />
      </div>

      {/* ── Metric grid ── */}
      <div className="metric-grid">
        <MetricCard label="การฟื้นตัว" value={today?.recovery_percent == null ? "-" : `${today.recovery_percent}%`} detail="ค่าฟื้นตัวจาก COROS" icon={HeartPulse}
          trend={today?.recovery_percent == null ? undefined : `${today.recovery_percent >= 70 ? "↑" : "↓"} ${today.recovery_percent}%`}
          trendTone={today?.recovery_percent == null ? "neutral" : today.recovery_percent >= 70 ? "good" : today.recovery_percent >= 50 ? "warn" : "hot"} />
        <MetricCard label="การนอน" value={today?.sleep_minutes == null ? "-" : minutes(today.sleep_minutes)} detail={today?.sleep_score == null ? undefined : `คะแนน ${today.sleep_score}`} icon={Moon}
          trend={today?.sleep_score == null ? undefined : today.sleep_score >= 75 ? "↑ ดี" : "↓ น้อย"}
          trendTone={today?.sleep_score == null ? "neutral" : today.sleep_score >= 75 ? "good" : "warn"} />
        <MetricCard label="HRV" value={latestHrv == null ? "-" : `${latestHrv} ms`} detail={avgHrv7 == null ? undefined : `เฉลี่ย 7 วัน: ${avgHrv7.toFixed(0)} ms`} icon={Brain} tone={hrvTone}
          trend={latestHrv == null || avgHrv7 == null ? undefined : `${latestHrv >= avgHrv7 ? "↑" : "↓"} ${Math.abs(Math.round(latestHrv - avgHrv7))} ms`}
          trendTone={hrvTone === "good" ? "good" : "warn"} />
        <MetricCard label="ACWR (load ratio)" value={loadRatio == null ? "-" : loadRatio.toFixed(2)} detail={acwrLabel} icon={Flame} tone={acwrTone}
          trend={loadRatio == null ? undefined : loadRatio <= 1.3 ? "คงที่" : `↑ ${loadRatio.toFixed(2)}`}
          trendTone={acwrTone === "good" ? "neutral" : acwrTone} />
        <MetricCard label="ระยะรวม" value={km(totalDistance)} detail={`เฉลี่ย Z2 ${percent(avgZ2)}`} icon={Activity} />
        <MetricCard label="Quality session ถัดไป"
          value={nextQualityDays == null ? "-" : nextQualityDays === 0 ? "วันนี้" : `อีก ${nextQualityDays} วัน`}
          detail={nextQuality == null ? "ไม่มีในแผน" : `${nextQuality.plan_date} · ${nextQuality.session_type ?? nextQuality.title}`}
          icon={Zap} tone={nextQualityDays != null && nextQualityDays <= 2 ? "warn" : "neutral"} />
        <MetricCard label="Pace consistency"
          value={paceConsistencyCoV == null ? "-" : `${paceConsistencyCoV.toFixed(1)}%`}
          detail={paceConsistencyCoV == null ? "ต้องมี easy runs ≥3 ครั้ง" : paceConsistencyCoV < 3 ? "นิ่งมาก · pacing skill ดี" : paceConsistencyCoV < 6 ? "ปกติ · ปรับได้อีก" : "เพซแกว่ง · เน้น cuing pace"}
          icon={Activity} tone={consistencyTone} />
      </div>

      {/* ── Content grid ── */}
      <div className="content-grid">
        <Panel title="Latest run" subtitle={lastRun?.run_date ?? "ยังไม่มีบันทึกวิ่ง"} className="span-5">
          <div className="latest-run">
            <strong>{sessionLabel(lastRun?.session_type)}</strong>
            <div className="mini-metrics">
              <span>{km(lastRun?.distance_km)}</span><span>{minutes(lastRun?.duration_min)}</span>
              <span>{pace(lastRun?.pace_sec_per_km)}</span><span>Z2 {percent(lastRun?.z2_percent)}</span>
              {lastRun?.avg_hr_bpm != null && <span>ชีพจร {lastRun.avg_hr_bpm} bpm</span>}
              {lastRun?.drift_bpm != null && <span>Drift {lastRun.drift_bpm.toFixed(1)} bpm</span>}
            </div>
            {lastRun?.note && <p className="run-note">{thaiText(lastRun.note)}</p>}
          </div>
        </Panel>

        <Panel title="Coach verdict" subtitle="ตัดสินจากเกณฑ์ราย session type ใน db" className="span-7">
          <div className={`coach-verdict ${verdict.tone}`}>
            <div className="coach-verdict-icon">{verdict.tone === "good" ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}</div>
            <div>
              <strong>{verdict.title}</strong><p>{verdict.message}</p>
              {verdict.failed.length > 0 && (
                <div className="chip-row" style={{ marginBottom: 6 }}>
                  {verdict.failed.map((item) => (
                    <span key={item}>⚠️ {item}</span>
                  ))}
                </div>
              )}
              <div className="mini-metrics">
                <span>RPE {thaiText(lastRun?.rpe)}</span><span>ขา/อาการ: {thaiText(lastRun?.pain, "ไม่มีข้อมูล")}</span>
                <span>Decoupling {percent(lastRun?.decoupling_percent)}</span><span>รองเท้า {thaiText(lastRun?.shoe_slug)}</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="🤖 Smart coach advice" subtitle="คำแนะนำจากสัญญาณรวม" className="span-12">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {coachAdvice.map((a, i) => {
              const color = a.tone === "hot" ? "#9d1c37" : a.tone === "warn" ? "#7a5300" : "#1a6847";
              const bg = a.tone === "hot" ? "#fee2e8" : a.tone === "warn" ? "#fef9ec" : "#d8eee5";
              const icon = a.tone === "hot" ? "🛑" : a.tone === "warn" ? "⚠️" : "✅";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: bg, borderLeft: `4px solid ${color}` }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ color: "var(--color-ink)", fontWeight: 600, fontSize: "0.88rem" }}>{a.text}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="HRV · Sleep (14 days)" subtitle="HRV ms (เส้น) · ชั่วโมงนอน (แท่ง)" className="span-6">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={recentDaily} margin={chartMargin}>
              <ChartGradientDefs /><CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} /><YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 12]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="right" dataKey="sleepHours" fill="url(#sleepBar)" radius={[6, 6, 0, 0]} name="นอน (ชม.)" />
              <Line yAxisId="left" dataKey="hrv" stroke={chartColors.primary} strokeWidth={3} dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="HRV ms" connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Progress overview" subtitle="ระยะและ Z2 จากบันทึกวิ่งล่าสุด" className="span-6">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartRows} margin={chartMargin}>
              <ChartGradientDefs /><CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} /><YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="distance" fill="url(#primaryBar)" radius={[8, 8, 0, 0]} name="ระยะ km" />
              <Line yAxisId="right" dataKey="z2" stroke={chartColors.accent} strokeWidth={3} dot={{ r: 3, fill: chartColors.accent, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Z2 %" connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <CoreFeatures />
      </div>
    </section>
  );
}
