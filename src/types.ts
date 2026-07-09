import type { ComponentType } from "react";

export type DailyReadiness = {
  id: string;
  log_date: string;
  readiness_status: string | null;
  recommendation: string | null;
  planned_session: string | null;
  recommended_shoe: string | null;
  recovery_percent: number | null;
  sleep_score: number | null;
  sleep_minutes: number | null;
  hrv_avg_ms: number | null;
  resting_hr_bpm: number | null;
  load_ratio: number | null;
  tags: string[] | null;
};

export type RunLog = {
  id: string;
  run_date: string;
  session_type: string | null;
  distance_km: number | null;
  duration_min: number | null;
  pace_sec_per_km: number | null;
  avg_hr_bpm: number | null;
  hr_max_bpm: number | null;
  z1_percent: number | null;
  z2_percent: number | null;
  z3_percent: number | null;
  z4_percent: number | null;
  z5_percent: number | null;
  sweet_spot_percent: number | null;
  drift_bpm: number | null;
  decoupling_percent: number | null;
  cadence_spm: number | null;
  power_w: number | null;
  gct_ms: number | null;
  stride_cm: number | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  weather: string | null;
  shoe_slug: string | null;
  rpe: string | null;
  pain: string | null;
  note: string | null;
};

export type WeeklySummary = {
  id: string;
  week_id: string;
  total_distance_km: number | null;
  total_duration_min: number | null;
  run_count: number | null;
  long_run_count: number | null;
  quality_count: number | null;
  readiness_issues: string | null;
  coach_recommendation: string | null;
};

export type GearMileage = {
  id: string;
  shoe_slug: string;
  shoe_name: string | null;
  total_km: number | null;
  remaining_km: number | null;
  role: string | null;
  status: string | null;
  used_percent: number | null;
};

export type RaceReadiness = {
  id: string;
  race_date: string;
  race_name: string;
  readiness_score: number | null;
  activity_records: number | null;
  long_runs: number | null;
  quality_logs: number | null;
  longest_distance_km: number | null;
  fastest_quality_pace_sec_per_km: number | null;
  vo2max: number | null;
  coros_running_level: number | null;
  coros_threshold_pace_sec_per_km: number | null;
  coros_pred_5k_min: number | null;
  coros_pred_10k_min: number | null;
  coros_pred_half_min: number | null;
  strengths: string[] | null;
  risks: string[] | null;
  race_decision: string | null;
  milestones: Milestone[] | null;
};

export type Milestone = {
  name: string;
  due: string;
  status: "done" | "upcoming" | "planned" | "skipped";
};

export type TrainingPlan = {
  id: string;
  plan_date: string;
  week_id: string | null;
  title: string;
  session_type: string | null;
  target_distance_km: number | null;
  target_duration_min: number | null;
  target_pace_sec_per_km: number | null;
  intensity: string | null;
  planned_shoe: string | null;
  priority: "low" | "normal" | "high" | "race" | null;
  status: "planned" | "done" | "skipped" | "adjusted" | null;
  skip_reason: string | null;
  notes: string | null;
  created_at: string | null;
};

export type MonthlySummary = {
  id: string;
  month: string;
  coach_decision: string | null;
  readiness_flags: string | null;
};

export type BodyComposition = {
  id: string;
  measured_date: string;
  weight_kg: number | null;
  bmi: number | null;
  body_score: number | null;
  body_fat_pct: number | null;
  body_fat_mass_kg: number | null;
  subcutaneous_fat_pct: number | null;
  visceral_fat_level: number | null;
  muscle_mass_kg: number | null;
  muscle_pct: number | null;
  skeletal_muscle_kg: number | null;
  body_water_pct: number | null;
  protein_mass_kg: number | null;
  bone_mineral_kg: number | null;
  fat_free_mass_kg: number | null;
  bmr_kcal: number | null;
  body_age: number | null;
  source: string | null;
};

export type InjuryStatus = {
  injury_slug: string;
  title: string | null;
  status: "OPEN" | "HEALING" | "CLOSED" | string;
  is_open: boolean;
  last_symptom_date: string | null;
  last_updated_date: string | null;
  trend: string | null;
  care: string | null;
  current_rule: string | null;
  tags: string[] | null;
  source_path: string | null;
  updated_at: string | null;
};

export type DashboardData = {
  daily: DailyReadiness[];
  runs: RunLog[];
  weekly: WeeklySummary[];
  gear: GearMileage[];
  race: RaceReadiness | null;
  plan: TrainingPlan[];
  body: BodyComposition[];
  monthly: MonthlySummary[];
  injuries: InjuryStatus[];
};

export type LoadState = "idle" | "loading" | "ready" | "error";

export type NavItem = {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
};
