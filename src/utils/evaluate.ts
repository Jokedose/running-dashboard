import type {
  DailyReadiness,
  GateCondition,
  GateSeverity,
  HrZone,
  ReadinessGateRule,
  RunLog,
  RunnerProfile,
  SessionCriteria,
} from "../types";
import { classifySession, type SessionKind } from "./session";

/* ─────────────────────────────────────────────
   Defaults — mirror ของ rules/*.md + zones.md ฝั่ง running-results
   ณ 2026-07-20 ใช้เฉพาะตอนตาราง config ใน Supabase ยังว่าง
   (sync ยังไม่รัน / offline) — ห้ามแก้ตัวเลขที่นี่โดยไม่แก้ฝั่ง .md
   ───────────────────────────────────────────── */

export const DEFAULT_ZONES: HrZone[] = [
  { zone: "Z1", min: null, max: 140, label: "วอร์มอัป, คูลดาวน์, ฟื้นตัว" },
  { zone: "Z2", min: 140, max: 153, label: "Easy run, long run, สร้าง aerobic base" },
  { zone: "Z3", min: 153, max: 166, label: "Steady, tempo, race effort แบบคุมได้" },
  { zone: "Z4", min: 166, max: 180, label: "Interval, ช่วงหนัก" },
  { zone: "Z5", min: 180, max: null, label: "Sprint, หนักมาก" },
];

export const DEFAULT_PROFILE: RunnerProfile = {
  user_id: "default",
  age: null,
  weight_kg: null,
  resting_hr_bpm: 60,
  hr_max_bpm: 193,
  hrr_bpm: 133,
  easy_hr_min: 144,
  easy_hr_max: 150,
  easy_hr_ceiling: 153,
  sweet_spot_min: 144,
  sweet_spot_max: 148,
  zones: DEFAULT_ZONES,
  easy_pace_text: null,
  updated_at: null,
};

const defaultCriteria = (kind: string, values: Partial<SessionCriteria>): SessionCriteria => ({
  id: `default-${kind}`,
  session_kind: kind,
  z2_min_percent: null,
  drift_max_bpm: null,
  decoupling_max_percent: null,
  hr_avg_max_bpm: null,
  z4z5_max_percent: null,
  notes_good: null,
  notes_fix: null,
  notes_avoid: null,
  ...values,
});

export const DEFAULT_CRITERIA: SessionCriteria[] = [
  defaultCriteria("easy", { z2_min_percent: 85, drift_max_bpm: 5, decoupling_max_percent: 5, hr_avg_max_bpm: 150 }),
  defaultCriteria("recovery", { z2_min_percent: 85, drift_max_bpm: 5, decoupling_max_percent: 5, hr_avg_max_bpm: 145 }),
  defaultCriteria("long", { z2_min_percent: 75, decoupling_max_percent: 5 }),
  defaultCriteria("tempo", { hr_avg_max_bpm: 173, z4z5_max_percent: 25 }),
  defaultCriteria("strides", { z2_min_percent: 85 }),
  defaultCriteria("test", {}),
];

export const DEFAULT_GATE_RULES: ReadinessGateRule[] = [
  {
    id: "default-1",
    rule_order: 1,
    signal: "Recovery ≥ 80%, HRV normal/above, sleep ≥ 6h, load ratio 0.8–1.2",
    condition: { recovery_min: 80, hrv_status: ["normal", "above"], sleep_min_h: 6, load_ratio_min: 0.8, load_ratio_max: 1.2 },
    decision: "Quality allowed",
    severity: "ok",
  },
  {
    id: "default-2",
    rule_order: 2,
    signal: "Recovery สูงแต่ HRV ต่ำกว่า normal",
    condition: { recovery_min: 80, hrv_status: ["below"] },
    decision: "ลด quality 30–40% หรือเปลี่ยนเป็น easy",
    severity: "caution",
  },
  {
    id: "default-3",
    rule_order: 3,
    signal: "Sleep < 5.5h",
    condition: { sleep_max_h: 5.5 },
    decision: "Recovery/easy เท่านั้น",
    severity: "caution",
  },
  {
    id: "default-4",
    rule_order: 4,
    signal: "Load ratio > 1.3",
    condition: { load_ratio_over: 1.3 },
    decision: "ลด volume/intensity",
    severity: "caution",
  },
  {
    id: "default-5",
    rule_order: 5,
    signal: "Pain/tightness ใน run ก่อนหน้า",
    condition: { prev_run_pain: true },
    decision: "Downshift หรือหยุดเร็วถ้าซ้ำ",
    severity: "caution",
  },
  {
    id: "default-6",
    rule_order: 6,
    signal: "ถนนเปียก / ฝนตก",
    condition: { rain: true },
    decision: "เปลี่ยนเป็น easy, งด strides/intervals",
    severity: "caution",
  },
];

