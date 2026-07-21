import { describe, expect, test } from "bun:test";
import { buildTrainingContext, diffDays, longRunTargetKm, raceShortLabel } from "../src/utils/context";
import { emptyData } from "../src/utils/data";
import type { DashboardData, RaceGoal, RaceReadiness, RunLog, TrainingPhase, TrainingPlan } from "../src/types";

const phase = (overrides: Partial<TrainingPhase>): TrainingPhase => ({
  id: "p1",
  phase_name: "Recovery",
  start_date: "2026-07-20",
  end_date: "2026-07-25",
  sort_order: 1,
  ...overrides,
});

const goal = (overrides: Partial<RaceGoal>): RaceGoal =>
  ({
    id: "g1",
    race_slug: "2026-07-19-10k",
    race_name: "Disney Run 10K",
    race_date: "2026-07-19",
    target_a_text: null,
    target_a_min: null,
    target_b_text: null,
    target_c_text: null,
    cutoff_min: 110,
    pacing_splits: null,
    route_rules: null,
    tags: null,
    source_path: null,
    updated_at: null,
    ...overrides,
  }) as RaceGoal;

const raceRun = (overrides: Partial<RunLog>): RunLog =>
  ({
    id: "run-race",
    run_date: "2026-07-19",
    session_type: "race",
    distance_km: 10,
    duration_min: 105,
    pace_sec_per_km: 630,
    avg_hr_bpm: 168,
    pain: null,
    ...overrides,
  }) as RunLog;

const planRow = (overrides: Partial<TrainingPlan>): TrainingPlan =>
  ({
    id: "t1",
    plan_date: "2026-07-27",
    week_id: null,
    title: "Easy 40 นาที",
    session_type: "Easy run",
    target_distance_km: null,
    target_duration_min: 40,
    target_pace_sec_per_km: null,
    intensity: null,
    planned_shoe: null,
    priority: null,
    status: "planned",
    skip_reason: null,
    notes: null,
    created_at: null,
    ...overrides,
  }) as TrainingPlan;

const data = (overrides: Partial<DashboardData>): DashboardData => ({ ...emptyData, ...overrides });

const TODAY = "2026-07-20";

describe("diffDays", () => {
  test("counts calendar days", () => {
    expect(diffDays("2026-07-20", "2026-07-27")).toBe(7);
    expect(diffDays("2026-07-19", "2026-07-20")).toBe(1);
    expect(diffDays("2026-07-20", "2026-07-20")).toBe(0);
  });
});

describe("buildTrainingContext — phase", () => {
  test("resolves current phase and progress", () => {
    const phases = [
      phase({ id: "pre", phase_name: "Pre-race", start_date: "2026-06-11", end_date: "2026-07-19", sort_order: 0 }),
      phase({ id: "rec", phase_name: "Recovery", start_date: "2026-07-20", end_date: "2026-07-25", sort_order: 1 }),
    ];
    const ctx = buildTrainingContext(data({ phases }), TODAY);
    expect(ctx.phase?.id).toBe("rec");
    expect(ctx.phaseProgressPct).toBe(0); // วันแรกของ phase
    const mid = buildTrainingContext(data({ phases }), "2026-07-23");
    expect(mid.phaseProgressPct).toBe(60); // วันที่ 3 จาก 5 วัน
  });

  test("no phase covering today -> null", () => {
    const ctx = buildTrainingContext(data({ phases: [phase({ end_date: "2026-07-19", start_date: "2026-07-01" })] }), TODAY);
    expect(ctx.phase).toBeNull();
    expect(ctx.phaseProgressPct).toBe(0);
  });
});

describe("buildTrainingContext — races", () => {
  const goals = [goal({}), goal({ id: "g2", race_slug: "2026-11-22-10k-allianz", race_name: "Allianz 10K", race_date: "2026-11-22" })];

  test("current race is the next upcoming, with countdown", () => {
    const ctx = buildTrainingContext(data({ raceGoals: goals }), TODAY);
    expect(ctx.currentRace?.race_slug).toBe("2026-11-22-10k-allianz");
    expect(ctx.daysToRace).toBe(125);
    expect(ctx.raceWeek).toBe(false);
  });

  test("race week within 7 days, race day = 0", () => {
    expect(buildTrainingContext(data({ raceGoals: goals }), "2026-11-16").raceWeek).toBe(true);
    expect(buildTrainingContext(data({ raceGoals: goals }), "2026-11-22").daysToRace).toBe(0);
  });

  test("justRaced requires result evidence", () => {
    // ไม่มี result และไม่มี race run log -> ไม่นับ (กัน DNS)
    const noEvidence = buildTrainingContext(data({ raceGoals: goals }), TODAY);
    expect(noEvidence.lastRace?.goal.race_slug).toBe("2026-07-19-10k");
    expect(noEvidence.justRaced).toBe(false);

    const withRunLog = buildTrainingContext(data({ raceGoals: goals, runs: [raceRun({})] }), TODAY);
    expect(withRunLog.justRaced).toBe(true);
    expect(withRunLog.lastRace?.runLog?.id).toBe("run-race");

    const result = { race_date: "2026-07-19", race_name: "10K", result_time_min: 105 } as RaceReadiness;
    const withResult = buildTrainingContext(data({ raceGoals: goals, races: [result] }), TODAY);
    expect(withResult.justRaced).toBe(true);
    expect(withResult.lastRace?.result?.result_time_min).toBe(105);
  });

  test("justRaced expires after 7 days", () => {
    const ctx = buildTrainingContext(data({ raceGoals: goals, runs: [raceRun({})] }), "2026-07-27");
    expect(ctx.lastRace?.daysSince).toBe(8);
    expect(ctx.justRaced).toBe(false);
  });
});

