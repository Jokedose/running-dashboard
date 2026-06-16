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
import { km, shortDate } from "../utils/format";
import { painLevel } from "../utils/session";

const PAIN_SEVERITY: Record<string, number> = { none: 0, mild: 1, moderate: 2, high: 3 };

// load proxy per run = distance (km). fallback to duration/6 (~km-equiv) when distance missing.
function runLoad(r: RunLog): number {
  if (r.distance_km != null) return r.distance_km;
  if (r.duration_min != null) return r.duration_min / 6;
  return 0;
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

function acwrZone(v: number | null): { tone: "neutral" | "good" | "warn" | "hot"; label: string } {
  if (v == null) return { tone: "neutral", label: "ข้อมูลไม่พอ" };
  if (v < 0.8) return { tone: "warn", label: "ต่ำ — เสี่ยง detraining" };
  if (v <= 1.3) return { tone: "good", label: "ปลอดภัย (sweet spot)" };
  if (v <= 1.5) return { tone: "warn", label: "เริ่มสูง — ระวัง" };
  return { tone: "hot", label: "เสี่ยงบาดเจ็บ (>1.5)" };
}

export function Load({ data }: { data: DashboardData }) {
  const runs = data.runs.filter((r) => r.run_date);

  const loadByDate = new Map<string, number>();
  for (const r of runs) {
    loadByDate.set(r.run_date, (loadByDate.get(r.run_date) ?? 0) + runLoad(r));
  }

  const sortedDates = [...loadByDate.keys()].sort();
  const start = sortedDates[0];
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : today;
  const end = lastDate > today ? lastDate : today;
  const allDays = start ? daysBetween(start, end) : [];

  const series = allDays.map((day, i) => {
    let acute = 0;
    let chronic = 0;
    for (let j = Math.max(0, i - 27); j <= i; j++) {
      const v = loadByDate.get(allDays[j]) ?? 0;
      chronic += v;
      if (j >= i - 6) acute += v;
    }
    const chronicWeekly = chronic / 4;
    const acwr = chronicWeekly > 0 ? acute / chronicWeekly : null;
    return {
      label: shortDate(day),
      load: Number((loadByDate.get(day) ?? 0).toFixed(1)),
      acute: Number(acute.toFixed(1)),
      chronic: Number(chronicWeekly.toFixed(1)),
      acwr: acwr != null ? Number(acwr.toFixed(2)) : null,
    };
  });

  const hasEnoughHistory = allDays.length >= 14;
  const currentAcwr = (() => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].acwr != null) return series[i].acwr;
    }
    return null;
  })();
  const zone = acwrZone(hasEnoughHistory ? currentAcwr : null);

  const acute7 = series.length ? series[series.length - 1].acute : 0;
  const chronicWk = series.length ? series[series.length - 1].chronic : 0;
  const chartRows = series.slice(-42);

  const niggleRows = runs.filter((r) => painLevel(r.pain) !== "none");
  const recentNiggles = [...niggleRows].sort((a, b) => b.run_date.localeCompare(a.run_date)).slice(0, 6);
  const hasHighPain = recentNiggles.some((r) => painLevel(r.pain) === "high");

  void PAIN_SEVERITY;

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard
          label="ACWR วันนี้"
          value={currentAcwr == null || !hasEnoughHistory ? "-" : currentAcwr.toFixed(2)}
          detail={zone.label}
          icon={HeartPulse}
          tone={zone.tone}
        />
        <MetricCard label="โหลด 7 วัน (acute)" value={km(acute7)} detail="ระยะสะสม 7 วันล่าสุด" icon={Activity} />
        <MetricCard label="โหลดเฉลี่ย/สัปดาห์ (chronic)" value={km(chronicWk)} detail="เฉลี่ย 28 วัน" icon={ShieldCheck} />
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
          title="ACWR — อัตราส่วนโหลดเฉียบพลัน : เรื้อรัง"
          subtitle="แถบเขียว 0.8–1.3 = ปลอดภัย · เกิน 1.5 = เสี่ยงบาดเจ็บ (42 วันล่าสุด)"
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
              <ReferenceArea yAxisId="right" y1={0.8} y2={1.3} fill={chartColors.primary} fillOpacity={0.12} />
              <ReferenceLine
                yAxisId="right"
                y={1.5}
                stroke={chartColors.accent}
                strokeDasharray="5 5"
                label={{ value: "1.5", position: "right", fontSize: 11, fill: chartColors.accent }}
              />
              <Bar yAxisId="left" dataKey="load" fill="url(#primaryBar)" radius={[6, 6, 0, 0]} name="โหลดรายวัน km" />
              <Line yAxisId="right" dataKey="acwr" stroke={chartColors.ink} strokeWidth={3} dot={false} name="ACWR" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          {!hasEnoughHistory && (
            <p className="chart-note">ต้องมีข้อมูลวิ่งอย่างน้อย ~2 สัปดาห์เพื่อให้ ACWR แม่นยำ</p>
          )}
        </Panel>

        <Panel title="อาการเจ็บ (niggle) ล่าสุด" subtitle="ดึงจากช่อง pain ใน run log (markdown source)" className="span-12">
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
