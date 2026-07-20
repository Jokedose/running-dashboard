import { describe, expect, test } from "bun:test";
import {
  DEFAULT_GATE_RULES,
  DEFAULT_PROFILE,
  criteriaFor,
  evaluateGate,
  evaluateRun,
  resolveProfile,
  zoneOf,
} from "../src/utils/evaluate";
import type { DailyReadiness, ReadinessGateRule, RunLog, RunnerProfile, SessionCriteria } from "../src/types";

const run = (overrides: Partial<RunLog>): RunLog =>
  ({
    id: "r1",
    run_date: "2026-07-01",
    session_type: "easy-run",
    distance_km: 5,
    duration_min: 55,
    pace_sec_per_km: 660,
    avg_hr_bpm: 148,
    hr_max_bpm: 158,
    z1_percent: 5,
    z2_percent: 90,
    z3_percent: 5,
    z4_percent: 0,
    z5_percent: 0,
    sweet_spot_percent: 60,
    drift_bpm: 3,
    decoupling_percent: 2,
    cadence_spm: 168,
    power_w: null,
    gct_ms: null,
    stride_cm: null,
    temperature_c: null,
    humidity_percent: null,
    weather: null,
    shoe_slug: null,
    rpe: null,
    pain: null,
    note: null,
    ...overrides,
  }) as RunLog;

const daily = (overrides: Partial<DailyReadiness>): DailyReadiness =>
  ({
    id: "d1",
    log_date: "2026-07-01",
    readiness_status: null,
    recommendation: null,
    planned_session: null,
    recommended_shoe: null,
    recovery_percent: 90,
    sleep_score: 80,
    sleep_minutes: 420,
    hrv_avg_ms: 70,
    resting_hr_bpm: 60,
    load_ratio: 1.0,
    tags: [],
    ...overrides,
  }) as DailyReadiness;

describe("zoneOf", () => {
  test("maps HR to zones from the default profile", () => {
    expect(zoneOf(120)).toBe("Z1");
    expect(zoneOf(140)).toBe("Z2");
    expect(zoneOf(153)).toBe("Z2"); // ขอบบน Z2 นับเป็น Z2 (first match)
    expect(zoneOf(154)).toBe("Z3");
    expect(zoneOf(181)).toBe("Z5");
    expect(zoneOf(null)).toBeNull();
  });

  test("uses db profile zones when provided", () => {
    const profile: RunnerProfile = {
      ...DEFAULT_PROFILE,
      zones: [
        { zone: "Z1", min: null, max: 139, label: null },
        { zone: "Z2", min: 139, max: 152, label: null },
        { zone: "Z3", min: 152, max: 165, label: null },
        { zone: "Z4", min: 165, max: 179, label: null },
        { zone: "Z5", min: 179, max: null, label: null },
      ],
    };
    expect(zoneOf(140, profile)).toBe("Z2");
    expect(zoneOf(153, profile)).toBe("Z3");
  });

  test("resolveProfile falls back when zones missing", () => {
    expect(resolveProfile(null)).toBe(DEFAULT_PROFILE);
    const noZones = { ...DEFAULT_PROFILE, user_id: "u1", zones: [] };
    expect(resolveProfile(noZones).zones.length).toBe(5);
  });
});

describe("criteriaFor", () => {
  test("falls back to defaults when db rows empty", () => {
    const easy = criteriaFor("easy", []);
    expect(easy?.z2_min_percent).toBe(85);
    expect(criteriaFor("recovery", [])?.hr_avg_max_bpm).toBe(145);
  });

  test("prefers db rows and aliases vo2 -> tempo", () => {
    const dbRows: SessionCriteria[] = [
      {
        id: "c1",
        session_kind: "tempo",
        z2_min_percent: null,
        drift_max_bpm: null,
        decoupling_max_percent: null,
        hr_avg_max_bpm: 170,
        z4z5_max_percent: 20,
        notes_good: [],
        notes_fix: [],
        notes_avoid: [],
      },
    ];
    expect(criteriaFor("vo2", dbRows)?.hr_avg_max_bpm).toBe(170);
    // db มีข้อมูลแล้ว แต่ไม่มี kind ที่ขอ -> ไม่เด้งกลับไป default
    expect(criteriaFor("easy", dbRows)).toBeNull();
  });

  test("kinds without criteria return null", () => {
    expect(criteriaFor("rest", [])).toBeNull();
    expect(criteriaFor("race", [])).toBeNull();
  });
});

