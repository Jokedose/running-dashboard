import type {
  DailyReadiness,
  DashboardData,
  InjuryStatus,
  RaceGoal,
  RaceReadiness,
  RunLog,
  TrainingPhase,
  TrainingPlan,
} from "../types";
import { latest, resolveCurrentRaceGoal, todayIso } from "./data";
import { evaluateGate, type GateResult } from "./evaluate";
import { classifySession, painLevel } from "./session";

/* ─────────────────────────────────────────────
   TrainingContext — "ตอนนี้คือช่วงไหนของ training cycle"
   คำนวณครั้งเดียวจาก DashboardData ที่ fetch มาแล้ว
   ให้ทุก widget/หน้าอ่านบริบทเดียวกัน แทนที่จะต่างคนต่างเดา
   ───────────────────────────────────────────── */

export type LastRaceContext = {
  goal: RaceGoal;
  /** race_readiness row ของแข่งนั้น (มีเมื่อ report sync แล้ว) */
  result: RaceReadiness | null;
  /** run log ของวันแข่ง (session_type = race) */
  runLog: RunLog | null;
  daysSince: number;
};

export type TrainingContext = {
  today: string;
  phase: TrainingPhase | null;
  /** อยู่ใน phase ปัจจุบันมากี่ % แล้ว (0 เมื่อไม่มี phase) */
  phaseProgressPct: number;
  currentRace: RaceGoal | null;
  /** นับถอยหลังถึง currentRace (null เมื่อไม่มีแข่งข้างหน้า) */
  daysToRace: number | null;
  lastRace: LastRaceContext | null;
  /** แข่งเสร็จ ≤ 7 วัน และมีหลักฐานผลจริง (result หรือ race run log) — กัน DNS */
  justRaced: boolean;
  /** currentRace อยู่ภายใน 7 วันข้างหน้า */
  raceWeek: boolean;
  openInjury: InjuryStatus | null;
  /** planned session แรกตั้งแต่วันนี้เป็นต้นไป */
  nextSession: TrainingPlan | null;
  todayReadiness: DailyReadiness | null;
  lastRun: RunLog | null;
  gate: GateResult | null;
};

export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** ป้ายชื่อแข่งสั้นสำหรับ selector: "<ระยะ> - <ชื่องานเต็ม>" เช่น
    "10K - Disney Run Thailand 2026", "10K - Allianz Ayudhya World Run Thailand Series 2026".
    ระยะมาจาก slug (goals/<slug>.md ตั้งชื่อไฟล์ตามระยะเสมอ) ส่วนชื่องานใช้ race_name เต็ม
    จากตาราง "ข้อมูลรายการแข่ง" ในไฟล์ goal โดยตรง — เดิม parse ชื่อจากคำใน slug เอง ทำให้
    งานที่ตั้งชื่อไฟล์ต่างรูปแบบ (เช่นมี/ไม่มีระยะในชื่อไฟล์) ได้ label ไม่ตรงกันหรือดูซ้ำกัน
    (เจอกับ Pokémon Run ที่มีไฟล์ตั้งชื่อสองแบบก่อนรวมเหลือไฟล์เดียว) */
export function raceShortLabel(goal: RaceGoal | null | undefined): string | null {
  if (!goal) return null;
  const rest = goal.race_slug.replace(/^\d{4}-\d{2}-\d{2}-?/, "");
  const parts = rest.split("-").filter(Boolean);
  const dist = parts.find((part) => /^\d+(\.\d+)?k$|^half$|^full$|^marathon$/i.test(part));
  const distLabel = dist?.toUpperCase() ?? null;

  // ตัดวลีระยะทางท้ายชื่อที่บางไฟล์ goal แนบมาเอง (เช่น "... — 10 km") ออกก่อน
  // เพราะ distLabel นำหน้าซ้ำความหมายอยู่แล้ว
  const cleanedName = goal.race_name?.replace(/\s*[—-]\s*\d+(\.\d+)?\s*k(m)?\.?\s*$/i, "").trim() || null;
  if (cleanedName) return [distLabel, cleanedName].filter(Boolean).join(" - ");

  // fallback: ไม่มี race_name เลย -> ประกอบชื่อจากคำใน slug แทน
  const nameFromSlug = parts
    .filter((part) => part !== dist)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return [distLabel, nameFromSlug].filter(Boolean).join(" - ") || null;
}

/** เป้า long run ปัจจุบันจาก training_plan (ระยะไกลสุดของ long run
    ที่ยังไม่ถึงวัน — ถ้าไม่มีก็ใช้ไกลสุดทั้งแผน) แทนค่าคงที่ 9.5 เดิม
    ซึ่งเป็นเป้าช่วง pre-race ที่จบไปแล้ว */
export function longRunTargetKm(plan: TrainingPlan[], today: string = todayIso(), fallback = 9.5): number {
  const longs = plan.filter(
    (row) => classifySession(row.session_type ?? row.title) === "long" && row.target_distance_km != null,
  );
  const upcoming = longs.filter((row) => row.plan_date >= today);
  const pool = upcoming.length ? upcoming : longs;
  if (!pool.length) return fallback;
  return Math.max(...pool.map((row) => row.target_distance_km as number));
}

export function buildTrainingContext(data: DashboardData, today: string = todayIso()): TrainingContext {
  const phase = data.phases.find((p) => p.start_date <= today && today <= p.end_date) ?? null;
  const phaseProgressPct = phase
    ? Math.min(100, Math.max(0, (diffDays(phase.start_date, today) / Math.max(1, diffDays(phase.start_date, phase.end_date))) * 100))
    : 0;

  const currentRace = resolveCurrentRaceGoal(data.raceGoals, today);
  const daysToRace = currentRace && currentRace.race_date >= today ? diffDays(today, currentRace.race_date) : null;

  const pastGoals = data.raceGoals.filter((goal) => goal.race_date < today).sort((a, b) => a.race_date.localeCompare(b.race_date));
  const lastGoal = pastGoals.at(-1) ?? null;
  let lastRace: LastRaceContext | null = null;
  if (lastGoal) {
    const result = data.races.find((row) => row.race_date === lastGoal.race_date) ?? null;
    const runLog =
      data.runs.find((run) => run.run_date === lastGoal.race_date && classifySession(run.session_type) === "race") ?? null;
    lastRace = { goal: lastGoal, result, runLog, daysSince: diffDays(lastGoal.race_date, today) };
  }
  const justRaced =
    lastRace != null && lastRace.daysSince <= 7 && (lastRace.result?.result_time_min != null || lastRace.runLog != null);
  const raceWeek = daysToRace != null && daysToRace <= 7;

  const openInjury = data.injuries.find((injury) => injury.is_open) ?? null;

  const nextSession =
    data.plan
      .filter((row) => row.plan_date >= today && (row.status === "planned" || row.status == null))
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date))[0] ?? null;

  const todayReadiness = data.daily.find((row) => row.log_date === today) ?? null;
  const lastRun = (latest(data.runs, "run_date") as RunLog | undefined) ?? null;
  const prevRunPain = lastRun ? painLevel(lastRun.pain) !== "none" : undefined;
  const gate = todayReadiness ? evaluateGate(todayReadiness, data.gateRules, { prevRunPain }) : null;

  return {
    today,
    phase,
    phaseProgressPct,
    currentRace,
    daysToRace,
    lastRace,
    justRaced,
    raceWeek,
    openInjury,
    nextSession,
    todayReadiness,
    lastRun,
    gate,
  };
}
