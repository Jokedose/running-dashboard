import { describe, expect, test } from "bun:test";
import {
  activitiesSummary,
  bodySummary,
  calendarSummary,
  homeReadinessSummary,
  raceSummary,
  energyPanelSummary,
  injurySummary,
  loadSummary,
  reportsSummary,
  strengthPanelSummary,
  trendsSummary,
  zone2Summary,
} from "../src/utils/summary";

const zone2 = (overrides: Partial<Parameters<typeof zone2Summary>[0]> = {}) =>
  zone2Summary({
    sampleSize: 8,
    avgZ2: 88,
    avgDrift: 3,
    latestZ2: 90,
    z2Min: 85,
    driftMax: 5,
    latestCadence: 170,
    cadenceMin: 168,
    ...overrides,
  });

describe("zone2Summary", () => {
  test("ผ่านทั้ง Z2 และ drift = โทนเขียว", () => {
    const summary = zone2();
    expect(summary.tone).toBe("good");
    expect(summary.headline).toContain("ตามเกณฑ์");
  });

  test("หลุดทั้งสองอย่างคือวิ่งเร็วเกิน — โทนแดง ไม่ใช่แค่เตือน", () => {
    expect(zone2({ avgZ2: 70, avgDrift: 9 }).tone).toBe("hot");
  });

  test("Z2 ต่ำแต่ HR นิ่ง = เตือนเรื่องเพซอย่างเดียว", () => {
    const summary = zone2({ avgZ2: 70 });
    expect(summary.tone).toBe("warn");
    expect(summary.headline).toContain("หลุดโซน 2");
  });

  test("Z2 ผ่านแต่ HR ไหล = เตือนเรื่อง drift และแนบ cadence เมื่อต่ำกว่าเป้า", () => {
    const summary = zone2({ avgDrift: 8, latestCadence: 160 });
    expect(summary.headline).toContain("HR ไหล");
    expect(summary.detail).toContain("cadence");
  });

  test("ไม่มีรัน easy/long ก็ไม่เดา", () => {
    const summary = zone2({ sampleSize: 0, avgZ2: null, avgDrift: null });
    expect(summary.tone).toBe("neutral");
    expect(summary.facts).toHaveLength(0);
  });
});

describe("loadSummary", () => {
  const base = { acwr: 1.1, zoneLabel: "ปลอดภัย (sweet spot)", zoneTone: "good" as const, tsb: 2, openInjuries: 0, hasEnoughHistory: true, usingTrimp: true };

  test("ประวัติไม่ถึง 28 วันไม่สรุป ACWR", () => {
    expect(loadSummary({ ...base, hasEnoughHistory: false }).tone).toBe("neutral");
  });

  test("โหลดสูงพร้อมเคสเจ็บเปิดอยู่ ต้องพูดเรื่องนั้นก่อน", () => {
    const summary = loadSummary({ ...base, acwr: 1.6, zoneLabel: "เสี่ยงบาดเจ็บ (>1.5)", zoneTone: "hot", openInjuries: 1 });
    expect(summary.tone).toBe("hot");
    expect(summary.headline).toContain("อาการที่ยังไม่ปิดเคส");
  });

  // เคสเจ็บเปิดอยู่แต่โหลดยังอยู่ในโซนปลอดภัย ไม่ควรถูกยกระดับเป็นเตือนโหลด
  test("มีเคสเจ็บแต่โหลดปลอดภัย ยังคงเป็นโทนเขียว", () => {
    expect(loadSummary({ ...base, openInjuries: 1 }).tone).toBe("good");
  });

  test("TSB ติดลบถูกพูดถึงแม้โหลดจะปลอดภัย", () => {
    expect(loadSummary({ ...base, tsb: -8 }).detail).toContain("ล้าสะสม");
  });

  test("โหลดต่ำเกินได้คำแนะนำคนละแบบกับโหลดสูง", () => {
    const low = loadSummary({ ...base, acwr: 0.6, zoneLabel: "ต่ำ — เสี่ยง detraining", zoneTone: "warn" });
    expect(low.detail).toContain("เติมระยะกลับ");
  });
});

describe("trendsSummary", () => {
  const base = { totalWeeks: 12, avgWeeklyKm: 24, longestLongRunKm: 12, longTargetKm: 10, avgHrvMs: 60, avgSleepMin: 450 };

  test("ถึงเป้า long run และนอนพอ = เขียว", () => {
    expect(trendsSummary(base).tone).toBe("good");
  });

  test("นอนน้อยกว่า 7 ชม. ถูกยกมาเตือนแม้ long run ถึงเป้า", () => {
    const summary = trendsSummary({ ...base, avgSleepMin: 380 });
    expect(summary.tone).toBe("warn");
    expect(summary.detail).toContain("การนอน");
  });

  test("ยังไม่มีสัปดาห์ที่สรุปไว้", () => {
    expect(trendsSummary({ ...base, totalWeeks: 0 }).tone).toBe("neutral");
  });
});

