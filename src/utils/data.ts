import type { DashboardData, RaceGoal } from "../types";

export const emptyData: DashboardData = {
  daily: [],
  runs: [],
  weekly: [],
  gear: [],
  race: null,
  plan: [],
  body: [],
  monthly: [],
  injuries: [],
  raceGoals: [],
  profile: null,
  criteria: [],
  gateRules: [],
};

export const chartMargin = { top: 8, right: 8, bottom: 0, left: -16 };

export function latest<T>(rows: T[], dateKey: keyof T) {
  return [...rows].sort((a, b) => String(b[dateKey]).localeCompare(String(a[dateKey])))[0];
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// เลือก race goal ที่ "กำลังจะถึง" ก่อน (วันที่ใกล้สุดที่ >= วันนี้)
// ถ้าไม่มีเลย (ทุกแข่งผ่านไปแล้ว) ใช้แข่งล่าสุดที่ผ่านมา — generalize IS_B_RACE เดิมให้รองรับ N แข่ง
export function resolveCurrentRaceGoal(goals: RaceGoal[], today: string): RaceGoal | null {
  if (!goals.length) return null;
  const sorted = [...goals].sort((a, b) => a.race_date.localeCompare(b.race_date));
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
