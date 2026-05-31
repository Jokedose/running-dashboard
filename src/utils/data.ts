import type { DashboardData } from "../types";

export const emptyData: DashboardData = {
  daily: [],
  runs: [],
  weekly: [],
  gear: [],
  race: null,
};

export const chartMargin = { top: 8, right: 8, bottom: 0, left: -16 };

export function latest<T>(rows: T[], dateKey: keyof T) {
  return [...rows].sort((a, b) => String(b[dateKey]).localeCompare(String(a[dateKey])))[0];
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
