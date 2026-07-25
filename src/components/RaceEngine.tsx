import { useState } from "react";
import { Flame, Gauge, ShieldAlert, ShieldCheck, SunMedium, Thermometer, Timer } from "lucide-react";
import { pace, raceTime } from "../utils/format";
import { Panel } from "./Panel";

export type PaceStrategyKind = "conservative" | "even" | "negative" | "runwalk";

const STRATEGY_NOTES: Record<PaceStrategyKind, { label: string; desc: string }> = {
  conservative: {
    label: "🐢 Conservative (ออกตัวช้า 6% ช่วง 2km แรก)",
    desc: "เซฟหัวใจและขาขวาช่วงต้น ไม่รีบตามกลุ่ม ปล่อยให้ระบบร่างกายพร้อมก่อนค่อยเข้าเพซปกติ",
  },
  even: {
    label: "⚖️ Even Pace (คุมเพซสม่ำเสมอเท่ากันตลอด 10K)",
    desc: "เหมาะเมื่อสภาพร่างกายฟิตเต็มร้อย คุมเพซคงที่เพื่อใช้พลังงานเรียบเสมอกันที่สุด",
  },
  negative: {
    label: "🚀 Negative Split (ครึ่งแรกผ่อน 4% ครึ่งหลังเร่งขึ้น)",
    desc: "วิ่งสบายๆ ใน 5km แรก แล้วเร่งความเร็วเมื่อผ่านครึ่งทางเพื่อแซงช่วงท้าย",
  },
  runwalk: {
    label: "🚶‍♂️ Run / Walk 4:1 (วิ่ง 4 นาที เดิน 1 นาที)",
    desc: "เหมาะสำหรับวันฟื้นตัว หรือการวิ่งควบคุม HR ให้อยู่ในโซนปลอดภัย ไม่ล้าเกินไป",
  },
};