describe("evaluateRun", () => {
  test("clean easy run passes all checks", () => {
    const result = evaluateRun(run({}), []);
    expect(result?.kind).toBe("easy");
    expect(result?.verdict).toBe("pass");
    expect(result?.checks.map((c) => c.key)).toEqual(["z2", "drift", "decoupling", "hr_avg"]);
  });

  test("one failed check is a warn, two are a fail", () => {
    expect(evaluateRun(run({ drift_bpm: 8 }), [])?.verdict).toBe("warn");
    expect(evaluateRun(run({ drift_bpm: 8, z2_percent: 70 }), [])?.verdict).toBe("fail");
  });

  test("null metrics are skipped, not failed", () => {
    const result = evaluateRun(run({ drift_bpm: null, decoupling_percent: null }), []);
    expect(result?.verdict).toBe("pass");
    expect(result?.checks.map((c) => c.key)).toEqual(["z2", "hr_avg"]);
  });

  test("test session has no numeric criteria -> unknown verdict", () => {
    const result = evaluateRun(run({ session_type: "calibration test" }), []);
    expect(result?.kind).toBe("test");
    expect(result?.verdict).toBe("unknown");
    expect(result?.checks).toEqual([]);
  });

  test("rest/other sessions return null", () => {
    expect(evaluateRun(run({ session_type: "rest" }), [])).toBeNull();
  });

  test("tempo z4z5 cap uses summed zones", () => {
    const result = evaluateRun(run({ session_type: "tempo", avg_hr_bpm: 165, z4_percent: 20, z5_percent: 10 }), []);
    const z4z5 = result?.checks.find((c) => c.key === "z4z5");
    expect(z4z5?.actual).toBe(30);
    expect(z4z5?.ok).toBe(false);
  });
});

describe("evaluateGate", () => {
  test("good day matches quality-allowed with hrv unverified", () => {
    const result = evaluateGate(daily({}), []);
    expect(result.severity).toBe("ok");
    expect(result.decision).toBe("Quality allowed");
    expect(result.unverified).toEqual(["hrv_status"]);
  });

  test("hrv below normal downgrades to caution when status known", () => {
    const result = evaluateGate(daily({}), [], { hrvStatus: "below" });
    expect(result.severity).toBe("caution");
    expect(result.decision).toBe("ลด quality 30–40% หรือเปลี่ยนเป็น easy");
    expect(result.unverified).toEqual([]);
  });

  test("short sleep triggers caution and blocks ok rule", () => {
    const result = evaluateGate(daily({ sleep_minutes: 300 }), []);
    expect(result.severity).toBe("caution");
    expect(result.decision).toBe("Recovery/easy เท่านั้น");
  });

  test("caution rules never fire on unknown signals", () => {
    // rain/prev_run_pain ไม่มีข้อมูล -> rule 5/6 ต้องเงียบ
    const result = evaluateGate(daily({}), []);
    expect(result.matched.map((r) => r.rule_order)).toEqual([1]);
  });

  test("prev run pain fires only when affirmed", () => {
    expect(evaluateGate(daily({}), [], { prevRunPain: false }).matched.map((r) => r.rule_order)).toEqual([1]);
    const withPain = evaluateGate(daily({}), [], { prevRunPain: true });
    expect(withPain.matched.map((r) => r.rule_order)).toEqual([1, 5]);
    expect(withPain.severity).toBe("caution");
  });

  test("high load ratio triggers rule 4", () => {
    const result = evaluateGate(daily({ load_ratio: 1.53 }), []);
    expect(result.matched.map((r) => r.rule_order)).toEqual([4]);
    expect(result.decision).toBe("ลด volume/intensity");
  });

  test("worst severity wins across matched rules", () => {
    const rules: ReadinessGateRule[] = [
      ...DEFAULT_GATE_RULES,
      {
        id: "x",
        rule_order: 7,
        signal: "red flag",
        condition: { prev_run_pain: true },
        decision: "หยุดซ้อม",
        severity: "stop",
      },
    ];
    const result = evaluateGate(daily({}), rules, { prevRunPain: true });
    expect(result.severity).toBe("stop");
    expect(result.decision).toBe("หยุดซ้อม");
  });

  test("no daily row yields empty result", () => {
    expect(evaluateGate(null, []).severity).toBeNull();
  });
});
