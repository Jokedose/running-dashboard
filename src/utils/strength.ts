import type { StrengthPlan } from "../types";
import { addDays, isoWeekId, shortIsoWeek, weekDates } from "./calendarDates";

/* ─────────────────────────────────────────────
   Strength — สรุป strength_plan ให้เป็นตัวเลขไม่กี่ตัวที่ตอบว่า "ทำตามแผนไหม"
   แยกจาก UI เพื่อให้ test ได้โดยไม่ต้อง render component
   ───────────────────────────────────────────── */

export type StrengthWeekBucket = {
  isoWeek: string;
  label: string;
  planned: number;
  done: number;
  skipped: number;
};

/** นับ planned/done ต่อ ISO week ย้อนหลัง n สัปดาห์ (รวมสัปดาห์ปัจจุบัน)
    สัปดาห์ที่ไม่มีแผนเลยยังคงอยู่ในกราฟเป็นแท่งศูนย์ — ช่องว่างคือข้อมูล ไม่ใช่ noise */
export function strengthWeekBuckets(plans: StrengthPlan[], today: string, weeks = 8): StrengthWeekBucket[] {
  const keys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const week = isoWeekId(addDays(today, -7 * i));
    if (week && !keys.includes(week)) keys.push(week);
  }

  const buckets = new Map<string, StrengthWeekBucket>(
    keys.map((isoWeek) => [isoWeek, { isoWeek, label: shortIsoWeek(isoWeek), planned: 0, done: 0, skipped: 0 }]),
  );

  for (const plan of plans) {
    const week = isoWeekId(plan.plan_date);
    const bucket = week ? buckets.get(week) : undefined;
    if (!bucket) continue;
    bucket.planned += 1;
    if (plan.status === "done") bucket.done += 1;
    if (plan.status === "skipped") bucket.skipped += 1;
  }

  return keys.map((key) => buckets.get(key)!);
}

export type StrengthSummary = {
  weekDone: number;
  weekPlanned: number;
  /** จำนวนสัปดาห์ติดกันที่ทำครบทุกเซสชันที่วางไว้ */
  streakWeeks: number;
  monthDone: number;
  nextSession: StrengthPlan | null;
};

export function strengthSummary(plans: StrengthPlan[], today: string): StrengthSummary {
  const thisWeek = new Set(weekDates(today));
  const weekRows = plans.filter((plan) => thisWeek.has(plan.plan_date));
  const month = today.slice(0, 7);

  const upcoming = plans
    .filter((plan) => plan.plan_date >= today && plan.status !== "skipped" && plan.status !== "done")
    .sort((a, b) => a.plan_date.localeCompare(b.plan_date));

  return {
    weekDone: weekRows.filter((plan) => plan.status === "done").length,
    weekPlanned: weekRows.length,
    streakWeeks: completedWeekStreak(plans, today),
    monthDone: plans.filter((plan) => plan.plan_date.startsWith(month) && plan.status === "done").length,
    nextSession: upcoming[0] ?? null,
  };
}

/**
 * นับถอยหลังจากสัปดาห์ปัจจุบัน: สัปดาห์ที่ทำครบ (done ≥ planned) ต่อกันได้กี่สัปดาห์
 * — สัปดาห์ปัจจุบันที่ยังทำไม่ครบไม่ตัด streak เพราะมันยังไม่จบ ส่วนสัปดาห์ที่
 *   ไม่มีแผนเลยก็ข้ามไปเฉย ๆ (ไม่มีอะไรให้ "ทำครบ" หรือ "พลาด")
 */
function completedWeekStreak(plans: StrengthPlan[], today: string): number {
  const buckets = new Map<string, { planned: number; done: number }>();
  for (const plan of plans) {
    const week = isoWeekId(plan.plan_date);
    if (!week) continue;
    const current = buckets.get(week) ?? { planned: 0, done: 0 };
    buckets.set(week, {
      planned: current.planned + 1,
      done: current.done + (plan.status === "done" ? 1 : 0),
    });
  }

  let streak = 0;
  for (let i = 0; i < 104; i++) {
    const week = isoWeekId(addDays(today, -7 * i));
    if (!week) break;
    const bucket = buckets.get(week);
    if (!bucket || bucket.planned === 0) continue;
    if (bucket.done >= bucket.planned) {
      streak += 1;
      continue;
    }
    if (i === 0) continue; // สัปดาห์นี้ยังเดินอยู่ ยังไม่นับว่าพลาด
    break;
  }
  return streak;
}
