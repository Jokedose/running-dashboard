import { km, minutes, pace, percent } from "./format";

/* ─────────────────────────────────────────────
   Page summary — แปลตัวเลขบนหน้าให้เป็นประโยคเดียวที่อ่านแล้วรู้เรื่องทันที

   ทุกฟังก์ชันในไฟล์นี้เป็น pure: หน้าเว็บคำนวณตัวเลขของมันไว้แล้ว ส่งเข้ามา
   ไม่ใช่ให้ที่นี่คำนวณซ้ำจาก DashboardData — ถ้าคำนวณซ้ำ วันหนึ่งแถบสรุปกับ
   การ์ดข้างล่างจะพูดคนละเลขโดยไม่มีใครรู้ตัว
   ───────────────────────────────────────────── */

export type SummaryTone = "good" | "warn" | "hot" | "neutral";

export type SummaryFact = { label: string; value: string };

export type PageSummary = {
  /** ป้ายสั้น ๆ เหนือพาดหัว เช่นสถานะจาก db หรือชื่อรายการแข่ง (ไม่ใส่ก็ได้) */
  badge?: string;
  /** พาดหัว: สถานะตอนนี้เป็นภาษาคน ไม่ใช่ชื่อ metric */
  headline: string;
  /** แปลว่าอะไร และควรทำอะไรต่อ */
  detail: string;
  tone: SummaryTone;
  facts: SummaryFact[];
};

const NO_DATA: Omit<PageSummary, "headline" | "detail"> = { tone: "neutral", facts: [] };

/** "2310 นาที" ไม่มีใครอ่านออกในหัว — เกินสามชั่วโมงให้พูดเป็นชั่วโมงแทน */
function duration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "-";
  return min >= 180 ? `${(min / 60).toFixed(1)} ชม.` : minutes(min);
}

/* ── Zone 2 ── */

export function zone2Summary(input: {
  sampleSize: number;
  avgZ2: number | null;
  avgDrift: number | null;
  latestZ2: number | null;
  z2Min: number;
  driftMax: number;
  latestCadence: number | null;
  cadenceMin: number;
}): PageSummary {
  const { sampleSize, avgZ2, avgDrift, latestZ2, z2Min, driftMax, latestCadence, cadenceMin } = input;
  if (!sampleSize || (avgZ2 == null && avgDrift == null)) {
    return {
      ...NO_DATA,
      headline: "ยังไม่มีรัน easy/long พอให้สรุป",
      detail: "หน้านี้ดูเฉพาะรันที่ตั้งใจซ้อมแอโรบิก — วิ่ง easy หรือ long สักสองสามครั้งแล้วค่อยกลับมาอ่าน",
    };
  }

  const z2Ok = avgZ2 != null && avgZ2 >= z2Min;
  const driftOk = avgDrift != null && avgDrift <= driftMax;
  const facts: SummaryFact[] = [
    { label: "Z2 เฉลี่ย", value: percent(avgZ2) },
    { label: "การไหลของ HR", value: avgDrift == null ? "-" : `${avgDrift.toFixed(1)} bpm` },
    { label: "Z2 ครั้งล่าสุด", value: percent(latestZ2) },
    { label: "รันที่นับ", value: `${sampleSize} ครั้ง` },
  ];

  if (z2Ok && driftOk) {
    return {
      headline: "คุมโซน 2 ได้ตามเกณฑ์",
      detail: `เวลาอยู่ใน Z2 เฉลี่ยผ่านเป้า ${z2Min}% และ HR ไม่ไหลเกิน ${driftMax} bpm — ฐานแอโรบิกกำลังก่อตัวตามที่ควร วิ่ง easy ให้ช้าแบบนี้ต่อไป`,
      tone: "good",
      facts,
    };
  }
  if (!z2Ok && !driftOk) {
    return {
      headline: "วิ่ง easy เร็วเกินไป",
      detail: `Z2 เฉลี่ยยังไม่ถึง ${z2Min}% และ HR ไหลเกิน ${driftMax} bpm ทั้งสองอย่างชี้ไปทางเดียวกัน — ลดเพซลงจนหายใจคุยได้ ยอมช้าลงตอนนี้เพื่อให้ฐานโตจริง`,
      tone: "hot",
      facts,
    };
  }
  if (!z2Ok) {
    return {
      headline: "ยังหลุดโซน 2 อยู่บ่อย",
      detail: `เวลาใน Z2 เฉลี่ย ${percent(avgZ2)} ต่ำกว่าเป้า ${z2Min}% — HR ยังไม่ไหลผิดปกติ แปลว่าคุมได้แต่ออกตัวเร็วไปหน่อย ลองเริ่มช้ากว่าที่รู้สึกว่าควร`,
      tone: "warn",
      facts,
    };
  }
  const cadenceNote =
    latestCadence != null && latestCadence < cadenceMin
      ? ` (cadence ล่าสุด ${latestCadence.toFixed(0)} spm ต่ำกว่าเป้า ${cadenceMin} ด้วย — ก้าวถี่ขึ้นช่วยลดแรงกระแทกได้)`
      : "";
  return {
    headline: "HR ไหลเกินเกณฑ์",
    detail: `เวลาใน Z2 ผ่านเป้าแล้ว แต่ HR ไหลเฉลี่ย ${avgDrift?.toFixed(1)} bpm เกิน ${driftMax} — มักมาจากอากาศร้อน นอนไม่พอ หรือสะสมล้า ไม่ใช่เพซอย่างเดียว${cadenceNote}`,
    tone: "warn",
    facts,
  };
}

