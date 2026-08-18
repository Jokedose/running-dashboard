import { Activity, HeartPulse, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, RunLog } from "../types";
import { pipelineMajors, todayIso, unversionedCount } from "../utils/data";
import { loadRatioBands, type LoadRatioBands } from "../utils/evaluate";
import { km, shortDate } from "../utils/format";
import { painLevel } from "../utils/session";

// Fallback only, for a dashboard pointed at a database that has not been synced
// since training_load_daily was added. Distance is a poor stand-in for load —
// see the note in Load() — so this exists to keep the page rendering, not
// because the numbers are equivalent.
function runLoad(r: RunLog): number {
  if (r.distance_km != null) return r.distance_km;
  if (r.duration_min != null) return r.duration_min / 6;
  return 0;
}

function legacyDistanceSeries(runs: RunLog[]) {
  const loadByDate = new Map<string, number>();
  for (const r of runs) {
    loadByDate.set(r.run_date, (loadByDate.get(r.run_date) ?? 0) + runLoad(r));
  }
  const sortedDates = [...loadByDate.keys()].sort();
  const start = sortedDates[0];
  const today = todayIso();
  const lastDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : today;
  const end = lastDate > today ? lastDate : today;
  const allDays = start ? daysBetween(start, end) : [];

  return allDays.map((day, i) => {
    let acute = 0;
    let chronic = 0;
    for (let j = Math.max(0, i - 27); j <= i; j++) {
      const v = loadByDate.get(allDays[j]) ?? 0;
      chronic += v;
      if (j >= i - 6) acute += v;
    }
    const chronicWeekly = chronic / 4;
    return {
      label: shortDate(day),
      load: Number((loadByDate.get(day) ?? 0).toFixed(1)),
      acute: Number(acute.toFixed(1)),
      chronic: Number(chronicWeekly.toFixed(1)),
      acwr: chronicWeekly > 0 ? Number((acute / chronicWeekly).toFixed(2)) : null,
    };
  });
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// กรอบ sweet spot มาจาก gate rules ใน db (rule 1 ขอบล่าง, rule load สูงขอบบน)
// เกิน 1.5 = เสี่ยงบาดเจ็บ ตามงานวิจัย ACWR (ค่าคงที่ ไม่ใช่กติกาส่วนตัว)
function acwrZone(v: number | null, bands: LoadRatioBands): { tone: "neutral" | "good" | "warn" | "hot"; label: string } {
  if (v == null) return { tone: "neutral", label: "ข้อมูลไม่พอ" };
  if (v < bands.sweetMin) return { tone: "warn", label: "ต่ำ — เสี่ยง detraining" };
  if (v <= bands.cautionOver) return { tone: "good", label: "ปลอดภัย (sweet spot)" };
  if (v <= 1.5) return { tone: "warn", label: "เริ่มสูง — ระวัง" };
  return { tone: "hot", label: "เสี่ยงบาดเจ็บ (>1.5)" };
}

export function Load({ data }: { data: DashboardData }) {
  const runs = data.runs.filter((r) => r.run_date);
  const bands = loadRatioBands(data.gateRules);

  // TRIMP + CTL/ATL/TSB/ACWR come from running-results (scripts/training_load.py)
  // via training_load_daily. Before 2026-08-18 this page derived ACWR from
  // kilometres and a pair of flat rolling windows, which priced a 5 km interval
  // session and a 5 km recovery jog identically — the one number meant to warn
  // about a spike in training stress could not see the difference between the
  // hardest and easiest session of the week.
  const synced = data.trainingLoad;
  const usingTrimp = synced.length > 0;

  const series = usingTrimp
    ? synced.map((row) => ({
        label: shortDate(row.day),
        load: Number(row.trimp.toFixed(1)),
        acute: row.atl != null ? Number(row.atl.toFixed(1)) : 0,
        chronic: row.ctl != null ? Number(row.ctl.toFixed(1)) : 0,
        acwr: row.acwr != null ? Number(row.acwr.toFixed(2)) : null,
      }))
    : legacyDistanceSeries(runs);

  const hasEnoughHistory = series.length >= 28;
  const currentAcwr = (() => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].acwr != null) return series[i].acwr;
    }
    return null;
  })();
  const zone = acwrZone(hasEnoughHistory ? currentAcwr : null, bands);

  const acute7 = series.length ? series[series.length - 1].acute : 0;
  const chronicWk = series.length ? series[series.length - 1].chronic : 0;
  const latestLoad = usingTrimp ? synced[synced.length - 1] : null;
  const chartRows = series.slice(-42);
  const recentWeeks = data.intensity.slice(-8);

  const niggleRows = runs.filter((r) => painLevel(r.pain) !== "none");
  const recentNiggles = [...niggleRows].sort((a, b) => b.run_date.localeCompare(a.run_date)).slice(0, 6);
  const hasHighPain = recentNiggles.some((r) => painLevel(r.pain) === "high");

  // เชื่อม ACWR กับ injury_status — โหลดสูง + มีเคสเปิดพร้อมกัน คือความเสี่ยงจริง
  // ไม่ใช่แค่สองสัญญาณแยกกันที่ต้องเปิดดูคนละหน้า
  // ใช้ค่า ACWR ตรงๆ แทน zone.tone เพราะ tone "warn" ใช้ร่วมกันทั้งฝั่งโหลดสูงและ
  // detraining (ต่ำเกิน) — แบนเนอร์นี้ข้อความบอกให้ "ลดโหลด" ซึ่งใช้ไม่ได้กับเคส detraining
  const openInjuries = data.injuries.filter((inj) => inj.is_open);
  const acwrElevated = hasEnoughHistory && currentAcwr != null && currentAcwr > bands.cautionOver;
  const showRiskBanner = acwrElevated && openInjuries.length > 0;

  // A chart is the one place a definition change does real damage: two meanings
  // of the same metric drawn as one line reads as a trend. Say so instead.
  const majors = pipelineMajors(runs);
  const unversioned = unversionedCount(runs);
  const mixedDefinitions = majors.length > 1 || (majors.length > 0 && unversioned > 0);

  return (
    <section className="page-stack">
      {mixedDefinitions && (
        <Panel title="⚠️ ข้อมูลชุดนี้มาจาก pipeline หลายเวอร์ชัน" className="warn">
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            พบข้อมูลจาก pipeline major {majors.join(", ") || "-"}
            {unversioned > 0 && ` และอีก ${unversioned} แถวที่ไม่มีเวอร์ชันกำกับ (sync ก่อนระบบ version)`}
            {" "}— การขึ้น major หมายถึง <strong>metric เดิมเปลี่ยนความหมาย</strong> เช่นระยะ main
            เลิกรวม warm-up หรือ pace เปลี่ยนนิยาม ค่าจากคนละเวอร์ชันจึงไม่ควรอ่านเป็นเทรนด์เดียวกัน
            {" "}รัน <code>scripts/recompute_run_logs.py</code> แล้ว sync ใหม่เพื่อให้ทุกแถวใช้นิยามเดียวกัน
          </p>
        </Panel>
      )}

      {showRiskBanner && (
        <Panel title="⚠️ ความเสี่ยงซ้อนกัน — โหลดสูง + มีอาการเปิดอยู่" className="hot">
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            ACWR ตอนนี้ {zone.label.toLowerCase()} ({currentAcwr?.toFixed(2)}) พร้อมกับมี
            {" "}
            {openInjuries.map((inj, i) => (
              <span key={inj.injury_slug}>
                {i > 0 ? ", " : ""}
                <strong>{inj.title ?? inj.injury_slug}</strong> ({inj.status})
              </span>
            ))}
            {" "}ที่ยังไม่ปิดเคส — สองสัญญาณนี้รวมกันคือความเสี่ยงบาดเจ็บซ้ำ/แย่ลงสูงกว่าดูแยกกัน
            ควรลดโหลดหรือขยับกลับไป easy/recovery จนกว่า ACWR จะกลับสู่ sweet spot
          </p>
        </Panel>
      )}

      <div className="metric-grid">
        <MetricCard
          label="ACWR วันนี้"
          value={currentAcwr == null || !hasEnoughHistory ? "-" : currentAcwr.toFixed(2)}
          detail={zone.label}
          icon={HeartPulse}
          tone={zone.tone}
        />
        <MetricCard
          label={usingTrimp ? "ATL — ความล้า (7 วัน)" : "โหลด 7 วัน (acute)"}
          value={usingTrimp ? acute7.toFixed(1) : km(acute7)}
          detail={usingTrimp ? "TRIMP เฉลี่ยถ่วงน้ำหนัก 7 วัน" : "ระยะสะสม 7 วันล่าสุด"}
          icon={Activity}
        />
        <MetricCard
          label={usingTrimp ? "CTL — ฐานที่สะสม (42 วัน)" : "โหลดเฉลี่ย/สัปดาห์ (chronic)"}
          value={usingTrimp ? chronicWk.toFixed(1) : km(chronicWk)}
          detail={usingTrimp ? "TRIMP เฉลี่ยถ่วงน้ำหนัก 42 วัน" : "เฉลี่ย 28 วัน"}
          icon={ShieldCheck}
        />
        {usingTrimp && latestLoad?.tsb != null && (
          <MetricCard
            label="TSB — ความสด (CTL − ATL)"
            value={latestLoad.tsb.toFixed(1)}
            detail={latestLoad.tsb >= 0 ? "สดกว่าฐานที่สะสมไว้" : "ยังล้าสะสมอยู่"}
            icon={HeartPulse}
            tone={latestLoad.tsb >= 0 ? "good" : "warn"}
          />
        )}
        <MetricCard
          label="อาการเจ็บที่บันทึก"
          value={String(niggleRows.length)}
          detail={recentNiggles.length ? `ล่าสุด ${shortDate(recentNiggles[0].run_date)}` : "ไม่มี"}
          icon={TriangleAlert}
          tone={hasHighPain ? "hot" : recentNiggles.length ? "warn" : "good"}
        />
      </div>

      <div className="content-grid">
        <Panel
          title="ACWR — acute : chronic load ratio"
          subtitle={`แถบเขียว ${bands.sweetMin}–${bands.cautionOver} = ปลอดภัย (จาก gate rules) · เกิน 1.5 = เสี่ยงบาดเจ็บ (42 วันล่าสุด)`}
          className="span-12"
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 2]} {...chartAxis} />
              <ChartTooltip />
              <ReferenceArea yAxisId="right" y1={bands.sweetMin} y2={bands.cautionOver} fill={chartColors.primary} fillOpacity={0.12} />
              <ReferenceLine
                yAxisId="right"
                y={1.5}
                stroke={chartColors.accent}
                strokeDasharray="5 5"
                label={{ value: "1.5", position: "right", fontSize: 11, fill: chartColors.accent }}
              />
              <Bar
                yAxisId="left"
                dataKey="load"
                fill="url(#primaryBar)"
                radius={[6, 6, 0, 0]}
                name={usingTrimp ? "TRIMP รายวัน" : "โหลดรายวัน km"}
              />
              <Line yAxisId="right" dataKey="acwr" stroke={chartColors.ink} strokeWidth={3} dot={false} name="ACWR" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          {!hasEnoughHistory && (
            <p className="chart-note">ACWR ต้องมีประวัติอย่างน้อย 28 วันจึงจะเริ่มมีความหมาย</p>
          )}
          <p className="chart-note">
            {usingTrimp
              ? "โหลด = TRIMP ถ่วงตาม HR รายวินาที · ACWR แบบ EWMA 7:28 วัน — เป็นสัญญาณให้ฉุกคิด ไม่ใช่กฎ"
              : "⚠️ ยังไม่มีข้อมูล training_load_daily — กราฟนี้ใช้ระยะทางเป็น proxy ของโหลด ซึ่งมองไม่เห็นความต่างระหว่าง interval กับ jog"}
          </p>
        </Panel>

        {recentWeeks.length > 0 && (
          <Panel
            title="Intensity distribution รายสัปดาห์"
            subtitle="สัดส่วนเวลา (ไม่ใช่จำนวน session) — ง่าย Z1-Z2 · กลาง Z3 · หนัก Z4-Z5"
            className="span-12"
          >
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={recentWeeks.map((w) => ({
                label: w.iso_week.replace(/^\d{4}-/, ""),
                easy: w.low_pct ?? 0,
                moderate: w.moderate_pct ?? 0,
                hard: w.high_pct ?? 0,
              }))} margin={chartMargin}>
                <ChartGradientDefs />
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="label" {...chartAxis} />
                <YAxis domain={[0, 100]} {...chartAxis} />
                <ChartTooltip />
                <Bar dataKey="easy" stackId="i" fill={chartColors.primary} name="ง่าย %" radius={[0, 0, 0, 0]} />
                <Bar dataKey="moderate" stackId="i" fill={chartColors.ink} name="กลาง %" />
                <Bar dataKey="hard" stackId="i" fill={chartColors.accent} name="หนัก %" radius={[6, 6, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="signal-list">
              {[...recentWeeks].reverse().slice(0, 4).map((week) => (
                <div key={week.iso_week}>
                  <Activity size={16} />
                  <span>
                    {week.iso_week} · {week.model ?? "-"} ({(week.low_pct ?? 0).toFixed(0)}/
                    {(week.moderate_pct ?? 0).toFixed(0)}/{(week.high_pct ?? 0).toFixed(0)})
                  </span>
                </div>
              ))}
            </div>
            <p className="chart-note">
              แผนประกาศว่าใช้โมเดล pyramidal — ตารางนี้คือการวัดว่าสัปดาห์ที่ทำจริงออกมาเป็นรูปแบบไหน
              · การ map 5 โซนลงเป็น 3 domain เป็นค่าประมาณ (ขอบจริงคือ LT1/LT2 ซึ่งยังไม่เคยวัด)
            </p>
          </Panel>
        )}

        <Panel title="Latest niggles" subtitle="ดึงจากช่อง pain ใน run log (markdown source)" className="span-12">
          {recentNiggles.length === 0 ? (
            <p className="chart-note">ยังไม่มีอาการเจ็บที่บันทึก — ดีมาก รักษา ACWR ในโซนเขียวต่อไป</p>
          ) : (
            <div className="signal-list">
              {recentNiggles.map((r) => {
                const lvl = painLevel(r.pain);
                return (
                  <div key={r.id}>
                    <TriangleAlert size={16} />
                    <span>
                      {shortDate(r.run_date)} · {r.pain}
                    </span>
                    <strong>{lvl === "high" ? "สูง" : lvl === "moderate" ? "ปานกลาง" : "เล็กน้อย"}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}
