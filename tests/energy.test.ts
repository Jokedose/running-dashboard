import { describe, expect, test } from "bun:test";
import { isoWeekId, isoWeekStart, shortIsoWeek } from "../src/utils/calendarDates";
import {
  deficitReality,
  isEstimatedRunKcal,
  runKcalSourceLabel,
  totalRunKcal,
  energyChartRows,
  energyWeightSeries,
  estimatedDurationWeeks,
  latestEnergyWeek,
  mixedKcalSources,
  normalizeSource,
  weeklyWeight,
} from "../src/utils/energy";
import type { BodyComposition, EnergyWeek } from "../src/types";

const week = (overrides: Partial<EnergyWeek>): EnergyWeek =>
  ({
    id: overrides.iso_week ?? "e1",
    iso_week: "2026-W34",
    run_kcal: 1200,
    strength_kcal: 300,
    cardio_kcal: 100,
    exercise_kcal: 1600,
    exercise_minutes: 240,
    avg_daily_tdee_kcal: 2400,
    target_intake_kcal: 2025,
    deficit_target_kcal: 375,
    expected_kg_per_week: 0.34,
    has_estimated_duration: false,
    run_kcal_source: "device",
    pipeline_version: "1.0.0",
    updated_at: null,
    ...overrides,
  }) as EnergyWeek;

const body = (measured_date: string, weight_kg: number | null): BodyComposition =>
  ({
    id: measured_date,
    measured_date,
    weight_kg,
    bmi: null,
    body_score: null,
    body_fat_pct: null,
    body_fat_mass_kg: null,
    subcutaneous_fat_pct: null,
    visceral_fat_level: null,
    muscle_mass_kg: null,
    muscle_pct: null,
    skeletal_muscle_kg: null,
    body_water_pct: null,
    protein_mass_kg: null,
    bone_mineral_kg: null,
    fat_free_mass_kg: null,
    bmr_kcal: null,
    body_age: null,
    source: null,
  }) as BodyComposition;

describe("ISO week helpers", () => {
  test("แปลงวันที่เป็น ISO week id ตามนิยาม ISO-8601", () => {
    expect(isoWeekId("2026-08-19")).toBe("2026-W34");
    // 1 ม.ค. 2027 เป็นวันศุกร์ จึงยังอยู่ในสัปดาห์สุดท้ายของปี 2026
    expect(isoWeekId("2027-01-01")).toBe("2026-W53");
    expect(isoWeekId("not-a-date")).toBeNull();
  });

  test("ย้อนกลับจาก week id เป็นวันจันทร์ได้ตรงกัน", () => {
    expect(isoWeekStart("2026-W34")).toBe("2026-08-17");
    expect(isoWeekId(isoWeekStart("2026-W01") as string)).toBe("2026-W01");
    expect(isoWeekStart("W34")).toBeNull();
  });

  test("ป้ายแกน x ตัดปีออก", () => {
    expect(shortIsoWeek("2026-W34")).toBe("W34");
  });
});

describe("run_kcal_source", () => {
  test("รับเฉพาะค่าที่รู้จัก", () => {
    expect(normalizeSource("device")).toBe("device");
    expect(normalizeSource("estimate")).toBe("estimate");
    expect(normalizeSource("garmin")).toBeNull();
    expect(normalizeSource(null)).toBeNull();
  });

  test("แหล่งเดียวกันทั้งช่วง = ไม่ต้องเตือน", () => {
    expect(mixedKcalSources([week({ iso_week: "2026-W33" }), week({ iso_week: "2026-W34" })])).toBe(false);
  });

  test("device ปนกับ estimate ต้องเตือน เพราะสองแหล่งต่างกันเชิงระดับ ~30%", () => {
    expect(
      mixedKcalSources([
        week({ iso_week: "2026-W33", run_kcal_source: "device" }),
        week({ iso_week: "2026-W34", run_kcal_source: "estimate" }),
      ]),
    ).toBe(true);
  });

  test("สัปดาห์เดียวที่เป็น mixed ก็พอให้เตือนแล้ว", () => {
    expect(mixedKcalSources([week({ run_kcal_source: "mixed" })])).toBe(true);
  });

  // scripts/energy.py ส่ง "none" มาสำหรับสัปดาห์ที่ไม่มีวิ่งเลย (ไม่ใช่ null)
  test("สัปดาห์ที่ไม่มีวิ่งไม่นับเป็นแหล่งที่สอง จึงไม่ทำให้ขึ้นคำเตือน", () => {
    expect(normalizeSource("none")).toBe("none");
    expect(
      mixedKcalSources([
        week({ iso_week: "2026-W33", run_kcal_source: "device" }),
        week({ iso_week: "2026-W34", run_kcal: 0, run_kcal_source: "none" }),
      ]),
    ).toBe(false);
  });
});