/* ── Load ── */

export function loadSummary(input: {
  acwr: number | null;
  zoneLabel: string;
  zoneTone: SummaryTone;
  tsb: number | null;
  openInjuries: number;
  hasEnoughHistory: boolean;
  usingTrimp: boolean;
}): PageSummary {
  const { acwr, zoneLabel, zoneTone, tsb, openInjuries, hasEnoughHistory, usingTrimp } = input;
  if (!hasEnoughHistory || acwr == null) {
    return {
      ...NO_DATA,
      headline: "ประวัติยังไม่พอคิด ACWR",
      detail: "อัตราส่วนโหลดเฉียบพลันต่อเรื้อรังต้องมีประวัติอย่างน้อย 28 วันจึงจะมีความหมาย — ก่อนหน้านั้นตัวเลขจะแกว่งจนอ่านผิด",
    };
  }

  const facts: SummaryFact[] = [
    { label: "ACWR", value: acwr.toFixed(2) },
    { label: "ความสด (TSB)", value: tsb == null ? "-" : tsb.toFixed(1) },
    { label: "ฐานที่ใช้คิด", value: usingTrimp ? "TRIMP จาก HR" : "ระยะทาง (ยังไม่ sync)" },
  ];

  // โหลดสูงพร้อมเคสเจ็บที่ยังไม่ปิด คือสัญญาณที่ต้องพูดก่อนอย่างอื่น
  if (openInjuries > 0 && zoneTone !== "good") {
    return {
      headline: "โหลดสูงพร้อมกับมีอาการที่ยังไม่ปิดเคส",
      detail: `ACWR ${acwr.toFixed(2)} — ${zoneLabel} พร้อมกับมีอาการเปิดอยู่ ${openInjuries} เคส — สองอย่างนี้รวมกันเสี่ยงกว่าดูแยกกันมาก ควรถอยกลับไป easy/recovery จนกว่าอัตราส่วนจะกลับเข้าโซนปลอดภัย`,
      tone: "hot",
      facts,
    };
  }
  if (zoneTone === "good") {
    return {
      headline: "โหลดอยู่ในโซนปลอดภัย",
      detail: `ACWR ${acwr.toFixed(2)} — ${zoneLabel} เพิ่มงานได้ตามแผนโดยไม่ต้องระวังเป็นพิเศษ${tsb != null && tsb < 0 ? " แต่ TSB ยังติดลบ แปลว่าล้าสะสมยังไม่คลาย" : ""}`,
      tone: "good",
      facts,
    };
  }
  return {
    headline: zoneTone === "hot" ? "โหลดพุ่งเร็วเกินไป" : `โหลด${zoneLabel.includes("ต่ำ") ? "ต่ำกว่าที่ควร" : "เริ่มสูง"}`,
    detail: `ACWR ${acwr.toFixed(2)} — ${zoneLabel} ${
      zoneLabel.includes("ต่ำ")
        ? "งานที่ทำน้อยกว่าฐานที่สะสมไว้ ถ้าไม่ได้ตั้งใจ taper ควรค่อย ๆ เติมระยะกลับ"
        : "ระวังการเพิ่มระยะหรือความหนักในสัปดาห์หน้า ให้ร่างกายตามทัน"
    }`,
    tone: zoneTone,
    facts,
  };
}

/* ── Trends ── */

