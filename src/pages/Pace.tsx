import { useState } from "react";
import { Panel } from "../components/Panel";
import type { DashboardData } from "../types";

function parsePace(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

function fmtPace(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtRange(a: number, b: number): string {
  return `${fmtPace(Math.min(a, b))}–${fmtPace(Math.max(a, b))}/km`;
}

const RANGE: React.CSSProperties = { color: "var(--color-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" };
const USE: React.CSSProperties = { fontSize: 13, color: "var(--color-muted)" };
const INPUT_LABEL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--color-muted)" };

export function Pace({ data }: { data: DashboardData }) {
  // ค่าตั้งต้นจาก profile (profile.md) — แก้ในช่องได้ถ้าต้องการ
  const PROFILE = { hrMax: 193, restHr: 60, thresholdSec: 7 * 60 + 34 };

  const prefThreshold = data.race?.coros_threshold_pace_sec_per_km ?? PROFILE.thresholdSec;

  const [thresholdStr, setThresholdStr] = useState(fmtPace(prefThreshold));
  const [maxHr, setMaxHr] = useState(String(PROFILE.hrMax));
  const [restHr, setRestHr] = useState(String(PROFILE.restHr));

  const tPace = parsePace(thresholdStr);
  const paceZones =
    tPace == null
      ? null
      : [
          { name: "Recovery", range: fmtRange(tPace + 90, tPace + 120), use: "ฟื้นตัว วันหลังซ้อมหนัก" },
          { name: "Easy / Z2", range: fmtRange(tPace + 60, tPace + 90), use: "สร้างฐาน aerobic วิ่งสบาย" },
          { name: "Long run", range: fmtRange(tPace + 45, tPace + 75), use: "วิ่งยาว" },
          { name: "Steady", range: fmtRange(tPace + 20, tPace + 35), use: "marathon effort" },
          { name: "Threshold", range: fmtRange(tPace - 5, tPace + 8), use: "tempo / LT (ฐานหลัก)" },
          { name: "Interval (VO2)", range: fmtRange(tPace - 22, tPace - 12), use: "interval 3–5 นาที" },
          { name: "Rep / strides", range: fmtRange(tPace - 40, tPace - 28), use: "strides, reps สั้น" },
        ];

  const maxHrN = Number(maxHr);
  const restHrN = restHr.trim() === "" ? null : Number(restHr);
  const useKarvonen = restHrN != null && Number.isFinite(restHrN) && restHrN > 0;
  const hrAt = (pct: number) =>
    useKarvonen ? Math.round((restHrN as number) + (maxHrN - (restHrN as number)) * pct) : Math.round(maxHrN * pct);
  const hrValid = Number.isFinite(maxHrN) && maxHrN > 0;
  const hrZones = !hrValid
    ? null
    : [
        { name: "Z1", range: `${hrAt(0.5)}–${hrAt(0.6)} bpm`, use: "ฟื้นตัว" },
        { name: "Z2", range: `${hrAt(0.6)}–${hrAt(0.7)} bpm`, use: "aerobic base (ฐานหลัก)" },
        { name: "Z3", range: `${hrAt(0.7)}–${hrAt(0.8)} bpm`, use: "steady / tempo เบา" },
        { name: "Z4", range: `${hrAt(0.8)}–${hrAt(0.9)} bpm`, use: "threshold" },
        { name: "Z5", range: `${hrAt(0.9)}–${hrAt(1)} bpm`, use: "VO2max" },
      ];

  return (
    <section className="page-stack">
      <Panel
        title="คาลิเบรต → โซนเพซ & HR"
        subtitle="กรอกค่าอ้างอิงเพื่อคำนวณโซนซ้อมของตัวเอง (ค่าเริ่มต้นดึงจากข้อมูลล่าสุด)"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          <label style={INPUT_LABEL}>
            Threshold pace (mm:ss /km)
            <input value={thresholdStr} onChange={(e) => setThresholdStr(e.target.value)} placeholder="8:45" style={{ minHeight: 40 }} />
          </label>
          <label style={INPUT_LABEL}>
            Max HR (bpm)
            <input type="number" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} style={{ minHeight: 40 }} />
          </label>
          <label style={INPUT_LABEL}>
            Resting HR (ถ้ามี)
            <input type="number" value={restHr} onChange={(e) => setRestHr(e.target.value)} placeholder="ไม่บังคับ" style={{ minHeight: 40 }} />
          </label>
        </div>
        <p className="chart-note" style={{ marginTop: 10 }}>
          วิธี HR zone: {useKarvonen ? "Karvonen (ใช้ Resting + Max HR)" : "% ของ Max HR"} · Threshold pace ≈ เพซที่วิ่งได้ราว 1 ชม. เต็มที่
        </p>
      </Panel>

      <div className="content-grid">
        <Panel
          title="โซนเพซ (pace zones)"
          subtitle={tPace == null ? "กรอก threshold pace รูปแบบ mm:ss" : `อิง threshold ${fmtPace(tPace)}/km`}
          className="span-6"
        >
          {paceZones == null ? (
            <p className="chart-note">กรอก threshold pace ให้ถูกรูปแบบก่อน เช่น 8:45</p>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {paceZones.map((z) => (
                <div key={z.name} className="pace-row">
                  <strong style={{ fontSize: 14 }}>{z.name}</strong>
                  <span style={RANGE}>{z.range}</span>
                  <span className="pace-use" style={USE}>{z.use}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="โซนหัวใจ (HR zones)"
          subtitle={hrValid ? (useKarvonen ? "Karvonen (HRR)" : "% Max HR") : "กรอก Max HR"}
          className="span-6"
        >
          {hrZones == null ? (
            <p className="chart-note">กรอก Max HR เป็นตัวเลขก่อน</p>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {hrZones.map((z) => (
                <div key={z.name} className="pace-row">
                  <strong style={{ fontSize: 14 }}>{z.name}</strong>
                  <span style={RANGE}>{z.range}</span>
                  <span className="pace-use" style={USE}>{z.use}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="🎯 Calibration test 17 มิ.ย." subtitle="วิธีใช้ผลทดสอบมา calibrate" className="span-12">
          <ul className="clean-list">
            <li>วิ่ง 3K controlled ที่ 8:30–9:00/km แล้วจด <b>pace เฉลี่ย + HR เฉลี่ย</b> ของช่วง 3K</li>
            <li>ถ้า HR เฉลี่ยตกในช่วง Z2–Z3 ด้านบน แปลว่าเพซ easy ที่ตั้งไว้เหมาะแล้ว</li>
            <li>ถ้า HR พุ่งเข้า Z4 ที่เพซนี้ → ฐาน aerobic ยังบาง ให้วิ่ง easy ช้าลง</li>
            <li>เมื่อมีผล threshold ที่แม่นขึ้น (เช่นจาก 5K test) เอามากรอกช่อง threshold เพื่ออัปเดตโซน</li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}