describe("energyChartRows", () => {
  test("เรียงเก่าไปใหม่ ตัดเหลือ limit สัปดาห์ล่าสุด", () => {
    const rows = energyChartRows(
      [week({ iso_week: "2026-W34" }), week({ iso_week: "2026-W32" }), week({ iso_week: "2026-W33" })],
      2,
    );
    expect(rows.map((row) => row.isoWeek)).toEqual(["2026-W33", "2026-W34"]);
  });

  test("null kcal นับเป็นศูนย์ในแท่ง แต่ TDEE/เป้ากินที่ null ต้องคง null ไว้ให้กราฟเว้นช่วง", () => {
    const [row] = energyChartRows([
      week({ run_kcal: null, strength_kcal: null, cardio_kcal: null, exercise_kcal: null, avg_daily_tdee_kcal: null, target_intake_kcal: null }),
    ]);
    expect(row.run).toBe(0);
    expect(row.exercise).toBe(0);
    expect(row.tdee).toBeNull();
    expect(row.target).toBeNull();
  });

  test("ไม่มี exercise_kcal ให้รวมจากสามหมวดแทน — ไม่มีที่ไหนบวก BMR เพิ่ม", () => {
    const [row] = energyChartRows([week({ exercise_kcal: null, run_kcal: 1000, strength_kcal: 200, cardio_kcal: 50 })]);
    expect(row.exercise).toBe(1250);
  });

  test("รู้ว่าสัปดาห์ไหนเวลา strength เป็นค่าประมาณ", () => {
    const weeks = [week({ iso_week: "2026-W33", has_estimated_duration: true }), week({ iso_week: "2026-W34" })];
    expect(estimatedDurationWeeks(weeks)).toEqual(["2026-W33"]);
  });

  test("latestEnergyWeek หยิบสัปดาห์ล่าสุดแม้ข้อมูลเข้ามาไม่เรียง", () => {
    const found = latestEnergyWeek([week({ iso_week: "2026-W34" }), week({ iso_week: "2026-W35" }), week({ iso_week: "2026-W33" })]);
    expect(found?.iso_week).toBe("2026-W35");
    expect(latestEnergyWeek([])).toBeNull();
  });
});