export function trendsSummary(input: {
  totalWeeks: number;
  avgWeeklyKm: number | null;
  longestLongRunKm: number | null;
  longTargetKm: number;
  avgHrvMs: number | null;
  avgSleepMin: number | null;
}): PageSummary {
  const { totalWeeks, avgWeeklyKm, longestLongRunKm, longTargetKm, avgHrvMs, avgSleepMin } = input;
  if (!totalWeeks) {
    return {
      ...NO_DATA,
      headline: "ยังไม่มีสัปดาห์ที่สรุปไว้",
      detail: "หน้านี้อ่านจาก weekly_summaries — พอมีสัปดาห์แรกถูก sync ขึ้นมา เทรนด์จะเริ่มมีรูป",
    };
  }

  const reachedLong = longestLongRunKm != null && longestLongRunKm >= longTargetKm;
  const sleepShort = avgSleepMin != null && avgSleepMin < 420; // 7 ชม.
  const facts: SummaryFact[] = [
    { label: "ระยะเฉลี่ย/สัปดาห์", value: km(avgWeeklyKm) },
    { label: "Long run ยาวสุด", value: km(longestLongRunKm) },
    { label: "HRV เฉลี่ย", value: avgHrvMs == null ? "-" : `${avgHrvMs.toFixed(0)} ms` },
    { label: "นอนเฉลี่ย", value: avgSleepMin == null ? "-" : `${(avgSleepMin / 60).toFixed(1)} ชม.` },
  ];

  return {
    headline: reachedLong ? `สะสมมา ${totalWeeks} สัปดาห์ long run ถึงเป้าแล้ว` : `สะสมมา ${totalWeeks} สัปดาห์ long run ยังไม่ถึงเป้า`,
    detail: `${
      reachedLong
        ? `ระยะยาวสุด ${km(longestLongRunKm)} ผ่านเป้าแผน ${longTargetKm} km`
        : `ระยะยาวสุด ${km(longestLongRunKm)} เทียบเป้าแผน ${longTargetKm} km — ไต่ทีละสัปดาห์ อย่ากระโดด`
    }${sleepShort ? " · การนอนเฉลี่ยต่ำกว่า 7 ชม. ซึ่งเป็นตัวจำกัดการฟื้นตัวก่อนตัวอื่น" : ""}`,
    tone: reachedLong && !sleepShort ? "good" : "warn",
    facts,
  };
}

/* ── Reports — ใช้ได้ทั้งโหมดสัปดาห์และเดือน จึงรับ periodLabel แทนชื่อ week ── */

export function reportsSummary(input: {
  periodLabel: string | null;
  periodNoun: string;
  distanceKm: number | null;
  durationMin: number | null;
  runCount: number | null;
  longRunCount: number | null;
  qualityCount: number | null;
  prevDistanceKm: number | null;
}): PageSummary {
  const { periodLabel, periodNoun, distanceKm, durationMin, runCount, longRunCount, qualityCount, prevDistanceKm } = input;
  if (!periodLabel) {
    return {
      ...NO_DATA,
      headline: `ยังไม่มี${periodNoun}ให้สรุป`,
      detail: "รายงานนี้รวมจาก run_logs โดยตรง — ต้องมีรันอย่างน้อยหนึ่งครั้งก่อน",
    };
  }

  const facts: SummaryFact[] = [
    { label: "ระยะรวม", value: km(distanceKm) },
    { label: "เวลารวม", value: duration(durationMin) },
    { label: "จำนวนครั้ง", value: runCount == null ? "-" : `${runCount} ครั้ง` },
  ];
  if (longRunCount != null || qualityCount != null) {
    facts.push({ label: "ยาว / คุณภาพ", value: `${longRunCount ?? 0} · ${qualityCount ?? 0}` });
  }

  // เทียบกับช่วงก่อนหน้าเสมอ เพราะ "20 km" อ่านไม่ออกถ้าไม่รู้ว่ารอบที่แล้วเท่าไร
  const delta = distanceKm != null && prevDistanceKm != null ? distanceKm - prevDistanceKm : null;
  const deltaText =
    delta == null
      ? `ยังไม่มี${periodNoun}ก่อนหน้าให้เทียบ`
      : Math.abs(delta) < 1
        ? `ระยะใกล้เคียง${periodNoun}ก่อน`
        : delta > 0
          ? `มากกว่า${periodNoun}ก่อน ${delta.toFixed(1)} km`
          : `น้อยกว่า${periodNoun}ก่อน ${Math.abs(delta).toFixed(1)} km`;

  // เพิ่มเกิน 30% ในรอบเดียวคือรูปแบบที่มักตามด้วยอาการเจ็บ
  const spike = delta != null && prevDistanceKm != null && prevDistanceKm > 0 && delta / prevDistanceKm > 0.3;
  const sessionMix =
    longRunCount != null || qualityCount != null
      ? ` · วิ่งยาว ${longRunCount ?? 0} ครั้ง ซ้อมคุณภาพ ${qualityCount ?? 0} ครั้ง`
      : "";

  return {
    headline: `${periodLabel}: ${km(distanceKm)} จาก ${runCount ?? 0} ครั้ง`,
    detail: `${deltaText}${spike ? ` — เพิ่มเกิน 30% ใน${periodNoun}เดียว ซึ่งเป็นจังหวะที่อาการเจ็บมักตามมา` : ""}${sessionMix}`,
    tone: spike ? "warn" : "good",
    facts,
  };
}