export function RaceEngine({
  targetAMinutes = 80,
  cutoffMinutes = 110,
  gate82Minutes = 90,
}: {
  targetAMinutes?: number;
  cutoffMinutes?: number;
  gate82Minutes?: number;
}) {
  const [selectedStrategy, setSelectedStrategy] = useState<PaceStrategyKind>("conservative");
  const [targetMin, setTargetMin] = useState<number>(targetAMinutes);
  const [temperature, setTemperature] = useState<number>(28); // °C
  const [humidity, setHumidity] = useState<number>(75); // %

  // Calculate Pacing Splits based on strategy
  const targetSec = targetMin * 60;
  const avgPaceSec = targetSec / 10;

  const splits = Array.from({ length: 10 }, (_, i) => {
    const km = i + 1;
    let factor = 1.0;

    if (selectedStrategy === "conservative") {
      if (km <= 2) factor = 1.06;
      else if (km <= 7) factor = 0.99;
      else if (km <= 9) factor = 0.98;
      else factor = 0.97;
    } else if (selectedStrategy === "negative") {
      if (km <= 5) factor = 1.04;
      else factor = 0.96;
    } else if (selectedStrategy === "runwalk") {
      // 4:1 run-walk increases avg pace time by ~8%
      factor = 1.08;
    }

    return { km, paceSec: Math.round(avgPaceSec * factor) };
  });

  const totalRaw = splits.reduce((acc, s) => acc + s.paceSec, 0);
  const correction = targetSec / (totalRaw || 1);

  let cumSec = 0;
  let cumAtKm82 = 0;

  const rows = splits.map((s) => {
    const adjustedPace = Math.round(s.paceSec * correction);
    cumSec += adjustedPace;
    if (s.km === 8) {
      // approximate 8.2 km
      cumAtKm82 = cumSec + Math.round(adjustedPace * 0.2);
    }
    return {
      km: s.km,
      pace: adjustedPace,
      cum: cumSec,
    };
  });

  const finishCumMin = cumSec / 60;
  const gate82CumMin = cumAtKm82 / 60;

  const gate82Buffer = gate82Minutes - gate82CumMin;
  const finishBuffer = cutoffMinutes - finishCumMin;

  // Thermal Drift Calculations
  // Base ideal running temp is ~15°C, humidity ~50%
  const tempExcess = Math.max(0, temperature - 18);
  const humExcess = Math.max(0, humidity - 60);

  // HR Drift increase: +1.2 bpm per °C above 18, +0.3 bpm per 10% humidity
  const estimatedHrDrift = Math.round(tempExcess * 1.2 + (humExcess / 10) * 0.4);
  // Recommended Pace slowdown: ~2.5 sec/km per °C above 18
  const recommendedSlowdownSec = Math.round(tempExcess * 2.5 + (humExcess / 10) * 1.2);

  return (
    // ต้องมี span-12 เพราะ div นี้เป็นลูกโดยตรงของ .content-grid (12 คอลัมน์) ใน Race.tsx —
    // ไม่มีคลาสนี้ = ตกเป็นคอลัมน์เดียวแคบๆ ของ grid นอก (span-12 บน Panel ลูกข้างในช่วยไม่ได้
    // เพราะ parent จริงของมันคือ div นี้ ซึ่งเป็น single-column grid ของตัวเอง)
    <div className="span-12" style={{ display: "grid", gap: 18 }}>
      {/* Interactive Pacing Calculator Panel */}
      <Panel
        title="🏎️ Interactive Race Pacing & Cutoff Safety Engine"
        subtitle="จำลอง Pace Strategy และคำนวณ Safety Margin ก่อนถึง Cutoff Gate แบบ Real-time"
        className="span-12"
      >
        <div style={{ display: "grid", gap: 16 }}>
          {/* Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>
                กลยุทธ์การวิ่ง (Pace Strategy):
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value as PaceStrategyKind)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  font: "inherit",
                  fontSize: "0.88rem",
                  background: "#fff",
                  color: "var(--color-ink)",
                }}
              >
                {Object.entries(STRATEGY_NOTES).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>
                  เป้าหมายเวลา (Target Time):
                </label>
                <span style={{ fontSize: "0.88rem", fontWeight: 750, color: "var(--color-primary)" }}>
                  {raceTime(targetMin)} (Pace {pace(avgPaceSec)})
                </span>
              </div>
              <input
                type="range"
                min={55}
                max={120}
                step={1}
                value={targetMin}
                onChange={(e) => setTargetMin(Number(e.target.value))}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: "0.83rem",
              background: "var(--color-primary-soft)",
              padding: "10px 14px",
              borderRadius: 8,
              lineHeight: 1.5,
              borderLeft: "4px solid var(--color-primary)",
            }}
          >
            {STRATEGY_NOTES[selectedStrategy].desc}
          </div>

          {/* Cutoff Gate Safety Margin Status */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius)",
                background: gate82Buffer >= 10 ? "#f4f8f5" : gate82Buffer >= 5 ? "#faf6ec" : "#faf2ea",
                border: `1px solid ${gate82Buffer >= 10 ? "#add9c9" : gate82Buffer >= 5 ? "#eed28b" : "#efb4c3"}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {gate82Buffer >= 10 ? (
                <ShieldCheck color="#1a6847" size={24} />
              ) : (
                <ShieldAlert color={gate82Buffer >= 5 ? "#7a5300" : "#9d1c37"} size={24} />
              )}
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", fontWeight: 600 }}>
                  Cutoff Gate km 8.2 (งบ {gate82Minutes} นาที)
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 750, color: "var(--color-ink)" }}>
                  ถึงประมาณ {raceTime(gate82CumMin)}{" "}
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: gate82Buffer >= 10 ? "#1a6847" : "#7a5300" }}>
                    (สำรอง +{gate82Buffer.toFixed(1)} นาที)
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius)",
                background: finishBuffer >= 10 ? "#f4f8f5" : finishBuffer >= 5 ? "#faf6ec" : "#faf2ea",
                border: `1px solid ${finishBuffer >= 10 ? "#add9c9" : finishBuffer >= 5 ? "#eed28b" : "#efb4c3"}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Timer color={finishBuffer >= 10 ? "#1a6847" : finishBuffer >= 5 ? "#7a5300" : "#9d1c37"} size={24} />
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", fontWeight: 600 }}>
                  Finish Cutoff (งบ {cutoffMinutes} นาที)
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 750, color: "var(--color-ink)" }}>
                  เวลาจบ {raceTime(finishCumMin)}{" "}
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: finishBuffer >= 10 ? "#1a6847" : "#7a5300" }}>
                    (สำรอง +{finishBuffer.toFixed(1)} นาที)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Km Splits Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-line)" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Km</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Pace Target</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>เวลาสะสม</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>คำอธิบายย่อย</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const note =
                    r.km <= 2
                      ? "🐢 วอร์มระบบ / คุม HR"
                      : r.km <= 7
                      ? "⚖️ Steady Pace"
                      : r.km <= 9
                      ? "🔥 รักษาจังหวะ"
                      : "🏁 สเปรนท์เข้าเส้น";
                  const bg = r.km <= 2 ? "#e7efe9" : r.km <= 7 ? "#f4f8f5" : r.km <= 9 ? "#faf6ec" : "#faf2ea";
                  return (
                    <tr key={r.km} style={{ borderBottom: "1px solid var(--color-line-soft)" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 650 }}>{r.km}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                        {pace(r.pace)}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                        {Math.floor(r.cum / 60)}:{String(r.cum % 60).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        <span style={{ background: bg, padding: "2px 8px", borderRadius: "var(--radius)", fontSize: "0.78rem" }}>
                          {note}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      {/* Weather & Thermal Stress HR Drift Simulator Panel */}
      <Panel
        title="🌡️ Thermal Stress & Weather Drift Simulator"
        subtitle="จำลองผลกระทบของอุณหภูมิและความชื้นต่อการไหลของหัวใจ (HR Drift) และเพซประหยัดพลังงาน"
        className="span-12"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Thermometer size={15} color="#b0593f" /> อุณหภูมิคาดการณ์ (°C):
                </label>
                <span style={{ fontSize: "0.88rem", fontWeight: 750, color: temperature >= 30 ? "#9d1c37" : "var(--color-ink)" }}>
                  {temperature}°C
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={38}
                step={1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <SunMedium size={15} color="var(--color-blue)" /> ความชื้นสัมพัทธ์ (%):
                </label>
                <span style={{ fontSize: "0.88rem", fontWeight: 750, color: "var(--color-ink)" }}>
                  {humidity}%
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={95}
                step={5}
                value={humidity}
                onChange={(e) => setHumidity(Number(e.target.value))}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
          </div>

          {/* Results Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--color-line-soft)" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>คาดการณ์ HR Drift เพิ่มขึ้น</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 750, color: estimatedHrDrift > 6 ? "#9d1c37" : "var(--color-primary)", marginTop: 2 }}>
                +{estimatedHrDrift} bpm
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 2 }}>
                ความร้อนส่งผลให้หัวใจเต้นเร็วขึ้น
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--color-line-soft)" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>คำแนะนำปรับลด Pace</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 750, color: "var(--color-primary)", marginTop: 2 }}>
                +{recommendedSlowdownSec} วินาที/km
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 2 }}>
                เพซชดเชยเพื่อคุม HR Z2
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--color-line-soft)" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>เพซปรับปรุงตามสภาพอากาศ</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 750, color: "var(--color-ink)", marginTop: 2 }}>
                {pace(avgPaceSec + recommendedSlowdownSec)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 2 }}>
                จากเพซเป้าหมายเดิม {pace(avgPaceSec)}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius)",
              background: temperature >= 30 ? "#faf6ec" : "#f4f8f5",
              border: `1px solid ${temperature >= 30 ? "#eed28b" : "#add9c9"}`,
              fontSize: "0.84rem",
              lineHeight: 1.6,
              color: "var(--color-ink)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <Flame size={20} color={temperature >= 30 ? "#7a5300" : "#1a6847"} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>คำแนะนำด้านสภาพอากาศ:</strong>{" "}
              {temperature >= 30
                ? `อากาศร้อน (${temperature}°C ความชื้น ${humidity}%) ควรจิบน้ำและเกลือแร่ทุกๆ 15-20 นาที หาก HR พุ่งแตะ Z3 ให้ผ่อนเพซลงทันทีเพื่อป้องกันภาวะ Heat Fatigue`
                : `สภาพอากาศอยู่ในเกณฑ์ดี (${temperature}°C ความชื้น ${humidity}%) รักษาจังหวะการหายใจและการจิบน้ำตามแผนปกติได้เลย`}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
