import { describe, expect, test } from "bun:test";
import { strengthSummary, strengthWeekBuckets } from "../src/utils/strength";
import type { StrengthPlan } from "../src/types";

const plan = (plan_date: string, status: StrengthPlan["status"], session_type = "kb-full"): StrengthPlan =>
  ({
    id: `${plan_date}-${status}`,
    plan_date,
    session_type,
    planned_moves: null,
    status,
    actual_moves: null,
    notes: null,
    created_at: null,
  }) as StrengthPlan;

// 2026-08-19 = พุธ ของ 2026-W34 (จันทร์ 17 → อาทิตย์ 23)
const TODAY = "2026-08-19";

describe("strengthWeekBuckets", () => {
  test("นับ planned/done/skipped ต่อ ISO week และคงสัปดาห์ว่างไว้เป็นแท่งศูนย์", () => {
    const buckets = strengthWeekBuckets(
      [plan("2026-08-17", "done"), plan("2026-08-18", "skipped"), plan("2026-08-20", "planned"), plan("2026-08-11", "done")],
      TODAY,
      3,
    );
    expect(buckets.map((b) => b.isoWeek)).toEqual(["2026-W32", "2026-W33", "2026-W34"]);
    expect(buckets[0]).toMatchObject({ planned: 0, done: 0, skipped: 0 });
    expect(buckets[1]).toMatchObject({ planned: 1, done: 1 });
    expect(buckets[2]).toMatchObject({ planned: 3, done: 1, skipped: 1 });
  });

  test("แผนที่อยู่นอกช่วงย้อนหลังไม่ถูกนับ", () => {
    const buckets = strengthWeekBuckets([plan("2026-06-01", "done")], TODAY, 4);
    expect(buckets.every((b) => b.planned === 0)).toBe(true);
  });
});

describe("strengthSummary", () => {
  test("นับสัปดาห์นี้จากวันจันทร์ถึงอาทิตย์ ไม่ใช่ 7 วันย้อนหลัง", () => {
    const summary = strengthSummary(
      [plan("2026-08-16", "done"), plan("2026-08-17", "done"), plan("2026-08-21", "planned")],
      TODAY,
    );
    expect(summary.weekPlanned).toBe(2); // 16 ส.ค. เป็นอาทิตย์ของสัปดาห์ก่อน
    expect(summary.weekDone).toBe(1);
  });

  test("เซสชันสะสมเดือนนี้นับเฉพาะที่ทำจริง", () => {
    const summary = strengthSummary(
      [plan("2026-08-03", "done"), plan("2026-08-05", "skipped"), plan("2026-07-30", "done")],
      TODAY,
    );
    expect(summary.monthDone).toBe(1);
  });

  test("วันถัดไปที่วางแผนไว้คือรายการแรกที่ยังไม่ทำและไม่ข้าม", () => {
    const summary = strengthSummary(
      [plan("2026-08-19", "done"), plan("2026-08-20", "skipped"), plan("2026-08-21", "planned"), plan("2026-08-25", "planned")],
      TODAY,
    );
    expect(summary.nextSession?.plan_date).toBe("2026-08-21");
  });

  test("ไม่มีแผนข้างหน้าเลย ให้เป็น null แทนการเดา", () => {
    expect(strengthSummary([plan("2026-08-10", "done")], TODAY).nextSession).toBeNull();
  });
});

describe("streak สัปดาห์ที่ทำครบ", () => {
  test("นับต่อเนื่องย้อนหลังจนกว่าจะเจอสัปดาห์ที่ทำไม่ครบ", () => {
    const plans = [
      plan("2026-08-11", "done"), // W33 ครบ
      plan("2026-08-04", "done"), // W32 ครบ
      plan("2026-07-28", "done"), // W31 ไม่ครบ
      plan("2026-07-29", "skipped"),
      plan("2026-07-21", "done"), // W30 ครบ แต่ถูกตัดไปแล้ว
    ];
    expect(strengthSummary(plans, TODAY).streakWeeks).toBe(2);
  });

  test("สัปดาห์ปัจจุบันที่ยังทำไม่ครบไม่ตัด streak เพราะมันยังไม่จบ", () => {
    const plans = [plan("2026-08-19", "planned"), plan("2026-08-11", "done"), plan("2026-08-04", "done")];
    expect(strengthSummary(plans, TODAY).streakWeeks).toBe(2);
  });

  test("สัปดาห์ปัจจุบันที่ทำครบแล้วนับเข้า streak ทันที", () => {
    const plans = [plan("2026-08-18", "done"), plan("2026-08-11", "done")];
    expect(strengthSummary(plans, TODAY).streakWeeks).toBe(2);
  });

  test("สัปดาห์ที่ไม่มีแผนเลยข้ามไป ไม่นับและไม่ตัด", () => {
    const plans = [plan("2026-08-11", "done"), plan("2026-07-28", "done")]; // W33 กับ W31, W32 ว่าง
    expect(strengthSummary(plans, TODAY).streakWeeks).toBe(2);
  });

  test("ไม่มีแผนเลย streak = 0", () => {
    expect(strengthSummary([], TODAY).streakWeeks).toBe(0);
  });
});