/* ── Activities ── */

export function activitiesSummary(input: {
  totalActivities: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  avgPaceSec: number | null;
  painCount: number;
  painWindow: number;
  /** null เมื่อฐานยังไม่มี run_logs.kcal_net (ก่อน migration 014) */
  totalKcal?: number | null;
}): PageSummary {
  const { totalActivities, totalDistanceKm, totalDurationMin, avgPaceSec, painCount, painWindow, totalKcal } = input;
  if (!totalActivities) {
    return { ...NO_DATA, headline: "ยังไม่มีกิจกรรมที่บันทึก", detail: "พอ run log แรกถูก sync ขึ้นมา หน้านี้จะเริ่มสะสมสถิติให้เอง" };
  }

  const facts: SummaryFact[] = [
    { label: "กิจกรรมทั้งหมด", value: `${totalActivities} ครั้ง` },
    { label: "ระยะรวม", value: km(totalDistanceKm) },
    { label: "เวลารวม", value: duration(totalDurationMin) },
    { label: "เพซเฉลี่ยรวม", value: pace(avgPaceSec) },
  ];
  // เพิ่มเป็นตัวที่ห้าเมื่อมีข้อมูล ไม่ใช่ไปแทนที่เพซซึ่งเป็นตัวเลขที่ดูบ่อยกว่า
  if (totalKcal != null) {
    facts.push({ label: "พลังงานรวม (net)", value: `${Math.round(totalKcal).toLocaleString("en-US")} kcal` });
  }

  return {
    headline: `บันทึกไว้ ${totalActivities} ครั้ง รวม ${km(totalDistanceKm)}`,
    detail:
      painCount > 0
        ? `เพซเฉลี่ยตลอดคลัง ${pace(avgPaceSec)} · ${painWindow} ครั้งล่าสุดมีบันทึกอาการ ${painCount} ครั้ง — แตะแถวที่มีธงแดงเพื่อดูว่าเกิดในเซสชันแบบไหน`
        : `เพซเฉลี่ยตลอดคลัง ${pace(avgPaceSec)} · ${painWindow} ครั้งล่าสุดไม่มีบันทึกอาการเจ็บเลย`,
    tone: painCount > 0 ? "warn" : "good",
    facts,
  };
}

/* ── Injury ── */

export function injurySummary(input: {
  openTitles: string[];
  daysPainFree: number | null;
  totalNiggles: number;
  highCount: number;
  recurrencePart: string | null;
  recurrenceCount: number;
}): PageSummary {
  const { openTitles, daysPainFree, totalNiggles, highCount, recurrencePart, recurrenceCount } = input;
  const facts: SummaryFact[] = [
    { label: "เคสที่เปิดอยู่", value: openTitles.length ? `${openTitles.length} เคส` : "ไม่มี" },
    { label: "ปลอดเจ็บล่าสุด", value: daysPainFree == null ? "ไม่มีบันทึก" : `${daysPainFree} วัน` },
    { label: "บันทึกอาการทั้งหมด", value: `${totalNiggles} ครั้ง` },
    { label: "ระดับหนัก", value: `${highCount} ครั้ง` },
  ];

  if (openTitles.length) {
    return {
      headline: `มีอาการที่ยังไม่ปิดเคส ${openTitles.length} รายการ`,
      detail: `${openTitles.join(" · ")} — กติกาวิ่งของแต่ละเคสอยู่ในการ์ดข้างล่าง ทำตามนั้นก่อนเพิ่มโหลด${
        recurrencePart ? ` · ${recurrencePart} กลับมาซ้ำ ${recurrenceCount} ครั้งใน 30 วัน` : ""
      }`,
      tone: "hot",
      facts,
    };
  }
  if (recurrencePart) {
    return {
      headline: `${recurrencePart}กลับมาซ้ำใน 30 วัน`,
      detail: `บันทึกไว้ ${recurrenceCount} ครั้ง — ยังไม่มีเคสเปิดใน injury_status แต่รูปแบบซ้ำที่จุดเดิมคือสัญญาณเตือนก่อนจะกลายเป็นเคสจริง`,
      tone: "warn",
      facts,
    };
  }
  if (daysPainFree == null) {
    return { ...NO_DATA, headline: "ยังไม่มีบันทึกอาการเจ็บเลย", detail: "ไม่มีเคสเปิด และไม่มี pain note ใน run log — รักษาโหลดให้อยู่ในโซนปลอดภัยต่อไป" };
  }
  return {
    headline: daysPainFree >= 14 ? `ปลอดอาการมา ${daysPainFree} วัน` : `เพิ่งมีอาการเมื่อ ${daysPainFree} วันก่อน`,
    detail:
      daysPainFree >= 14
        ? "ไม่มีเคสเปิดใน injury_status และไม่มีอาการใหม่มาสองสัปดาห์ — เพิ่มงานได้ตามแผน แต่ยังคุ้มที่จะจดทุกครั้งที่รู้สึกผิดปกติ"
        : "ยังไม่ถึงสองสัปดาห์นับจากอาการล่าสุด ช่วงนี้ให้ระวังการเพิ่มระยะหรือความหนักแบบก้าวกระโดด",
    tone: daysPainFree >= 14 ? "good" : "warn",
    facts,
  };
}