describe("reportsSummary", () => {
  const base = {
    periodLabel: "2026-W34",
    periodNoun: "สัปดาห์",
    distanceKm: 24,
    durationMin: 150,
    runCount: 4,
    longRunCount: 1,
    qualityCount: 1,
    prevDistanceKm: 22,
  };

  test("เทียบกับรอบก่อนหน้าเสมอ", () => {
    expect(reportsSummary(base).detail).toContain("มากกว่าสัปดาห์ก่อน 2.0 km");
  });

  test("เพิ่มเกิน 30% ในรอบเดียวถูกเตือน", () => {
    const summary = reportsSummary({ ...base, distanceKm: 30, prevDistanceKm: 20 });
    expect(summary.tone).toBe("warn");
    expect(summary.detail).toContain("30%");
  });

  test("โหมดเดือนใช้คำว่าเดือน และไม่พูดถึง long/quality ที่ไม่มีข้อมูล", () => {
    const summary = reportsSummary({ ...base, periodLabel: "สิงหาคม 2026", periodNoun: "เดือน", longRunCount: null, qualityCount: null });
    expect(summary.detail).toContain("เดือนก่อน");
    expect(summary.detail).not.toContain("วิ่งยาว");
    expect(summary.facts.some((fact) => fact.label === "ยาว / คุณภาพ")).toBe(false);
  });

  test("ไม่มีรอบก่อนหน้าให้เทียบ ก็บอกตรง ๆ", () => {
    expect(reportsSummary({ ...base, prevDistanceKm: null }).detail).toContain("ยังไม่มีสัปดาห์ก่อนหน้า");
  });
});

describe("activitiesSummary", () => {
  const base = { totalActivities: 40, totalDistanceKm: 210.5, totalDurationMin: 1400, avgPaceSec: 400, painCount: 0, painWindow: 30 };

  test("ไม่มีอาการใน 30 ครั้งล่าสุด = เขียว", () => {
    expect(activitiesSummary(base).tone).toBe("good");
  });

  test("มีอาการถูกยกขึ้นมาในประโยคสรุป", () => {
    const summary = activitiesSummary({ ...base, painCount: 3 });
    expect(summary.tone).toBe("warn");
    expect(summary.detail).toContain("3 ครั้ง");
  });

  test("ยังไม่มีกิจกรรมเลย", () => {
    expect(activitiesSummary({ ...base, totalActivities: 0 }).tone).toBe("neutral");
  });

  // "2310 นาที" อ่านไม่ออกในหัว — เกินสามชั่วโมงต้องกลายเป็นชั่วโมง
  test("เวลารวมยาว ๆ แสดงเป็นชั่วโมง", () => {
    const long = activitiesSummary(base).facts.find((fact) => fact.label === "เวลารวม");
    expect(long?.value).toBe("23.3 ชม.");
    const short = activitiesSummary({ ...base, totalDurationMin: 95 }).facts.find((fact) => fact.label === "เวลารวม");
    expect(short?.value).toBe("95 นาที");
  });
});

describe("injurySummary", () => {
  const base = { openTitles: [] as string[], daysPainFree: 20, totalNiggles: 5, highCount: 0, recurrencePart: null, recurrenceCount: 0 };

  test("เคสเปิดมาก่อนทุกอย่าง", () => {
    const summary = injurySummary({ ...base, openTitles: ["Shin splints"], daysPainFree: 30 });
    expect(summary.tone).toBe("hot");
    expect(summary.headline).toContain("ยังไม่ปิดเคส");
  });

  test("ไม่มีเคสเปิดแต่มีอาการซ้ำที่จุดเดิม = เตือน", () => {
    const summary = injurySummary({ ...base, recurrencePart: "หน้าแข้ง", recurrenceCount: 3 });
    expect(summary.tone).toBe("warn");
    expect(summary.headline).toContain("หน้าแข้ง");
  });

  test("ปลอดอาการเกินสองสัปดาห์ = เขียว", () => {
    expect(injurySummary(base).tone).toBe("good");
  });

  test("เพิ่งเจ็บไม่ถึงสองสัปดาห์ = เตือน", () => {
    expect(injurySummary({ ...base, daysPainFree: 4 }).tone).toBe("warn");
  });
});

