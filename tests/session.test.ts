import { describe, expect, test } from "bun:test";
import { classifySession, getRecommendedShoe } from "../src/utils/session";

describe("classifySession", () => {
  test("uses the leading keyword when free text mentions a second type later", () => {
    // Real run_logs.session_type value for 2026-08-02: states "Long run" up
    // front, then explains readiness recommended downgrading to
    // "Recovery/Easy" — the session actually performed was the long run.
    const kind = classifySession(
      "**Long run — restart ladder ครั้งที่ 1 (60 นาที, ย้ายจาก 1 ส.ค. เพราะฝนตก) — " +
        "ทำเต็มตามแผนเดิม แม้ readiness เช้านี้แนะนำให้ลดเป็น Recovery/Easy 30-40 นาที**"
    );
    expect(kind).toBe("long");
  });

  test("classifies other real session_type rows correctly", () => {
    expect(classifySession("**Easy + strides — Gate ครั้งที่ 2 (ตัวตัดสิน)**")).toBe("strides");
    expect(
      classifySession("**VO2max interval — งานความเร็วครั้งแรกหลังบาดเจ็บ (on-ramp 4 x 400 m)**")
    ).toBe("vo2");
    expect(
      classifySession(
        "**Recovery easy — post-race retest gate สำหรับขาขวา (HEALING→RESOLVED?)** ตามแผน แต่ **gate ไม่ผ่าน** เพราะอาการหน้าแข้งขวากลับมาที่นาทีที่ 30 จนต้องหยุดวิ่งเปลี่ยนเป็นเดิน"
      )
    ).toBe("recovery");
  });

  test("falls back to scanning the whole string when the prefix has no signal", () => {
    expect(classifySession("Session note without a leading type — actually a long run")).toBe("long");
  });
});

describe("getRecommendedShoe", () => {
  test("recommends xtep-2000km-5-pro for interval, vo2max, and tempo quality sessions", () => {
    const vo2Shoe = getRecommendedShoe("6 x 400m VO2max");
    expect(vo2Shoe.slug).toBe("xtep-2000km-5-pro");
    expect(vo2Shoe.name).toBe("Xtep 2000km 5.0 Pro");
    expect(vo2Shoe.isQuality).toBe(true);

    const intervalShoe = getRecommendedShoe("Interval 5x1km");
    expect(intervalShoe.slug).toBe("xtep-2000km-5-pro");
    expect(intervalShoe.isQuality).toBe(true);

    const tempoShoe = getRecommendedShoe("Tempo run 40 นาที");
    expect(tempoShoe.slug).toBe("xtep-2000km-5-pro");
    expect(tempoShoe.isQuality).toBe(true);

    const thresholdShoe = getRecommendedShoe("Threshold pace");
    expect(thresholdShoe.slug).toBe("xtep-2000km-5-pro");
    expect(thresholdShoe.isQuality).toBe(true);
  });

  test("recommends xtep-2000-km-3 for recovery runs", () => {
    const recoveryShoe = getRecommendedShoe("Recovery Easy 30 นาที");
    expect(recoveryShoe.slug).toBe("xtep-2000-km-3");
    expect(recoveryShoe.name).toBe("Xtep 2000km 3");
    expect(recoveryShoe.isQuality).toBe(false);
  });

  test("recommends novablast-5 for easy, long, and default runs", () => {
    const easyShoe = getRecommendedShoe("Easy 45 นาที");
    expect(easyShoe.slug).toBe("novablast-5");
    expect(easyShoe.name).toBe("Novablast 5");
    expect(easyShoe.isQuality).toBe(false);

    const longShoe = getRecommendedShoe("Long run 14 km");
    expect(longShoe.slug).toBe("novablast-5");
    expect(longShoe.isQuality).toBe(false);
  });
});
