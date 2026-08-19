import type { BodyComposition, EnergyWeek } from "../types";
import { isoWeekId, shortIsoWeek } from "./calendarDates";

/* ─────────────────────────────────────────────
   Energy — อ่าน energy_weekly ให้เป็นชุดตัวเลขที่หน้าเว็บวาดได้

   ⚠️ kcal ทุกตัวในตารางนี้เป็น **net** (ส่วนที่เกินจากการนอนเฉย ๆ) ยกเว้น
   avg_daily_tdee_kcal ที่รวม BMR ไว้แล้ว — ไฟล์นี้จึงไม่มีที่ไหนบวก BMR เพิ่ม
   ตัวเลขจากนาฬิกา/แอปอาหารส่วนใหญ่เป็น gross จึงสูงกว่าเลขในหน้านี้เสมอ
   ───────────────────────────────────────────── */

export type RunKcalSource = "device" | "estimate" | "mixed" | "none";

export const RUN_KCAL_SOURCE_LABEL: Record<RunKcalSource, string> = {
  device: "จากนาฬิกา",
  estimate: "จากสมการ",
  mixed: "ปนกัน",
  // "none" ไม่ได้แปลว่าไม่รู้ที่มา แต่แปลว่าสัปดาห์นั้นไม่มีวิ่งให้คิดเลย
  // (scripts/energy.py ส่งค่านี้มาตรง ๆ ไม่ใช่ null) — สองอย่างนี้ต้องอ่านต่างกัน
  none: "ไม่มีวิ่ง",
};

export function normalizeSource(value: string | null | undefined): RunKcalSource | null {
  if (value === "device" || value === "estimate" || value === "mixed" || value === "none") return value;
  return null;
}

/**
 * สมการ Keytel ให้ค่าสูงกว่า active calories ของนาฬิกาประมาณ 30% สำหรับนักวิ่ง
 * คนนี้ — สัปดาห์ที่มาจากคนละแหล่งจึงต่างกันด้วย "วิธีวัด" ไม่ใช่ "การซ้อม"
 * ลากเป็นเทรนด์เดียวกันไม่ได้ ต้องเตือนเหมือนกรณี pipeline major ในหน้า Load
 */
export function mixedKcalSources(weeks: EnergyWeek[]): boolean {
  const found = new Set<RunKcalSource>();
  for (const week of weeks) {
    const source = normalizeSource(week.run_kcal_source);
    if (source === "mixed") return true;
    // สัปดาห์ที่ไม่มีวิ่งไม่ได้ปนอะไรกับใคร จึงไม่นับเป็นแหล่งที่สอง
    if (source && source !== "none") found.add(source);
  }
  return found.size > 1;
}

/** สัปดาห์ที่มีนาทีเดาจากจำนวนเซต — ตัวเลข strength_kcal สัปดาห์นั้นหยาบกว่าเพื่อน */
export function estimatedDurationWeeks(weeks: EnergyWeek[]): string[] {
  return weeks.filter((week) => week.has_estimated_duration === true).map((week) => week.iso_week);
}

export type EnergyChartRow = {
  isoWeek: string;
  label: string;
  run: number;
  strength: number;
  cardio: number;
  exercise: number;
  minutes: number | null;
  tdee: number | null;
  target: number | null;
  source: RunKcalSource | null;
  estimated: boolean;
};

/** แถวสำหรับ stacked bar + เส้น TDEE — เรียงเก่าไปใหม่ ตัดเหลือ limit สัปดาห์ล่าสุด */
export function energyChartRows(weeks: EnergyWeek[], limit = 12): EnergyChartRow[] {
  return [...weeks]
    .sort((a, b) => a.iso_week.localeCompare(b.iso_week))
    .slice(-limit)
    .map((week) => ({
      isoWeek: week.iso_week,
      label: shortIsoWeek(week.iso_week),
      run: round(week.run_kcal ?? 0),
      strength: round(week.strength_kcal ?? 0),
      cardio: round(week.cardio_kcal ?? 0),
      exercise: round(week.exercise_kcal ?? sumParts(week)),
      minutes: week.exercise_minutes == null ? null : round(week.exercise_minutes),
      tdee: week.avg_daily_tdee_kcal == null ? null : round(week.avg_daily_tdee_kcal),
      target: week.target_intake_kcal == null ? null : round(week.target_intake_kcal),
      source: normalizeSource(week.run_kcal_source),
      estimated: week.has_estimated_duration === true,
    }));
}

function sumParts(week: EnergyWeek): number {
  return (week.run_kcal ?? 0) + (week.strength_kcal ?? 0) + (week.cardio_kcal ?? 0);
}

function round(value: number): number {
  return Math.round(value);
}

/** สัปดาห์ล่าสุดที่มีข้อมูล — ใช้ค่านี้กับการ์ดบนสุดแทนการ hardcode "สัปดาห์นี้"
    เพราะ CI sync อาจยังไม่ทันสัปดาห์ปัจจุบัน */
