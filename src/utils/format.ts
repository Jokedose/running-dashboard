import { stripMarkdown } from "./thaiText";

export function pace(value: number | null | undefined) {
  if (!value) return "-";
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

export function paceMinutes(value: number | null | undefined) {
  return value ? Number((value / 60).toFixed(2)) : null;
}

export function km(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(2)} km`;
}

export function minutes(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value)} นาที`;
}

export function raceTime(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  const totalSeconds = Math.round(value * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutesPart = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutesPart).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function percent(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

export function shortDate(date: string | null | undefined) {
  return date ? date.slice(5) : "-";
}

const SESSION_NORMALIZE: Array<[RegExp, string]> = [
  [/recovery easy/i, "Recovery easy"],
  [/recovery run/i, "Recovery run"],
  [/recovery/i, "Recovery"],
  [/long easy/i, "Long easy"],
  [/long run/i, "Long run"],
  [/easy \+ strides/i, "Easy + strides"],
  [/easy run/i, "Easy run"],
  [/easy strides/i, "Easy + strides"],
  [/^easy$/i, "Easy"],
  [/tempo \/ steady/i, "Tempo / steady"],
  [/tempo interval/i, "Tempo interval"],
  [/^tempo$/i, "Tempo"],
  [/vo2max interval/i, "VO2max interval"],
  [/vo2max/i, "VO2max"],
  [/race pace/i, "Race pace"],
  [/race simulation/i, "Race simulation"],
  [/race day/i, "Race day"],
  [/^race$/i, "Race"],
  [/calibration test/i, "Calibration test"],
  [/calibration/i, "Calibration"],
  [/5k test/i, "5K test"],
  [/3k test/i, "3K test"],
  [/threshold/i, "Threshold"],
  [/intervals?/i, "Interval"],
  [/quality/i, "Quality"],
  [/shakeout/i, "Shakeout"],
  [/^rest$/i, "Rest"],
  [/mobility/i, "Mobility"],
];

export function sessionLabel(value: string | null | undefined, fallback = "-"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  for (const [re, label] of SESSION_NORMALIZE) {
    if (re.test(trimmed)) return label;
  }
  return stripMarkdown(trimmed);
}

/** แตกข้อความ "รายการซ้อม" เป็นราย segment (WU / main reps / CD ฯลฯ) — ไฟล์ schedule
    ต้นทางเขียนแต่ละ segment คั่นด้วย " + " เสมอ (เช่น "WU 12 นาที (Z1-Z2, HR <153) +
    6 x 400 m @ Z5 (...) + CD 10 นาที (...)") การแตกเป็น list ทำให้ปฏิทินโชว์ HR/pace
    ต่อรอบชัดแทนที่จะอัดรวมเป็นประโยคเดียวยาว ๆ */
export function workoutSegments(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\s*\+\s*/)
    .map((part) => stripMarkdown(part.trim()))
    .filter(Boolean);
}
