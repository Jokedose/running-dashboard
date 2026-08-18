import { describe, expect, test } from "bun:test";
import { workoutSegments } from "../src/utils/format";
import { majorVersion, pipelineMajors, unversionedCount } from "../src/utils/data";

describe("workoutSegments", () => {
  test("splits a multi-segment workout on ' + '", () => {
    const text =
      "WU 12 นาที (Z1-Z2, HR <153) + 6 x 400 m @ Z5 (HR >180 ปลาย rep, ~7:00-7:30/km ประเมิน) พัก jog 1 นาที (Z1, HR <140) + CD 10 นาที (Z1, HR <140)";
    const segments = workoutSegments(text);
    expect(segments).toEqual([
      "WU 12 นาที (Z1-Z2, HR <153)",
      "6 x 400 m @ Z5 (HR >180 ปลาย rep, ~7:00-7:30/km ประเมิน) พัก jog 1 นาที (Z1, HR <140)",
      "CD 10 นาที (Z1, HR <140)",
    ]);
  });

  test("a single-segment workout (no '+') returns one item", () => {
    expect(workoutSegments("Easy 45 นาที")).toEqual(["Easy 45 นาที"]);
  });

  test("strips stray markdown from each segment", () => {
    expect(workoutSegments("WU 10 **นาที** + CD 10 นาที")).toEqual(["WU 10 นาที", "CD 10 นาที"]);
  });

  test("null/undefined/empty input returns an empty array", () => {
    expect(workoutSegments(null)).toEqual([]);
    expect(workoutSegments(undefined)).toEqual([]);
    expect(workoutSegments("")).toEqual([]);
  });
});

describe("pipeline version helpers", () => {
  const row = (pipeline_version: string | null) => ({ pipeline_version });

  test("majorVersion extracts the major, or null when absent/malformed", () => {
    expect(majorVersion("1.2.3")).toBe("1");
    expect(majorVersion("12.0.0")).toBe("12");
    expect(majorVersion(null)).toBeNull();
    expect(majorVersion("")).toBeNull();
    expect(majorVersion("v1.0.0")).toBeNull();
  });

  test("pipelineMajors reports one entry when the history is consistent", () => {
    expect(pipelineMajors([row("1.0.0"), row("1.1.0"), row("1.0.0")])).toEqual(["1"]);
  });

  test("pipelineMajors reports every major present, oldest first", () => {
    // Two majors in one series means two definitions of the same metric —
    // the case the Load page warns about instead of drawing one line.
    expect(pipelineMajors([row("2.0.0"), row("1.0.0"), row("10.0.0")])).toEqual(["1", "2", "10"]);
  });

  test("pipelineMajors ignores rows with no version", () => {
    expect(pipelineMajors([row(null), row("1.0.0")])).toEqual(["1"]);
  });

  test("unversionedCount counts rows synced before versioning existed", () => {
    expect(unversionedCount([row(null), row("1.0.0"), row(null)])).toBe(2);
    expect(unversionedCount([])).toBe(0);
  });
});
