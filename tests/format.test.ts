import { describe, expect, test } from "bun:test";
import { workoutSegments } from "../src/utils/format";

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
