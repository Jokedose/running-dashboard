import { Activity, AlertTriangle, Brain, Flame, HeartPulse, Moon, ShieldCheck, Zap } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { CoreFeatures } from "../components/CoreFeatures";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, RunLog } from "../types";
import { average, latest } from "../utils/data";
import { km, minutes, pace, percent, sessionLabel, shortDate } from "../utils/format";
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

/* ─────────────────────────────────────────────
   Helpers (ไม่เปลี่ยน)
   ───────────────────────────────────────────── */
function readinessTone(status: string | null): "neutral" | "good" | "warn" | "hot" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("green") || s.includes("เขียว") || s.includes("ดี")) return "good";
  if (s.includes("yellow") || s.includes("เหลือง") || s.includes("ระวัง")) return "warn";
  if (s.includes("red") || s.includes("แดง") || s.includes("พัก")) return "hot";
  return "neutral";
}

function runVerdict(run: RunLog | undefined) {
  if (!run) {
    return {
      tone: "neutral" as const,
      title: "ยังไม่มีผลวิ่งล่าสุด",
      message: "เมื่อ sync run log แล้ว หน้านี้จะสรุปว่าผ่านแผนไหมและควรระวังอะไรต่อ",
    };
  }
  const z2 = run.z2_percent ?? 0;
  const drift = run.drift_bpm ?? 0;
  const hasPain = painLevel(run.pain) !== "none";
  if (hasPain) return { tone: "warn" as const, title: "ผ่าน แต่ต้องเช็กอาการขา", message: "คุม easy ได้ดี แต่มี pain/soreness note ให้ดูอาการก่อน session คุณภาพครั้งถัดไป" };
  if (z2 >= 85 && drift <= 5) return { tone: "good" as const, title: "ผ่านตามแผน", message: "Z2 และ drift อยู่ในเกณฑ์ดี เหมาะกับการสะสม aerobic base" };
  if (z2 >= 85) return { tone: "warn" as const, title: "ผ่าน แต่ drift สูง", message: "Z2 ดีมาก แต่หัวใจไหลขึ้นช่วงท้าย ควรเน้น recovery และ hydration" };
  return { tone: "neutral" as const, title: "ต้องดูบริบทเพิ่ม", message: "ข้อมูลล่าสุดยังไม่เข้าเกณฑ์ easy ชัดเจน ให้เทียบกับ RPE, อากาศ และ readiness ของวันนั้น" };
}

/* ─────────────────────────────────────────────
   Today page
   ───────────────────────────────────────────── */
export function Today({ data }: { data: DashboardData }) {
  const today = latest(data.daily, "log_date");
  const lastRun = latest(data.runs, "run_date");
  const recentRuns = data.runs.slice(-8);
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const avgZ2 = average(data.runs.map((run) => run.z2_percent));
  const tone = readinessTone(today?.readiness_status ?? null);
  const verdict = runVerdict(lastRun);

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

  const todayIso = new Date().toISOString().slice(0, 10);
  const isQualityType = (v: string | null | undefined) => { const k = classifySession(v); return k === "tempo" || k === "vo2" || k === "test" || k === "race"; };
  const nextQuality = data.plan.filter((p) => p.plan_date >= todayIso && isQualityType(p.session_type ?? p.title)).sort((a, b) => a.plan_date.localeCompare(b.plan_date))[0] ?? null;
  const nextQualityDays = nextQuality == null ? null : Math.ceil((new Date(nextQuality.plan_date).getTime() - Date.now()) / 86400000);

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

      {/* ── Content grid (ไม่เปลี่ยน) ── */}
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

        <Panel title="Coach verdict" subtitle="สรุปจาก run log ล่าสุด" className="span-7">
          <div className={`coach-verdict ${verdict.tone}`}>
            <div className="coach-verdict-icon">{verdict.tone === "good" ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}</div>
            <div>
              <strong>{verdict.title}</strong><p>{verdict.message}</p>
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