/* ── Strength ── */

export function strengthPanelSummary(input: {
  weekDone: number;
  weekPlanned: number;
  streakWeeks: number;
  monthDone: number;
  nextDate: string | null;
  isTaper: boolean;
}): PageSummary {
  const { weekDone, weekPlanned, streakWeeks, monthDone, nextDate, isTaper } = input;
  const facts: SummaryFact[] = [
    { label: "สัปดาห์นี้", value: `${weekDone}/${weekPlanned}` },
    { label: "streak", value: `${streakWeeks} สัปดาห์` },
    { label: "สะสมเดือนนี้", value: `${monthDone} ครั้ง` },
    { label: "ถัดไป", value: nextDate ?? "ยังไม่มีแผน" },
  ];

  if (isTaper) {
    return {
      headline: "ช่วง taper — งดเวททั้งหมด",
      detail: "กติกาแผนคือหยุดงานเวทช่วง taper เพื่อให้ขาสดวันแข่ง ตัวเลขข้างล่างจึงควรนิ่ง ไม่ใช่สัญญาณว่าขาดวินัย",
      tone: "neutral",
      facts,
    };
  }
  if (!weekPlanned) {
    return { ...NO_DATA, headline: "สัปดาห์นี้ไม่มีแผนเวท", detail: `เดือนนี้ทำไปแล้ว ${monthDone} ครั้ง — ${nextDate ? `นัดถัดไป ${nextDate}` : "ยังไม่มีเซสชันข้างหน้าในแผน"}`, facts };
  }
  if (weekDone >= weekPlanned) {
    return {
      headline: "สัปดาห์นี้ทำครบแล้ว",
      detail: `${weekDone}/${weekPlanned} เซสชัน และทำครบต่อเนื่องมา ${streakWeeks} สัปดาห์ — ความสม่ำเสมอคือสิ่งที่งานเวทให้ผล ไม่ใช่ความหนักของวันใดวันหนึ่ง`,
      tone: "good",
      facts,
    };
  }
  return {
    headline: `สัปดาห์นี้เหลืออีก ${weekPlanned - weekDone} เซสชัน`,
    detail: `ทำไปแล้ว ${weekDone}/${weekPlanned}${nextDate ? ` · นัดถัดไป ${nextDate}` : ""} — streak ${streakWeeks} สัปดาห์จะยังไม่ขาดถ้าเก็บครบก่อนสิ้นสัปดาห์`,
    tone: weekDone > 0 ? "warn" : "hot",
    facts,
  };
}

/* ── Energy ── */