export function latestEnergyWeek(weeks: EnergyWeek[]): EnergyWeek | null {
  if (!weeks.length) return null;
  return [...weeks].sort((a, b) => a.iso_week.localeCompare(b.iso_week))[weeks.length - 1];
}

/* ─────────────────────────────────────────────
   น้ำหนักจริง vs deficit ที่วางแผนไว้
   ───────────────────────────────────────────── */

/** น้ำหนักเฉลี่ยต่อ ISO week — ชั่งวันละครั้งบ้างสองครั้งบ้าง การเฉลี่ยลด noise
    รายวัน (น้ำ/อาหาร) ที่แกว่งกว่าการลดไขมันจริงต่อสัปดาห์เสียอีก */
export function weeklyWeight(body: BodyComposition[]): Map<string, number> {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of body) {
    if (row.weight_kg == null || !Number.isFinite(row.weight_kg)) continue;
    const week = isoWeekId(row.measured_date);
    if (!week) continue;
    const current = buckets.get(week) ?? { sum: 0, count: 0 };
    buckets.set(week, { sum: current.sum + row.weight_kg, count: current.count + 1 });
  }
  const out = new Map<string, number>();
  for (const [week, { sum, count }] of buckets) out.set(week, sum / count);
  return out;
}

export type EnergyWeightPoint = {
  isoWeek: string;
  label: string;
  exercise: number;
  /** น้ำหนักจริงเฉลี่ยของสัปดาห์นั้น (null = ไม่ได้ชั่งเลย) */
  weightKg: number | null;
  /** น้ำหนักที่ควรเป็นถ้ากินตามเป้าทุกวัน — ไต่ลงจากน้ำหนักตั้งต้นตาม expected_kg_per_week */
  expectedKg: number | null;
};

/**
 * กราฟที่ตอบคำถามจริง ๆ ว่า "deficit ที่วางไว้เกิดขึ้นจริงไหม" — เอาน้ำหนักที่
 * ชั่งได้ทาบกับเส้นน้ำหนักที่ควรเป็นตาม expected_kg_per_week โดยยึดสัปดาห์แรก
 * ที่มีน้ำหนักจริงเป็นจุดตั้งต้น (เทียบ "ทิศทางที่เปลี่ยนไป" ไม่ใช่ค่าสัมบูรณ์
 * เพราะ TDEE ที่คำนวณมี error bar ของมันเอง)
 */
export function energyWeightSeries(weeks: EnergyWeek[], body: BodyComposition[]): EnergyWeightPoint[] {
  const sorted = [...weeks].sort((a, b) => a.iso_week.localeCompare(b.iso_week));
  const weights = weeklyWeight(body);

  let expected: number | null = null;
  return sorted.map((week) => {
    const actual = weights.get(week.iso_week) ?? null;
    // ตั้งต้นเส้นคาดหวังที่สัปดาห์แรกซึ่งมีน้ำหนักจริง แล้วหลังจากนั้นเดินตามแผนอย่างเดียว
    if (expected == null && actual != null) expected = actual;
    else if (expected != null) expected -= week.expected_kg_per_week ?? 0;

    return {
      isoWeek: week.iso_week,
      label: shortIsoWeek(week.iso_week),
      exercise: round(week.exercise_kcal ?? sumParts(week)),
      weightKg: actual == null ? null : Number(actual.toFixed(2)),
      expectedKg: expected == null ? null : Number(expected.toFixed(2)),
    };
  });
}

export type DeficitReality = {
  /** น้ำหนักที่หายจริงระหว่างจุดชั่งแรกกับจุดชั่งสุดท้ายในช่วง (บวก = ลดลง) */
  actualLossKg: number;
  /** น้ำหนักที่แผนคาดว่าจะหายในช่วงเดียวกัน */
  expectedLossKg: number;
  /** actual − expected: ลบ = ลดช้ากว่าแผน, บวก = ลดเร็วกว่าแผน */
  gapKg: number;
  weeks: number;
};

/** สรุปเป็นประโยคเดียวว่าแผนกับความจริงห่างกันแค่ไหน — null เมื่อชั่งไม่ถึงสองครั้ง
    ในช่วงที่มีข้อมูลพลังงาน (เทียบไม่ได้ ก็ไม่ควรเดา) */
export function deficitReality(points: EnergyWeightPoint[]): DeficitReality | null {
  const measured = points.filter((point) => point.weightKg != null);
  if (measured.length < 2) return null;
  const first = measured[0];
  const last = measured[measured.length - 1];
  const actualLossKg = (first.weightKg as number) - (last.weightKg as number);
  const expectedLossKg =
    first.expectedKg != null && last.expectedKg != null ? first.expectedKg - last.expectedKg : 0;
  const startIndex = points.indexOf(first);
  const endIndex = points.indexOf(last);
  return {
    actualLossKg: Number(actualLossKg.toFixed(2)),
    expectedLossKg: Number(expectedLossKg.toFixed(2)),
    gapKg: Number((actualLossKg - expectedLossKg).toFixed(2)),
    weeks: endIndex - startIndex,
  };
}