describe("strengthPanelSummary", () => {
  const base = { weekDone: 1, weekPlanned: 3, streakWeeks: 2, monthDone: 5, nextDate: "2026-08-20", isTaper: false };

  test("ช่วง taper ไม่ตัดสินว่าขาดวินัย", () => {
    const summary = strengthPanelSummary({ ...base, isTaper: true });
    expect(summary.tone).toBe("neutral");
    expect(summary.headline).toContain("taper");
  });

  test("ทำครบแล้ว = เขียว", () => {
    expect(strengthPanelSummary({ ...base, weekDone: 3 }).tone).toBe("good");
  });

  test("ยังไม่เริ่มเลยทั้งสัปดาห์ = แดง แต่เริ่มแล้วบางส่วน = เหลือง", () => {
    expect(strengthPanelSummary({ ...base, weekDone: 0 }).tone).toBe("hot");
    expect(strengthPanelSummary(base).tone).toBe("warn");
  });

  test("สัปดาห์ที่ไม่มีแผนเวทไม่ใช่ความผิด", () => {
    expect(strengthPanelSummary({ ...base, weekPlanned: 0, weekDone: 0 }).tone).toBe("neutral");
  });
});

describe("energyPanelSummary", () => {
  const base = {
    isoWeek: "2026-W34",
    exerciseKcal: 1600,
    tdeeKcal: 2400,
    targetIntakeKcal: 2025,
    weightKg: 71.2,
    actualLossKg: 0.5,
    expectedLossKg: 0.68,
    mixedSources: false,
  };

  test("น้ำหนักขึ้นต้องอ่านว่าขึ้น ไม่ใช่ลดช้ากว่าแผน", () => {
    const summary = energyPanelSummary({ ...base, actualLossKg: -1.6, expectedLossKg: 3.07 });
    expect(summary.tone).toBe("hot");
    expect(summary.headline).toContain("เพิ่ม");
  });

  test("ลดใกล้เคียงแผน = เขียว", () => {
    expect(energyPanelSummary(base).tone).toBe("good");
  });

  test("ลดช้ากว่าแผนเกินครึ่งกิโล = เตือน", () => {
    expect(energyPanelSummary({ ...base, actualLossKg: 0.1, expectedLossKg: 0.68 }).tone).toBe("warn");
  });

  test("ยังชั่งไม่พอ ก็บอกแค่เป้ากินต่อวัน", () => {
    const summary = energyPanelSummary({ ...base, actualLossKg: null, expectedLossKg: null });
    expect(summary.tone).toBe("neutral");
    expect(summary.headline).toContain("2,025");
  });

  test("ช่วงที่ปนแหล่ง kcal ต้องเตือนต่อท้ายทุกกรณี", () => {
    expect(energyPanelSummary({ ...base, mixedSources: true }).detail).toContain("ปนแหล่ง");
  });

  test("ยังไม่มีข้อมูลพลังงานเลย", () => {
    expect(energyPanelSummary({ ...base, isoWeek: null }).facts).toHaveLength(0);
  });
});

describe("homeReadinessSummary", () => {
  const base = {
    status: "เขียว",
    recommendation: "ซ้อมตามแผนได้",
    plannedSession: "Easy run 40 นาที",
    recoveryPercent: 78,
    sleepMinutes: 430,
    hrvMs: 62,
    loadRatio: 1.1,
    tone: "good" as const,
  };

  // ข้อความมาจาก daily_readiness ที่ pipeline ตัดสินไว้แล้ว — หน้าเว็บต้องไม่ตัดสินใหม่
  test("ใช้คำแนะนำจากต้นทางตรง ๆ ไม่เขียนทับ", () => {
    const summary = homeReadinessSummary(base);
    expect(summary.headline).toBe("Easy run 40 นาที");
    expect(summary.detail).toBe("ซ้อมตามแผนได้");
    expect(summary.badge).toBe("เขียว");
  });

  test("ไม่มีทั้งสถานะและคำแนะนำ = ยังไม่มีข้อมูลของวันนี้", () => {
    const summary = homeReadinessSummary({ ...base, status: null, recommendation: null });
    expect(summary.tone).toBe("neutral");
    expect(summary.facts).toHaveLength(4); // ตัวเลขยังแสดงได้แม้ไม่มีข้อความ
  });

  test("มีสถานะแต่ไม่มีคำแนะนำ ก็ยังบอกให้ดูตัวเลขเอง", () => {
    const summary = homeReadinessSummary({ ...base, recommendation: "  " });
    expect(summary.detail).toContain("ดูตัวเลขข้างล่าง");
  });
});