export function energyPanelSummary(input: {
  isoWeek: string | null;
  exerciseKcal: number | null;
  tdeeKcal: number | null;
  targetIntakeKcal: number | null;
  weightKg: number | null;
  actualLossKg: number | null;
  expectedLossKg: number | null;
  mixedSources: boolean;
}): PageSummary {
  const { isoWeek, exerciseKcal, tdeeKcal, targetIntakeKcal, weightKg, actualLossKg, expectedLossKg, mixedSources } = input;
  if (!isoWeek) {
    return { ...NO_DATA, headline: "ยังไม่มีข้อมูลพลังงาน", detail: "ตาราง energy_weekly ยังไม่มีสัปดาห์ไหนถูก sync ขึ้นมา" };
  }

  const facts: SummaryFact[] = [
    { label: `เผาจากการซ้อม (${isoWeek})`, value: exerciseKcal == null ? "-" : `${Math.round(exerciseKcal).toLocaleString("en-US")} kcal` },
    { label: "TDEE เฉลี่ย/วัน", value: tdeeKcal == null ? "-" : `${Math.round(tdeeKcal).toLocaleString("en-US")} kcal` },
    { label: "เป้ากิน/วัน", value: targetIntakeKcal == null ? "-" : `${Math.round(targetIntakeKcal).toLocaleString("en-US")} kcal` },
    { label: "น้ำหนักล่าสุด", value: weightKg == null ? "-" : `${weightKg.toFixed(1)} kg` },
  ];

  const mixedNote = mixedSources ? " · ช่วงนี้ปนแหล่ง kcal สองแบบ อ่านเป็นเทรนด์เดียวไม่ได้" : "";

  if (actualLossKg == null || expectedLossKg == null) {
    return {
      headline: `กินให้ได้วันละ ${targetIntakeKcal == null ? "-" : Math.round(targetIntakeKcal).toLocaleString("en-US")} kcal`,
      detail: `คิดจาก TDEE ของสัปดาห์ล่าสุดลบ deficit เป้าหมาย — ยังชั่งน้ำหนักไม่พอจะบอกว่า deficit เกิดขึ้นจริงไหม${mixedNote}`,
      tone: "neutral",
      facts,
    };
  }

  // น้ำหนักขึ้นกับ "ลดได้ไม่ถึงเป้า" คนละเรื่อง จึงต้องแยกประโยคกัน
  if (actualLossKg < 0) {
    return {
      headline: `น้ำหนักเพิ่ม ${Math.abs(actualLossKg).toFixed(2)} kg สวนทางแผน`,
      detail: `แผนคาดว่าจะลด ${expectedLossKg.toFixed(2)} kg ในช่วงเดียวกัน — deficit ไม่ได้เกิดขึ้นจริง ถ้าเป็นช่วงพักบาดเจ็บก็สมเหตุสมผล เพราะฝั่งเผาหายไปแต่ฝั่งกินมักเท่าเดิม${mixedNote}`,
      tone: "hot",
      facts,
    };
  }
  const gap = actualLossKg - expectedLossKg;
  return {
    headline: `ลดไป ${actualLossKg.toFixed(2)} kg จากแผน ${expectedLossKg.toFixed(2)} kg`,
    detail: `${
      gap >= 0.3
        ? "ลดเร็วกว่าแผน — อาจกินต่ำกว่าเป้า หรือ TDEE จริงสูงกว่าที่คำนวณ"
        : gap <= -0.3
          ? "ลดช้ากว่าแผน — deficit ที่ตั้งใจไว้ยังไม่เกิดขึ้นเต็มที่"
          : "ใกล้เคียงแผน — สมมติฐาน TDEE ที่ใช้อยู่ยังใช้ได้"
    }${mixedNote}`,
    tone: gap <= -0.3 ? "warn" : "good",
    facts,
  };
}

/* ── Home — ความพร้อมวันนี้ ── */

/**
 * ต่างจาก builder ตัวอื่นตรงที่ข้อความหลักมาจาก daily_readiness ซึ่ง pipeline
 * ตัดสินไว้แล้ว — ที่นี่จึงไม่ตัดสินซ้ำ แค่จัดรูปให้เข้าแถบเดียวกับหน้าอื่น
 * และเขียนเองเฉพาะตอนที่ต้นทางยังไม่มีข้อความมาให้
 */
export function homeReadinessSummary(input: {
  status: string | null;
  recommendation: string | null;
  plannedSession: string | null;
  recoveryPercent: number | null;
  sleepMinutes: number | null;
  hrvMs: number | null;
  loadRatio: number | null;
  tone: SummaryTone;
}): PageSummary {
  const { status, recommendation, plannedSession, recoveryPercent, sleepMinutes, hrvMs, loadRatio, tone } = input;
  const facts: SummaryFact[] = [
    { label: "การฟื้นตัว", value: recoveryPercent == null ? "-" : `${recoveryPercent}%` },
    { label: "การนอน", value: sleepMinutes == null ? "-" : `${(sleepMinutes / 60).toFixed(1)} ชม.` },
    { label: "HRV", value: hrvMs == null ? "-" : `${hrvMs} ms` },
    { label: "โหลด (ACWR)", value: loadRatio == null ? "-" : loadRatio.toFixed(2) },
  ];

  if (!status && !recommendation) {
    return {
      ...NO_DATA,
      headline: "ยังไม่มีข้อมูลความพร้อมของวันนี้",
      detail: "daily_readiness ยังไม่มีแถวของวันนี้ — ดึงข้อมูล COROS แล้ว sync ก่อนค่อยตัดสินใจว่าจะซ้อมอะไร",
      facts,
    };
  }

  return {
    badge: status ?? undefined,
    headline: plannedSession?.trim() || "ยังไม่มีแผนของวันนี้",
    detail:
      recommendation?.trim() ||
      "มีสถานะความพร้อมแล้วแต่ยังไม่มีคำแนะนำจากต้นทาง — ดูตัวเลขข้างล่างประกอบก่อนตัดสินใจ",
    tone,
    facts,
  };
}