describe("buildTrainingContext — plan, injury, gate", () => {
  test("next session is the earliest planned row from today", () => {
    const plan = [
      planRow({ id: "done", plan_date: "2026-07-19", status: "done" }),
      planRow({ id: "later", plan_date: "2026-07-29" }),
      planRow({ id: "next", plan_date: "2026-07-27" }),
    ];
    const ctx = buildTrainingContext(data({ plan }), TODAY);
    expect(ctx.nextSession?.id).toBe("next");
  });

  test("open injury surfaces, closed does not", () => {
    const injuries = [
      { injury_slug: "right-shin", title: "หน้าแข้งขวา", status: "HEALING", is_open: true } as DashboardData["injuries"][number],
    ];
    expect(buildTrainingContext(data({ injuries }), TODAY).openInjury?.injury_slug).toBe("right-shin");
    injuries[0] = { ...injuries[0], is_open: false };
    expect(buildTrainingContext(data({ injuries }), TODAY).openInjury).toBeNull();
  });

  test("gate runs only when today's readiness row exists, and sees prev-run pain", () => {
    const daily = [
      {
        id: "d1",
        log_date: TODAY,
        recovery_percent: 90,
        sleep_minutes: 420,
        load_ratio: 1.0,
        tags: [],
      } as unknown as DashboardData["daily"][number],
    ];
    const noDaily = buildTrainingContext(data({}), TODAY);
    expect(noDaily.gate).toBeNull();

    const withDaily = buildTrainingContext(data({ daily }), TODAY);
    expect(withDaily.gate?.severity).toBe("ok");

    const painfulRun = raceRun({ run_date: "2026-07-19", pain: "ตึงหน้าแข้งขวา" });
    const withPain = buildTrainingContext(data({ daily, runs: [painfulRun] }), TODAY);
    expect(withPain.gate?.severity).toBe("caution");
    expect(withPain.gate?.matched.map((r) => r.rule_order)).toContain(5);
  });

  test("stale daily row (yesterday) does not become today's gate", () => {
    const daily = [{ id: "d0", log_date: "2026-07-19", recovery_percent: 90, tags: [] } as unknown as DashboardData["daily"][number]];
    expect(buildTrainingContext(data({ daily }), TODAY).todayReadiness).toBeNull();
  });
});

describe("longRunTargetKm", () => {
  test("uses the farthest upcoming planned long run, falling back sensibly", () => {
    const plan = [
      planRow({ id: "past-long", plan_date: "2026-06-14", session_type: "Long run", target_distance_km: 11 }),
      planRow({ id: "future-long-1", plan_date: "2026-09-05", session_type: "Long run", target_distance_km: 14 }),
      planRow({ id: "future-long-2", plan_date: "2026-11-01", session_type: "Long run", target_distance_km: 19 }),
      planRow({ id: "future-easy", plan_date: "2026-08-01", session_type: "Easy run", target_distance_km: 30 }),
    ];
    expect(longRunTargetKm(plan, TODAY)).toBe(19);
    // ไม่มี long ข้างหน้า -> ใช้ไกลสุดทั้งแผน
    expect(longRunTargetKm(plan.slice(0, 1), TODAY)).toBe(11);
    // ไม่มี long เลย -> fallback 9.5
    expect(longRunTargetKm([], TODAY)).toBe(9.5);
  });
});

describe("raceShortLabel", () => {
  test("builds a short label from the goal slug", () => {
    expect(raceShortLabel(goal({}))).toBe("10K");
    expect(raceShortLabel(goal({ race_slug: "2026-11-22-10k-allianz" }))).toBe("10K - Allianz");
    expect(raceShortLabel(goal({ race_slug: "2027-01-10-half-buriram" }))).toBe("HALF - Buriram");
    expect(raceShortLabel(null)).toBeNull();
  });
});
