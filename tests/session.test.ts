import { describe, expect, test } from "bun:test";
import { classifySession, getRecommendedShoe } from "../src/utils/session";

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