/* ── Calendar — สัปดาห์นี้เดินตามแผนแค่ไหน ── */

export function calendarSummary(input: {
  plannedCount: number;
  doneCount: number;
  skippedCount: number;
  plannedKm: number | null;
  nextTitle: string | null;
  nextDate: string | null;
  strengthPlanned: number;
  strengthDone: number;
}): PageSummary {
  const { plannedCount, doneCount, skippedCount, plannedKm, nextTitle, nextDate, strengthPlanned, strengthDone } = input;
  const facts: SummaryFact[] = [
    { label: "วิ่งสัปดาห์นี้", value: `${doneCount}/${plannedCount}` },
    { label: "ระยะตามแผน", value: km(plannedKm) },
    { label: "เวทสัปดาห์นี้", value: `${strengthDone}/${strengthPlanned}` },
    { label: "ถัดไป", value: nextDate ?? "ไม่มีในแผน" },
  ];

  if (!plannedCount && !strengthPlanned) {
    return {
      ...NO_DATA,
      headline: "สัปดาห์นี้ยังไม่มีแผนในปฏิทิน",
      detail: "ทั้ง training_plan และ strength_plan ไม่มีรายการของสัปดาห์นี้ — ถ้าเพิ่งวางแผนไว้ ลอง sync ฝั่ง running-results อีกรอบ",
      facts,
    };
  }

  const remaining = plannedCount - doneCount - skippedCount;
  const nextText = nextTitle && nextDate ? `ถัดไปคือ ${nextTitle} วันที่ ${nextDate}` : "ไม่มีรายการที่ยังไม่ทำเหลือในสัปดาห์นี้";

  if (remaining <= 0 && plannedCount > 0) {
    return {
      headline: skippedCount > 0 ? `สัปดาห์นี้จบแล้ว — ทำ ${doneCount} ข้าม ${skippedCount}` : "สัปดาห์นี้ทำครบทุกรายการ",
      detail:
        skippedCount > 0
          ? `รายการที่ข้ามไม่ได้หายไปจากสถิติ เหตุผลที่ข้ามอยู่ในการ์ดของวันนั้น · ${nextText}`
          : `เดินตามแผนได้ครบทั้งสัปดาห์ · ${nextText}`,
      tone: skippedCount > 0 ? "warn" : "good",
      facts,
    };
  }

  return {
    headline: `สัปดาห์นี้เหลืออีก ${remaining} รายการ`,
    detail: `ทำไปแล้ว ${doneCount} จาก ${plannedCount} รายการ${skippedCount > 0 ? ` (ข้าม ${skippedCount})` : ""} · ${nextText}`,
    tone: doneCount > 0 ? "warn" : "neutral",
    facts,
  };
}

/* ── Race ── */