/* ─────────────────────────────────────────────
   Config resolution — db ก่อน, default เมื่อยังไม่มี
   ───────────────────────────────────────────── */

export function resolveProfile(profile: RunnerProfile | null | undefined): RunnerProfile {
  if (!profile) return DEFAULT_PROFILE;
  if (!profile.zones || profile.zones.length === 0) return { ...profile, zones: DEFAULT_ZONES };
  return profile;
}

// vo2/interval ยังไม่มีเกณฑ์ของตัวเองใน rules/session-criteria.md —
// ใช้เกณฑ์ tempo (quality bucket เดียวกัน: HR cap + Z4/Z5 cap) ไปก่อน
const CRITERIA_KIND_ALIAS: Partial<Record<SessionKind, string>> = { vo2: "tempo" };

export function criteriaFor(kind: SessionKind, criteria: SessionCriteria[]): SessionCriteria | null {
  const lookup = CRITERIA_KIND_ALIAS[kind] ?? kind;
  const source = criteria.length ? criteria : DEFAULT_CRITERIA;
  return source.find((row) => row.session_kind === lookup) ?? null;
}

/* ─────────────────────────────────────────────
   zoneOf — แทนตัวเลข 140/153/166/180 ที่เคย hardcode
   ───────────────────────────────────────────── */

export function zoneOf(hr: number | null | undefined, profile?: RunnerProfile | null): string | null {
  if (hr == null || !Number.isFinite(hr)) return null;
  const zones = resolveProfile(profile).zones;
  for (const zone of zones) {
    const aboveMin = zone.min == null || hr >= zone.min;
    // โซนเปิดล่าง (Z1 "<140") ขอบบนเป็น exclusive; โซนช่วง ("140-153")
    // ขอบบนเป็น inclusive — ค่าตรงรอยต่อ (153) นับเป็นโซนล่างตาม zones.md
    const belowMax = zone.max == null || (zone.min == null ? hr < zone.max : hr <= zone.max);
    if (aboveMin && belowMax) return zone.zone;
  }
  return zones.at(-1)?.zone ?? null;
}

/* ─────────────────────────────────────────────
   evaluateRun — ตัดสินคุณภาพ run จากเกณฑ์ของ session kind
   ───────────────────────────────────────────── */

export type RunCheck = {
  key: string;
  label: string;
  actual: number;
  limit: number;
  direction: "min" | "max";
  ok: boolean;
};

export type RunVerdict = "pass" | "warn" | "fail" | "unknown";

export type RunEvaluation = {
  kind: SessionKind;
  criteria: SessionCriteria;
  checks: RunCheck[];
  verdict: RunVerdict;
};

function check(
  key: string,
  label: string,
  actual: number | null | undefined,
  limit: number | null | undefined,
  direction: "min" | "max",
): RunCheck | null {
  if (actual == null || limit == null || !Number.isFinite(actual)) return null;
  const ok = direction === "min" ? actual >= limit : actual <= limit;
  return { key, label, actual, limit, direction, ok };
}

export function evaluateRun(run: RunLog, criteria: SessionCriteria[]): RunEvaluation | null {
  const kind = classifySession(run.session_type);
  const row = criteriaFor(kind, criteria);
  if (!row) return null;

  const z4z5 =
    run.z4_percent == null && run.z5_percent == null
      ? null
      : (run.z4_percent ?? 0) + (run.z5_percent ?? 0);

  const checks = [
    check("z2", "Z2 ขั้นต่ำ (%)", run.z2_percent, row.z2_min_percent, "min"),
    check("drift", "Drift สูงสุด (bpm)", run.drift_bpm, row.drift_max_bpm, "max"),
    check("decoupling", "Decoupling สูงสุด (%)", run.decoupling_percent, row.decoupling_max_percent, "max"),
    check("hr_avg", "HR เฉลี่ยสูงสุด (bpm)", run.avg_hr_bpm, row.hr_avg_max_bpm, "max"),
    check("z4z5", "Z4+Z5 สูงสุด (%)", z4z5, row.z4z5_max_percent, "max"),
  ].filter((item): item is RunCheck => item != null);

  const fails = checks.filter((item) => !item.ok).length;
  const verdict: RunVerdict = checks.length === 0 ? "unknown" : fails === 0 ? "pass" : fails === 1 ? "warn" : "fail";
  return { kind, criteria: row, checks, verdict };
}

