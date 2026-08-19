import { Flame, Gauge, Scale, UtensilsCrossed } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ChartGradientDefs, ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";
import { shortIsoWeek } from "../utils/calendarDates";
import { latest } from "../utils/data";
import {
  RUN_KCAL_SOURCE_LABEL,
  deficitReality,
  energyChartRows,
  energyWeightSeries,
  estimatedDurationWeeks,
  latestEnergyWeek,
  mixedKcalSources,
} from "../utils/energy";

const WEEKS_IN_VIEW = 12;

function kcal(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value).toLocaleString("en-US")} kcal`;
}

function sourceTone(source: string | null): "good" | "warn" | "hot" | "neutral" {
  if (source === "device") return "good";
  if (source === "estimate") return "warn";
  if (source === "mixed") return "hot";
  return "neutral";
}

export function Energy({ data }: { data: DashboardData }) {
  const weeks = data.energy;
  const current = latestEnergyWeek(weeks);
  const rows = energyChartRows(weeks, WEEKS_IN_VIEW);
  // เตือนตามช่วงที่ "แสดงอยู่จริง" ไม่ใช่ทั้งประวัติ — ไม่งั้นสัปดาห์เก่าที่เลื่อนพ้นจอ
  // ยังทำให้ป้ายเตือนค้างอยู่ทั้งที่กราฟตรงหน้าไม่ได้ปนแหล่งแล้ว
  const visibleWeeks = weeks.filter((week) => rows.some((row) => row.isoWeek === week.iso_week));
  const mixedSources = mixedKcalSources(visibleWeeks);
  const estimatedWeeks = estimatedDurationWeeks(visibleWeeks);

  const weightRows = energyWeightSeries(weeks, data.body).slice(-16);
  const reality = deficitReality(weightRows);
  const body = latest(data.body, "measured_date") ?? null;

  if (!weeks.length) {
    return (
      <section className="page-stack">
        <Panel
          title="ยังไม่มีข้อมูลพลังงาน"
          subtitle="ยังไม่มีสัปดาห์ไหนใน energy_weekly ถูก sync ขึ้นมา"
        >
          <p className="chart-note">
            หน้านี้อ่านจากตาราง <code>energy_weekly</code> ซึ่ง running-results เป็นคนคำนวณ (<code>scripts/energy.py</code>)
            {" "}แล้ว sync ขึ้น Supabase — แดชบอร์ดไม่ได้คิดเลขเอง ถ้าตรงนี้ว่างแปลว่ายังไม่มีแถวให้อ่าน
            {" "}ไม่ใช่ว่าไม่มีการซ้อม ลองสั่ง sync ฝั่ง running-results อีกรอบแล้วกลับมาดูใหม่
          </p>
        </Panel>
      </section>
    );
  }

  return (
    <section className="page-stack">
      {mixedSources && (
        <Panel title="⚠️ ช่วงที่แสดงอยู่ปนแหล่ง kcal สองแบบ" className="warn">
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            <strong>จากนาฬิกา (device)</strong> คือ active calories ที่ COROS บันทึกไว้ในไฟล์ .fit ส่วน{" "}
            <strong>จากสมการ (estimate)</strong> คำนวณด้วยสมการ Keytel จาก HR + น้ำหนัก + อายุ ซึ่งให้ค่า
            <strong>สูงกว่านาฬิกาประมาณ 30%</strong> สำหรับคุณโจ๊ก — สัปดาห์ที่มาจากคนละแหล่งจึงต่างกันด้วย
            <strong>วิธีวัด</strong> ไม่ใช่เพราะซ้อมหนักขึ้น อ่านรวมเป็นเทรนด์เส้นเดียวไม่ได้
            {" "}ดูป้ายกำกับรายสัปดาห์ได้ที่ตาราง “ที่มาของตัวเลขแต่ละสัปดาห์” ด้านล่าง
          </p>
        </Panel>
      )}

      <div className="metric-grid">
        <MetricCard
          label={`พลังงานจากการซ้อม · ${shortIsoWeek(current?.iso_week ?? "")}`}
          value={kcal(current?.exercise_kcal)}
          detail={`net ทั้งสัปดาห์ · ${current?.exercise_minutes != null ? `${Math.round(current.exercise_minutes)} นาที` : "ไม่มีข้อมูลเวลา"}`}
          icon={Flame}
        />
        <MetricCard
          label="TDEE เฉลี่ย/วัน"
          value={kcal(current?.avg_daily_tdee_kcal)}
          detail="BMR × 1.35 + การซ้อมเฉลี่ยราย 7 วัน (รวม BMR แล้ว)"
          icon={Gauge}
        />
        <MetricCard
          label="เป้ากิน/วัน"
          value={kcal(current?.target_intake_kcal)}
          detail={
            current?.deficit_target_kcal != null
              ? `TDEE − ${Math.round(current.deficit_target_kcal)} kcal/วัน`
              : "ยังไม่ได้ตั้งเป้า deficit"
          }
          icon={UtensilsCrossed}
          tone="good"
        />
        <MetricCard
          label="น้ำหนักล่าสุด"
          value={body?.weight_kg != null ? `${body.weight_kg.toFixed(1)} kg` : "-"}
          detail={body ? `ชั่งเมื่อ ${body.measured_date}` : "ยังไม่มีข้อมูลใน body_composition"}
          icon={Scale}
        />
      </div>

      <div className="content-grid">
        <Panel
          title="พลังงานที่เผารายสัปดาห์ (net)"
          subtitle="วิ่ง / strength / cardio ซ้อนกัน · เส้นคือค่าเฉลี่ยต่อวันของสัปดาห์นั้น"
          className="span-12"
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={rows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="run" stackId="kcal" fill={chartColors.primary} name="วิ่ง kcal" />
              <Bar yAxisId="left" dataKey="strength" stackId="kcal" fill={chartColors.blue} name="strength kcal" />
              <Bar yAxisId="left" dataKey="cardio" stackId="kcal" fill={chartColors.amber} name="cardio kcal" radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" dataKey="tdee" stroke={chartColors.ink} strokeWidth={3} dot={false} name="TDEE เฉลี่ย/วัน" connectNulls />
              <Line
                yAxisId="right"
                dataKey="target"
                stroke={chartColors.accent}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="เป้ากิน/วัน"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="chart-note">
            แท่ง = พลังงาน <strong>net ทั้งสัปดาห์</strong> (ไม่รวม BMR) ส่วนเส้นเป็นค่า <strong>ต่อวัน</strong> ที่รวม BMR แล้ว
            {" "}— คนละหน่วยเวลา จึงต้องใช้แกนคนละข้าง
          </p>
        </Panel>

        <Panel
          title="deficit ที่วางไว้ เกิดขึ้นจริงไหม"
          subtitle="พลังงานที่เผาต่อสัปดาห์ ทาบกับน้ำหนักจริง และเส้นน้ำหนักที่ควรเป็นถ้ากินตามเป้า"
          className="span-12"
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={weightRows} margin={chartMargin}>
              <ChartGradientDefs />
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis yAxisId="left" {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={["dataMin - 1", "dataMax + 1"]} {...chartAxis} />
              <ChartTooltip />
              <Bar yAxisId="left" dataKey="exercise" fill="url(#primaryBar)" radius={[6, 6, 0, 0]} name="เผาจากการซ้อม kcal" />
              <Line
                yAxisId="right"
                dataKey="weightKg"
                stroke={chartColors.accent}
                strokeWidth={3}
                dot={{ r: 3 }}
                name="น้ำหนักจริง kg"
                connectNulls
              />
              <Line
                yAxisId="right"
                dataKey="expectedKg"
                stroke={chartColors.ink}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="น้ำหนักตามแผน kg"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          {reality ? (
            <p className="chart-note">
              ช่วง {reality.weeks} สัปดาห์ที่มีทั้งข้อมูลพลังงานและการชั่ง —{" "}
              {/* น้ำหนักขึ้นต้องพูดว่า "ขึ้น" ไม่ใช่ "ลดช้ากว่าแผน" — ช่วงบาดเจ็บกลางปี 2026
                  น้ำหนักเพิ่ม 1.6 kg ซึ่งเป็นคนละเรื่องกับการลดได้ไม่ถึงเป้า */}
              {reality.actualLossKg < 0 ? (
                <>
                  น้ำหนัก<strong>เพิ่มขึ้น {Math.abs(reality.actualLossKg).toFixed(2)} kg</strong> สวนทางกับแผนที่คาดว่าจะลด{" "}
                  <strong>{reality.expectedLossKg.toFixed(2)} kg</strong> — deficit ไม่ได้เกิดขึ้นจริงในช่วงนี้
                  {" "}(ถ้าเป็นช่วงพักบาดเจ็บก็สมเหตุสมผล เพราะฝั่งเผาหายไปแต่ฝั่งกินมักเท่าเดิม)
                </>
              ) : (
                <>
                  น้ำหนักลดจริง <strong>{reality.actualLossKg.toFixed(2)} kg</strong> ขณะที่แผนคาดไว้{" "}
                  <strong>{reality.expectedLossKg.toFixed(2)} kg</strong>
                  {": "}
                  {reality.gapKg >= 0.3
                    ? "ลดเร็วกว่าแผน — อาจกินต่ำกว่าเป้า หรือ TDEE จริงสูงกว่าที่คำนวณไว้"
                    : reality.gapKg <= -0.3
                      ? "ลดช้ากว่าแผน — deficit ที่ตั้งใจไว้ยังไม่เกิดขึ้นจริงเท่าที่ควร"
                      : "ใกล้เคียงแผน — สมมติฐาน TDEE ที่ใช้อยู่ยังใช้ได้"}
                </>
              )}
            </p>
          ) : (
            <p className="chart-note">
              ต้องมีน้ำหนักที่ชั่งอย่างน้อยสองสัปดาห์ในช่วงนี้ ถึงจะเทียบแผนกับความจริงได้
            </p>
          )}
        </Panel>

        <Panel
          title="ที่มาของตัวเลขแต่ละสัปดาห์"
          subtitle="แหล่ง kcal ของการวิ่ง และสัปดาห์ที่เวลา strength เป็นค่าประมาณ"
          className="span-12"
        >
          <div className="signal-list">
            {[...rows].reverse().map((row) => (
              <div key={row.isoWeek}>
                <Flame size={16} />
                <span>
                  {row.isoWeek} · {kcal(row.exercise)}
                  {row.minutes != null && ` · ${row.minutes} นาที`}
                  {row.estimated && " · ⏱ เวลา strength เป็นค่าประมาณจากจำนวนเซต"}
                </span>
                <span className={`metric-trend ${sourceTone(row.source)}`}>
                  {row.source ? RUN_KCAL_SOURCE_LABEL[row.source] : "ไม่ระบุแหล่ง"}
                </span>
              </div>
            ))}
          </div>
          <p className="chart-note">
            {estimatedWeeks.length > 0
              ? `${estimatedWeeks.length} สัปดาห์ในช่วงนี้มีเซสชัน strength ที่เดานาทีจากจำนวนเซต — kcal ของสัปดาห์นั้นหยาบกว่าเพื่อน`
              : "ทุกสัปดาห์ในช่วงนี้ใช้เวลาซ้อมจริง ไม่มีค่าประมาณปน"}
          </p>
        </Panel>

        <Panel title="อ่านตัวเลขหน้านี้ยังไง" className="span-12">
          <ul className="clean-list">
            <li>
              <strong>kcal ของการซ้อมทุกตัวในหน้านี้เป็น net</strong> คือเฉพาะส่วนที่เกินจากการนอนเฉย ๆ ไม่รวม BMR
              {" "}— นาฬิกาและแอปอาหารส่วนใหญ่รายงานแบบ gross (รวม BMR) ตัวเลขฝั่งนั้นจึงสูงกว่าเสมอ เอามาเทียบกันตรง ๆ ไม่ได้
            </li>
            <li>
              ตัวเดียวที่รวม BMR แล้วคือ <strong>TDEE เฉลี่ย/วัน</strong> (BMR × 1.35 + การซ้อมเฉลี่ยราย 7 วัน)
              {" "}และ <strong>เป้ากิน/วัน</strong> ที่คำนวณจาก TDEE ลบ deficit เป้าหมาย
            </li>
            <li>ทุกตัวเลขคำนวณที่ running-results แล้ว sync มา — แดชบอร์ดนี้อ่านอย่างเดียว ไม่ได้คิดเลขเอง</li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}