export function raceSummary(input: {
  raceName: string | null;
  raceDate: string | null;
  daysLeft: number | null;
  readinessScore: number | null;
  targetText: string | null;
  targetLocked: boolean;
  completed: boolean;
  resultText: string | null;
}): PageSummary {
  const { raceName, raceDate, daysLeft, readinessScore, targetText, targetLocked, completed, resultText } = input;
  const facts: SummaryFact[] = [
    { label: "วันแข่ง", value: raceDate ?? "-" },
    {
      label: completed ? "ผลที่ทำได้" : "เหลืออีก",
      value: completed ? resultText ?? "-" : daysLeft == null ? "-" : `${Math.max(0, daysLeft)} วัน`,
    },
    { label: "ความพร้อม", value: readinessScore == null ? "-" : `${readinessScore}/100` },
    { label: "เป้า", value: targetText ?? (targetLocked ? "-" : "ยังไม่ล็อก") },
  ];

  if (!raceDate) {
    return {
      ...NO_DATA,
      headline: "ยังไม่มีรายการแข่งที่ตั้งเป้าไว้",
      detail: "หน้านี้จะเริ่มคาดการณ์ให้เมื่อมี race goal ที่ยังไม่ถูกยกเลิกอยู่ใน race_goals",
      facts,
    };
  }

  if (completed) {
    return {
      badge: raceName ?? undefined,
      headline: `แข่งจบแล้ว${resultText ? ` — ${resultText}` : ""}`,
      detail: "ตัวเลขข้างล่างเป็นการเทียบผลจริงกับเป้าที่ตั้งไว้ ไม่ใช่การคาดการณ์อีกต่อไป",
      tone: "good",
      facts,
    };
  }

  // ใกล้วันแข่งแต่ยังไม่ล็อกเป้า เป็นสองสถานะที่ต้องพูดพร้อมกัน ไม่ใช่แยกกันอ่าน
  const near = daysLeft != null && daysLeft <= 21;
  return {
    badge: raceName ?? undefined,
    headline: daysLeft == null ? "ยังไม่รู้ว่าเหลืออีกกี่วัน" : daysLeft <= 0 ? "ถึงวันแข่งแล้ว" : `เหลืออีก ${daysLeft} วัน`,
    detail: targetLocked
      ? `เป้าที่ล็อกไว้คือ ${targetText ?? "-"}${
          readinessScore != null ? ` · คะแนนความพร้อมตอนนี้ ${readinessScore}/100` : ""
        } — กราฟข้างล่างเทียบฟอร์มจริงกับเส้นที่ควรจะเป็น`
      : `เป้าเวลายังไม่ล็อก จะกำหนดหลังผ่าน Go/No-Go gate${near ? " — เหลือเวลาไม่ถึงสามสัปดาห์แล้ว ควรตัดสินใจเร็ว ๆ นี้" : ""}`,
    tone: targetLocked ? "good" : near ? "warn" : "neutral",
    facts,
  };
}

/* ── Profile / body composition ── */

export function bodySummary(input: {
  weightKg: number | null;
  measuredDate: string | null;
  prevWeightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  guideWeightKg: number | null;
  entryCount: number;
}): PageSummary {
  const { weightKg, measuredDate, prevWeightKg, bodyFatPct, muscleMassKg, guideWeightKg, entryCount } = input;
  if (!entryCount || weightKg == null) {
    return {
      ...NO_DATA,
      headline: "ยังไม่มีผลชั่งในระบบ",
      detail: "ถ่ายรูปหน้าจอแอปเครื่องชั่งแล้วอัปโหลดในหน้านี้ ระบบจะอ่านค่าให้เองผ่าน OCR",
    };
  }

  const delta = prevWeightKg == null ? null : weightKg - prevWeightKg;
  const facts: SummaryFact[] = [
    { label: "น้ำหนักล่าสุด", value: `${weightKg.toFixed(1)} kg` },
    { label: "เทียบครั้งก่อน", value: delta == null ? "-" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} kg` },
    { label: "ไขมัน", value: bodyFatPct == null ? "-" : `${bodyFatPct.toFixed(1)}%` },
    { label: "กล้ามเนื้อ", value: muscleMassKg == null ? "-" : `${muscleMassKg.toFixed(1)} kg` },
  ];

  // เทียบกับเส้น guide ของแผนด้วย เพราะ "ขึ้น 0.3 kg" คนละความหมายกัน
  // ระหว่างตอนอยู่ต่ำกว่าเส้นแผนกับตอนอยู่สูงกว่า
  const vsGuide = guideWeightKg == null ? null : weightKg - guideWeightKg;
  const guideText =
    vsGuide == null
      ? ""
      : vsGuide <= 0
        ? ` · ต่ำกว่าเส้นแผน ${Math.abs(vsGuide).toFixed(1)} kg`
        : ` · สูงกว่าเส้นแผน ${vsGuide.toFixed(1)} kg`;
  const deltaText = delta == null ? "" : delta < -0.05 ? ` (ลด ${Math.abs(delta).toFixed(1)})` : delta > 0.05 ? ` (เพิ่ม ${delta.toFixed(1)})` : " (เท่าเดิม)";

  return {
    badge: measuredDate ? `ชั่งเมื่อ ${measuredDate}` : undefined,
    headline: `${weightKg.toFixed(1)} kg${deltaText}`,
    detail: `บันทึกไว้ทั้งหมด ${entryCount} ครั้ง${guideText} — น้ำหนักรายวันแกว่งตามน้ำและอาหาร ให้ดูทิศทางของเส้น ไม่ใช่ตัวเลขวันเดียว`,
    tone: vsGuide == null ? "neutral" : vsGuide <= 0 ? "good" : vsGuide > 1 ? "warn" : "neutral",
    facts,
  };
}