/* ─────────────────────────────────────────────
   evaluateGate — ตัดสิน readiness gate ของวันจาก rules ที่ sync มา

   Clause semantics (ต่อ 1 เงื่อนไขใน condition):
   - รู้ค่า + ผ่าน = true, รู้ค่า + ไม่ผ่าน = false, ไม่มีข้อมูล = unknown
   - rule ระดับเตือน (caution/stop): unknown ทำให้ rule ไม่ match —
     ไม่เตือนจากสัญญาณที่ยืนยันไม่ได้ (กัน false alarm เช่น rain ที่ไม่มี data)
   - rule ระดับ ok: unknown ถูกข้าม แต่รายงานชื่อ clause ไว้ใน unverified
     เพื่อให้ UI บอกว่า "ผ่าน gate โดยยังไม่ได้ตรวจ X" (เช่น HRV status
     ที่ daily_readiness ยังไม่มีคอลัมน์)
   ───────────────────────────────────────────── */

type ClauseResult = true | false | "unknown";

export type GateInputs = {
  /** painLevel(run.pain) !== "none" ของ run ล่าสุดก่อนวันนี้ */
  prevRunPain?: boolean;
  /** สถานะ HRV เทียบ baseline ("normal" | "below" | "above") ถ้ามีแหล่งข้อมูล */
  hrvStatus?: string;
  /** ฝนตก/ถนนเปียก ถ้ามีแหล่งข้อมูล */
  rain?: boolean;
};

export type GateResult = {
  matched: ReadinessGateRule[];
  severity: GateSeverity | null;
  decision: string | null;
  unverified: string[];
};

function evaluateClauses(
  condition: GateCondition,
  daily: DailyReadiness,
  inputs: GateInputs,
): Array<{ key: string; result: ClauseResult }> {
  const sleepHours = daily.sleep_minutes == null ? null : daily.sleep_minutes / 60;
  const results: Array<{ key: string; result: ClauseResult }> = [];
  const add = (key: string, actual: number | boolean | string | null | undefined, test: () => boolean) => {
    results.push({ key, result: actual == null ? "unknown" : test() });
  };

  if (condition.recovery_min != null)
    add("recovery_min", daily.recovery_percent, () => daily.recovery_percent! >= condition.recovery_min!);
  if (condition.hrv_status != null)
    add("hrv_status", inputs.hrvStatus ?? null, () => condition.hrv_status!.includes(inputs.hrvStatus!));
  if (condition.sleep_min_h != null) add("sleep_min_h", sleepHours, () => sleepHours! >= condition.sleep_min_h!);
  if (condition.sleep_max_h != null) add("sleep_max_h", sleepHours, () => sleepHours! < condition.sleep_max_h!);
  if (condition.load_ratio_min != null)
    add("load_ratio_min", daily.load_ratio, () => daily.load_ratio! >= condition.load_ratio_min!);
  if (condition.load_ratio_max != null)
    add("load_ratio_max", daily.load_ratio, () => daily.load_ratio! <= condition.load_ratio_max!);
  if (condition.load_ratio_over != null)
    add("load_ratio_over", daily.load_ratio, () => daily.load_ratio! > condition.load_ratio_over!);
  if (condition.prev_run_pain != null)
    add("prev_run_pain", inputs.prevRunPain ?? null, () => inputs.prevRunPain === condition.prev_run_pain);
  if (condition.rain != null) add("rain", inputs.rain ?? null, () => inputs.rain === condition.rain);
  return results;
}

const SEVERITY_RANK: Record<GateSeverity, number> = { ok: 0, caution: 1, stop: 2 };

export function evaluateGate(
  daily: DailyReadiness | null | undefined,
  rules: ReadinessGateRule[],
  inputs: GateInputs = {},
): GateResult {
  const empty: GateResult = { matched: [], severity: null, decision: null, unverified: [] };
  if (!daily) return empty;
  const source = rules.length ? rules : DEFAULT_GATE_RULES;

  const matched: ReadinessGateRule[] = [];
  const unverified = new Set<string>();
  for (const rule of [...source].sort((a, b) => a.rule_order - b.rule_order)) {
    const clauses = evaluateClauses(rule.condition ?? {}, daily, inputs);
    if (clauses.length === 0) continue;
    if (clauses.some((clause) => clause.result === false)) continue;
    const unknowns = clauses.filter((clause) => clause.result === "unknown");
    if (rule.severity === "ok") {
      if (unknowns.length === clauses.length) continue;
      matched.push(rule);
      for (const clause of unknowns) unverified.add(clause.key);
    } else if (unknowns.length === 0) {
      matched.push(rule);
    }
  }

  if (!matched.length) return empty;
  const worst = matched.reduce((acc, rule) => (SEVERITY_RANK[rule.severity] > SEVERITY_RANK[acc.severity] ? rule : acc));
  return {
    matched,
    severity: worst.severity,
    decision: worst.decision,
    unverified: [...unverified],
  };
}
