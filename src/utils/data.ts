import type { DashboardData, RaceGoal } from "../types";

export const emptyData: DashboardData = {
  daily: [],
  runs: [],
  weekly: [],
  gear: [],
  races: [],
  plan: [],
  strengthPlan: [],
  body: [],
  monthly: [],
  injuries: [],
  raceGoals: [],
  profile: null,
  criteria: [],
  gateRules: [],
  phases: [],
  trainingLoad: [],
  intensity: [],
  energy: [],
};

export const chartMargin = { top: 8, right: 8, bottom: 0, left: -16 };

export function latest<T>(rows: T[], dateKey: keyof T) {
  return [...rows].sort((a, b) => String(b[dateKey]).localeCompare(String(a[dateKey])))[0];
}

export function todayIso(): string {
  // วันที่ตามเครื่องผู้ใช้ (Asia/Bangkok) — ห้ามใช้ toISOString() เพราะเป็น UTC:
  // ช่วงเที่ยงคืนถึง 7 โมงเช้าไทยจะกลายเป็น "เมื่อวาน" ทำให้ gate/countdown เพี้ยน
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// เลือก race goal ที่ "กำลังจะถึง" ก่อน (วันที่ใกล้สุดที่ >= วันนี้)
// ถ้าไม่มีเลย (ทุกแข่งผ่านไปแล้ว) ใช้แข่งล่าสุดที่ผ่านมา — generalize IS_B_RACE เดิมให้รองรับ N แข่ง
export function resolveCurrentRaceGoal(goals: RaceGoal[], today: string): RaceGoal | null {
  const active = goals.filter((goal) => !goal.tags?.some((tag) => tag.toLowerCase() === "#cancelled"));
  if (!active.length) return null;
  const sorted = [...active].sort((a, b) => a.race_date.localeCompare(b.race_date));
  return sorted.find((g) => g.race_date >= today) ?? sorted.at(-1) ?? null;
}

export function average(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function clamp(value: number | null | undefined, min = 0, max = 100) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

/* ─────────────────────────────────────────────
   Pipeline version — ตัวบอกว่าแถวไหนคำนวณด้วยนิยามชุดไหน
   ───────────────────────────────────────────── */

/**
 * MAJOR ของ pipeline version = "metric เดิมเปลี่ยนความหมาย" ดังนั้นแถวที่ MAJOR
 * ต่างกันเอามาวาดเส้นเดียวกันไม่ได้ (เช่น 2026-08-18 "decoupling" เปลี่ยนจาก drift
 * เป็น Pa:HR และระยะ main เลิกรวม warm-up) — ส่วน MINOR/PATCH ต่างกันไม่เป็นไร
 * เพราะค่าเดิมไม่ขยับตามนิยามใน running-results/scripts/version.py
 */
export function majorVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const major = version.split(".")[0];
  return /^\d+$/.test(major) ? major : null;
}

/** MAJOR ที่พบในชุดข้อมูล เรียงจากเก่าไปใหม่ — ความยาว > 1 คือเส้นกราฟกำลังปนนิยาม */
export function pipelineMajors(rows: Array<{ pipeline_version: string | null }>): string[] {
  const found = new Set<string>();
  for (const row of rows) {
    const major = majorVersion(row.pipeline_version);
    if (major) found.add(major);
  }
  return [...found].sort((a, b) => Number(a) - Number(b));
}

/** แถวที่ยังไม่มี version = sync มาก่อนที่ระบบ version จะมี จึงไม่รู้ว่านิยามไหน */
export function unversionedCount(rows: Array<{ pipeline_version: string | null }>): number {
  return rows.filter((row) => !row.pipeline_version).length;
}