describe("calendarSummary", () => {
  const base = {
    plannedCount: 4,
    doneCount: 2,
    skippedCount: 0,
    plannedKm: 24,
    nextTitle: "Long run",
    nextDate: "2026-08-23",
    strengthPlanned: 3,
    strengthDone: 1,
  };

  test("บอกว่าเหลืออีกกี่รายการและถัดไปคืออะไร", () => {
    const summary = calendarSummary(base);
    expect(summary.headline).toContain("เหลืออีก 2");
    expect(summary.detail).toContain("Long run");
  });

  test("ทำครบไม่มีข้าม = เขียว", () => {
    expect(calendarSummary({ ...base, doneCount: 4 }).tone).toBe("good");
  });

  // รายการที่ข้ามทำให้สัปดาห์ "จบ" แต่ไม่ใช่ "ครบ" — สองอย่างนี้ต้องอ่านต่างกัน
  test("จบสัปดาห์ด้วยการข้ามบางรายการ = เตือน ไม่ใช่เขียว", () => {
    const summary = calendarSummary({ ...base, doneCount: 2, skippedCount: 2 });
    expect(summary.tone).toBe("warn");
    expect(summary.headline).toContain("ข้าม 2");
  });

  test("สัปดาห์ที่ไม่มีแผนทั้งวิ่งและเวท", () => {
    expect(calendarSummary({ ...base, plannedCount: 0, doneCount: 0, strengthPlanned: 0, strengthDone: 0 }).tone).toBe("neutral");
  });
});

describe("raceSummary", () => {
  const base = {
    raceName: "Bangkok 10K",
    raceDate: "2026-11-22",
    daysLeft: 93,
    readinessScore: 72,
    targetText: "58:00",
    targetLocked: true,
    completed: false,
    resultText: null,
  };

  test("เป้าล็อกแล้วและยังอีกไกล = เขียว", () => {
    const summary = raceSummary(base);
    expect(summary.tone).toBe("good");
    expect(summary.headline).toContain("93 วัน");
  });

  // ใกล้วันแข่งแต่ยังไม่ล็อกเป้า ต้องเตือน ไม่ใช่ปล่อยผ่านเป็นกลาง
  test("เหลือไม่ถึงสามสัปดาห์และยังไม่ล็อกเป้า = เตือน", () => {
    const summary = raceSummary({ ...base, daysLeft: 14, targetLocked: false, targetText: null });
    expect(summary.tone).toBe("warn");
    expect(summary.detail).toContain("สามสัปดาห์");
  });

  test("ยังไม่ล็อกเป้าแต่ยังอีกไกล = เป็นกลาง", () => {
    expect(raceSummary({ ...base, targetLocked: false, targetText: null }).tone).toBe("neutral");
  });

  test("แข่งจบแล้วเลิกคาดการณ์ หันไปเทียบผลจริง", () => {
    const summary = raceSummary({ ...base, completed: true, resultText: "57:42", daysLeft: -3 });
    expect(summary.headline).toContain("57:42");
    expect(summary.facts.some((fact) => fact.label === "ผลที่ทำได้")).toBe(true);
  });

  test("ไม่มีวันแข่งก็ไม่เดา", () => {
    expect(raceSummary({ ...base, raceDate: null }).tone).toBe("neutral");
  });
});

describe("bodySummary", () => {
  const base = {
    weightKg: 71.2,
    measuredDate: "2026-08-21",
    prevWeightKg: 71.9,
    bodyFatPct: 22.4,
    muscleMassKg: 52.4,
    guideWeightKg: 72,
    entryCount: 14,
  };

  test("บอกทิศทางเทียบครั้งก่อน", () => {
    const summary = bodySummary(base);
    expect(summary.headline).toContain("ลด 0.7");
    expect(summary.badge).toContain("2026-08-21");
  });

  test("อยู่ต่ำกว่าเส้นแผน = เขียว", () => {
    expect(bodySummary(base).tone).toBe("good");
  });

  test("สูงกว่าเส้นแผนเกินหนึ่งกิโล = เตือน", () => {
    expect(bodySummary({ ...base, weightKg: 73.5 }).tone).toBe("warn");
  });

  test("ยังไม่มีผลชั่ง ก็ชวนให้อัปโหลดรูปแทนการโชว์ขีด", () => {
    const summary = bodySummary({ ...base, entryCount: 0, weightKg: null });
    expect(summary.tone).toBe("neutral");
    expect(summary.detail).toContain("OCR");
  });
});