describe("น้ำหนักจริง vs แผน", () => {
  test("เฉลี่ยน้ำหนักต่อสัปดาห์เพื่อลด noise รายวัน", () => {
    const map = weeklyWeight([body("2026-08-17", 70), body("2026-08-19", 71), body("2026-08-24", 69.5), body("2026-08-25", null)]);
    expect(map.get("2026-W34")).toBeCloseTo(70.5, 5);
    expect(map.get("2026-W35")).toBeCloseTo(69.5, 5);
  });

  test("เส้นน้ำหนักตามแผนเริ่มที่สัปดาห์แรกซึ่งมีการชั่งจริง แล้วไต่ลงตาม expected_kg_per_week", () => {
    const weeks = [
      week({ iso_week: "2026-W33", expected_kg_per_week: 0.3 }),
      week({ iso_week: "2026-W34", expected_kg_per_week: 0.3 }),
      week({ iso_week: "2026-W35", expected_kg_per_week: 0.3 }),
    ];
    const points = energyWeightSeries(weeks, [body("2026-08-10", 70), body("2026-08-24", 69.8)]);
    expect(points.map((p) => p.expectedKg)).toEqual([70, 69.7, 69.4]);
    expect(points.map((p) => p.weightKg)).toEqual([70, null, 69.8]);
  });

  test("สัปดาห์ก่อนการชั่งครั้งแรกยังไม่มีเส้นแผน", () => {
    const points = energyWeightSeries(
      [week({ iso_week: "2026-W33" }), week({ iso_week: "2026-W34" })],
      [body("2026-08-19", 70)],
    );
    expect(points[0].expectedKg).toBeNull();
    expect(points[1].expectedKg).toBe(70);
  });

  test("สรุปว่าลดจริงช้ากว่าแผนแค่ไหน", () => {
    const weeks = [
      week({ iso_week: "2026-W33", expected_kg_per_week: 0.3 }),
      week({ iso_week: "2026-W34", expected_kg_per_week: 0.3 }),
      week({ iso_week: "2026-W35", expected_kg_per_week: 0.3 }),
    ];
    const points = energyWeightSeries(weeks, [body("2026-08-10", 70), body("2026-08-24", 69.9)]);
    const reality = deficitReality(points);
    expect(reality?.actualLossKg).toBeCloseTo(0.1, 5);
    expect(reality?.expectedLossKg).toBeCloseTo(0.6, 5);
    expect(reality?.gapKg).toBeCloseTo(-0.5, 5); // ติดลบ = ลดช้ากว่าแผน
    expect(reality?.weeks).toBe(2);
  });

  test("ชั่งไม่ถึงสองครั้งก็ไม่เดา", () => {
    const points = energyWeightSeries([week({})], [body("2026-08-19", 70)]);
    expect(deficitReality(points)).toBeNull();
  });
});

describe("พลังงานรายรัน (run_logs.kcal_net)", () => {
  test("แปลง kcal_source เป็นภาษาไทย และไม่เดาค่าที่ไม่รู้จัก", () => {
    expect(runKcalSourceLabel("coros-device")).toBe("จากนาฬิกา");
    expect(runKcalSourceLabel("keytel-hr")).toBe("จากสมการ HR");
    expect(runKcalSourceLabel("met")).toBe("จากค่า MET");
    expect(runKcalSourceLabel("garmin")).toBeNull();
    expect(runKcalSourceLabel(null)).toBeNull();
  });

  // ค่าจากสมการสูงกว่านาฬิการาว 30% จึงต้องกำกับไว้ว่าเทียบตรง ๆ กับแถวอื่นไม่ได้
  test("รู้ว่าแถวไหนเป็นค่าประมาณ", () => {
    expect(isEstimatedRunKcal("keytel-hr")).toBe(true);
    expect(isEstimatedRunKcal("met")).toBe(true);
    expect(isEstimatedRunKcal("coros-device")).toBe(false);
    expect(isEstimatedRunKcal(null)).toBe(false);
  });

  test("รวม kcal เฉพาะรันที่มีค่า", () => {
    expect(totalRunKcal([{ kcal_net: 300 }, { kcal_net: null }, { kcal_net: 225.5 }])).toBeCloseTo(525.5, 5);
  });

  // ฐานที่ยังไม่ได้ apply migration 014 ต้องได้ null ไม่ใช่ 0 — ศูนย์แปลว่า "ไม่ได้เผาอะไรเลย"
  test("ไม่มีรันไหนมีค่า = null ไม่ใช่ 0", () => {
    expect(totalRunKcal([{ kcal_net: null }, { kcal_net: null }])).toBeNull();
    expect(totalRunKcal([])).toBeNull();
  });
});
