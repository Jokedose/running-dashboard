import { Activity, Brain, Moon, Mountain, TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { PageSummary } from "../components/PageSummary";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { longRunTargetKm } from "../utils/context";
import { average } from "../utils/data";
import { km, minutes, shortDate } from "../utils/format";
import { classifySession } from "../utils/session";
import { trendsSummary } from "../utils/summary";

export function Trends({ data }: { data: DashboardData }) {
  // เป้า long run ตามแผนปัจจุบัน (ladder ไต่ตาม phase) แทนค่าคงที่ 9.5 ของช่วง pre-race
  const longTarget = longRunTargetKm(data.plan);
  const avgHrv = average(data.daily.map((d) => d.hrv_avg_ms));
  const avgSleepMin = average(data.daily.map((d) => d.sleep_minutes));
  const avgWeeklyKm = average(data.weekly.map((w) => w.total_distance_km));
  const totalWeeks = data.weekly.length;

  const weekRows = data.weekly.slice(-20).map((w) => ({
    week: w.week_id.replace(/^\d{4}-/, ""),
    km: w.total_distance_km ?? 0,
    quality: w.quality_count ?? 0,
    long: w.long_run_count ?? 0,
  }));

  const hrvRows = data.daily.slice(-30).map((d) => ({
    date: shortDate(d.log_date),
    hrv: d.hrv_avg_ms ?? null,
    load: d.load_ratio == null ? null : Number(d.load_ratio.toFixed(2)),
    rhr: d.resting_hr_bpm ?? null,
  }));

  const KIND_LABELS: Record<string, string> = {
    easy: "Easy", long: "Long", recovery: "Recovery", strides: "Strides",
    tempo: "Tempo", vo2: "VO2", test: "Test", race: "Race", rest: "Rest", other: "อื่นๆ",
  };
  const sessionTypeCounts = data.runs.reduce((acc, r) => {
    const bucket = KIND_LABELS[classifySession(r.session_type)] ?? "อื่นๆ";
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sessionMix = Object.entries(sessionTypeCounts).map(([type, count]) => ({ type, count }));

  const longRunRows = data.runs
    .filter((r) => classifySession(r.session_type) === "long" && r.distance_km != null && r.pace_sec_per_km != null)
    .map((r) => ({
      date: shortDate(r.run_date),
      distance: r.distance_km,
      paceMin: r.pace_sec_per_km != null ? r.pace_sec_per_km / 60 : null,
      z2: r.z2_percent,
    }));

  const dailyByDate = new Map(data.daily.map((d) => [d.log_date, d]));
  const qualityRows = data.runs
    .filter((r) => r.z2_percent != null && r.drift_bpm != null && r.pace_sec_per_km != null)
    .map((r) => {
      const prevDate = new Date(r.run_date);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevKey = prevDate.toISOString().slice(0, 10);
      const prev = dailyByDate.get(prevKey) ?? dailyByDate.get(r.run_date);
      if (!prev || prev.hrv_avg_ms == null) return null;
      const qualityScore =
        (r.z2_percent ?? 0) * 0.6 -
        (r.drift_bpm ?? 0) * 3 +
        Math.max(0, 100 - ((r.decoupling_percent ?? 5) - 3) * 5);
      return { hrv: prev.hrv_avg_ms, quality: Math.round(qualityScore), date: r.run_date };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const sleepRows = data.daily.slice(-21).map((d) => ({
    date: shortDate(d.log_date),
    hours: d.sleep_minutes == null ? null : Math.round(d.sleep_minutes / 6) / 10,
    score: d.sleep_score ?? null,
  }));

  // นอนคืนก่อน (sleep_score) เทียบ drift ของ run วันถัดไป — คนละมุมกับ HRV vs Quality
  // ด้านบน: นี่ตอบตรง ๆ ว่า "นอนไม่พอ กระทบ HR drift วันซ้อมแค่ไหน"
  const sleepDriftRows = data.runs
    .filter((r) => r.drift_bpm != null)
    .map((r) => {
      const prevDate = new Date(r.run_date);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevKey = prevDate.toISOString().slice(0, 10);
      const prev = dailyByDate.get(prevKey);
      if (!prev || prev.sleep_score == null) return null;
      return { sleepScore: prev.sleep_score, drift: r.drift_bpm, date: r.run_date };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // อุณหภูมิ ณ วันวิ่ง เทียบ drift — ตอบว่า "อากาศร้อนแค่ไหนเริ่มกระทบ HR"
  const weatherDriftRows = data.runs
    .filter((r) => r.temperature_c != null && r.drift_bpm != null)
    .map((r) => ({ temp: r.temperature_c, drift: r.drift_bpm, date: r.run_date }));

  const summary = trendsSummary({
    totalWeeks,
    avgWeeklyKm,
    longestLongRunKm: longRunRows.length ? Math.max(...longRunRows.map((r) => r.distance ?? 0)) : null,
    longTargetKm: longTarget,
    avgHrvMs: avgHrv,
    avgSleepMin,
  });

  return (
    <section className="page-stack">
      <PageSummary summary={summary} />
      <div className="metric-grid">
        <MetricCard label="สัปดาห์ทั้งหมด" value={String(totalWeeks)} detail="ที่บันทึกไว้" icon={TrendingUp} />
        <MetricCard label="ระยะ/สัปดาห์" value={km(avgWeeklyKm)} detail="เฉลี่ยทุกสัปดาห์" icon={Activity} />
        <MetricCard
          label="Long run ยาวสุด"
          value={longRunRows.length === 0 ? "-" : km(Math.max(...longRunRows.map((r) => r.distance ?? 0)))}
          detail={`${longRunRows.length} ครั้งที่บันทึก · เป้าแผน ${longTarget} km`}
          icon={Mountain}
          tone={longRunRows.some((r) => (r.distance ?? 0) >= longTarget) ? "good" : "warn"}
        />
        <MetricCard
          label="HRV เฉลี่ย"
          value={avgHrv == null ? "-" : `${avgHrv.toFixed(0)} ms`}
          detail="ทุกบันทึกรายวัน"
          icon={Brain}
        />
        <MetricCard
          label="การนอนเฉลี่ย"
          value={avgSleepMin == null ? "-" : minutes(avgSleepMin)}
          detail="ทุกบันทึกรายวัน"
          icon={Moon}
        />
      </div>

      <div className="content-grid">
        <Panel title="Weekly distance" subtitle="ระยะรวมและซ้อมคุณภาพรายสัปดาห์ (สูงสุด 20 สัปดาห์)" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={weekRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="week" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 8]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="km" fill="url(#primaryBar)" radius={[8, 8, 0, 0]} name="ระยะ km" />
              <Line
                yAxisId="right"
                dataKey="quality"
                stroke={chartColors.accent}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.accent, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="ซ้อมคุณภาพ"
                connectNulls={false}
              />
              <Line
                yAxisId="right"
                dataKey="long"
                stroke={chartColors.blue}
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
                name="วิ่งยาว"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="HRV · training load" subtitle="30 วันล่าสุด — HRV ms (เส้นทึบ) · อัตราโหลด (เส้นประ)" className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={hrvRows} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} />
              <ChartTooltip />
              <Line
                yAxisId="left"
                dataKey="hrv"
                stroke={chartColors.primary}
                strokeWidth={3}
                dot={false}
                name="HRV ms"
                connectNulls={false}
              />
              <Line
                yAxisId="right"
                dataKey="load"
                stroke={chartColors.blue}
                strokeWidth={2.5}
                strokeDasharray="6 6"
                dot={false}
                name="อัตราโหลด"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="📊 Session mix" subtitle={`${data.runs.length} ครั้งที่บันทึก แบ่งตามประเภท`} className="span-6">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={sessionMix} margin={chartMargin} layout="vertical">
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} horizontal={false} />
              <XAxis type="number" {...chartAxis} />
              <YAxis type="category" dataKey="type" {...chartAxis} width={70} />
              <ChartTooltip />
              <Bar dataKey="count" fill="url(#primaryBar)" radius={[0, 6, 6, 0]} name="ครั้ง" />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="🏔 Long run progression" subtitle={`พัฒนาการระยะและเพซของ long run (${longRunRows.length} ครั้ง) · เป้าตามแผน ≥ ${longTarget} km`} className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={longRunRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} label={{ value: "km", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" reversed {...chartAxis} label={{ value: "min/km", angle: 90, position: "insideRight", fontSize: 11 }} />
              <ChartTooltip />
              <ReferenceLine yAxisId="left" y={longTarget} stroke={chartColors.accent} strokeDasharray="6 6" label={{ value: `เป้า ${longTarget}km`, position: "insideTopLeft", fontSize: 11, fill: chartColors.accent }} />
              <Bar yAxisId="left" dataKey="distance" fill="url(#primaryBar)" radius={[8, 8, 0, 0]} name="ระยะ km" />
              <Line yAxisId="right" dataKey="paceMin" stroke={chartColors.blue} strokeWidth={3} dot={{ r: 4, fill: chartColors.blue, strokeWidth: 0 }} name="เพซ นาที/กม." connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="🧠 Pre-run HRV vs Quality" subtitle={`ความสัมพันธ์ HRV (วันก่อน) กับ run quality (${qualityRows.length} ครั้ง)`} className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis type="number" dataKey="hrv" name="HRV ms" domain={["dataMin - 5", "dataMax + 5"]} {...chartAxis} />
              <YAxis type="number" dataKey="quality" name="Quality" {...chartAxis} />
              <ZAxis range={[60, 60]} />
              <ChartTooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={qualityRows} fill={chartColors.primary} />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 4 }}>
            HRV สูง → quality มักดีขึ้น · ใช้ HRV เป็น early signal ก่อนซ้อมหนัก
          </div>
        </Panel>

        <Panel title="😴 นอนคืนก่อน vs Drift วันซ้อม" subtitle={`คะแนนการนอนคืนก่อน เทียบ HR drift ของ run วันถัดไป (${sleepDriftRows.length} ครั้ง)`} className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis type="number" dataKey="sleepScore" name="คะแนนการนอน" domain={["dataMin - 5", "dataMax + 5"]} {...chartAxis} />
              <YAxis type="number" dataKey="drift" name="Drift bpm" {...chartAxis} />
              <ZAxis range={[60, 60]} />
              <ChartTooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={sleepDriftRows} fill={chartColors.blue} />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 4 }}>
            คะแนนนอนต่ำ → drift มักสูงขึ้น (จุดขวาบน = นอนน้อยแต่ drift เยอะ) — สัญญาณเตือนก่อนซ้อมหนัก
          </div>
        </Panel>

        <Panel title="🌡️ อุณหภูมิ vs Drift" subtitle={`อุณหภูมิ ณ วันวิ่ง เทียบ HR drift (${weatherDriftRows.length} ครั้งที่มีข้อมูลอากาศ)`} className="span-6">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis type="number" dataKey="temp" name="อุณหภูมิ °C" domain={["dataMin - 1", "dataMax + 1"]} {...chartAxis} />
              <YAxis type="number" dataKey="drift" name="Drift bpm" {...chartAxis} />
              <ZAxis range={[60, 60]} />
              <ChartTooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={weatherDriftRows} fill={chartColors.accent} />
            </ScatterChart>
          </ResponsiveContainer>
          {weatherDriftRows.length === 0 ? (
            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 4 }}>
              ยังไม่มี run log ที่บันทึกอุณหภูมิ — เพิ่มช่อง "อุณหภูมิ" ใน run log เพื่อดู correlation นี้
            </div>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 4 }}>
              อากาศร้อนขึ้น → drift มักสูงขึ้น — ใช้ประเมินว่าควรลด pace ล่วงหน้าตอนอากาศร้อนแค่ไหน
            </div>
          )}
        </Panel>

        <Panel title="Sleep quality" subtitle="21 วันล่าสุด — ชั่วโมงนอน (แท่ง) · คะแนนการนอน (เส้น)" className="span-12">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={sleepRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis yAxisId="left" domain={[0, 12]} {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="hours" fill="url(#sleepBar)" radius={[8, 8, 0, 0]} name="นอน (ชม.)" />
              <Line
                yAxisId="right"
                dataKey="score"
                stroke={chartColors.blue}
                strokeWidth={3}
                dot={{ r: 3, fill: chartColors.blue, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="คะแนนการนอน"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}
