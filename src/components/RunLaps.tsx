import type { RunLap } from "../types";
import { pace } from "../utils/format";

function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function dominantZone(lap: RunLap): { label: string; pct: number } {
  const pairs: Array<[string, number]> = [
    ["Z2", lap.z2],
    ["Z3", lap.z3],
    ["Z4", lap.z4],
    ["Z5", lap.z5],
    ["Z1", lap.z1],
  ];
  const [label, pct] = pairs.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return { label, pct };
}

const ZONE_COLOR: Record<string, string> = {
  Z1: "#94a3b8",
  Z2: "#3aa99e",
  Z3: "#f59e0b",
  Z4: "#ef4444",
  Z5: "#7c3aed",
};

/* ─────────────────────────────────────────────
   RunLaps — ราย lap จาก .fit (run_logs.laps) แบบ flex ต่อรอบ
   flexbox แทน table เพื่อไม่ให้ล้นจอมือถือ (คอลัมน์ตารางถูกดันหลุดขวา)
   สะท้อนโครงแผน: WU/main/CD, ต่อ rep, หรือ auto-lap ต่อ กม.
   รอบ work (Z4+Z5 ≥ 50%) เน้นพื้นหลัง + จุดสีส้ม
   ───────────────────────────────────────────── */
export function RunLaps({ laps, title = "Laps (ต่อรอบ)" }: { laps: RunLap[] | null | undefined; title?: string }) {
  if (!laps || laps.length === 0) return null;
  return (
    <div className="cal-block" style={{ borderLeftColor: "#6366f1" }}>
      <span className="cal-block-title">🔁 {title}</span>
      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", margin: "2px 0 8px" }}>
        จากปุ่ม lap / auto-lap ในนาฬิกา · รอบเน้นสี = หนัก (Z4+Z5 ≥ 50%)
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {laps.map((lap) => {
          const zone = dominantZone(lap);
          const isWork = lap.kind === "work";
          return (
            <div
              key={lap.i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 7,
                background: isWork ? "rgba(194,65,12,0.08)" : "var(--color-primary-soft)",
                fontSize: "0.8rem",
              }}
            >
              {/* รอบ + จุด work */}
              <span style={{ fontWeight: 700, minWidth: 26, flexShrink: 0 }}>
                {lap.i}
                {isWork && <span style={{ color: "#c2410c", marginLeft: 2, fontSize: "0.6rem", verticalAlign: "middle" }}>●</span>}
              </span>
              {/* pace เด่นสุด */}
              <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, minWidth: 62, flexShrink: 0 }}>
                {pace(lap.pace_s)}
              </span>
              {/* HR */}
              <span style={{ fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>
                ♥{lap.avg_hr ?? "-"}
                {lap.max_hr != null && <span style={{ color: "var(--color-muted)" }}>/{lap.max_hr}</span>}
              </span>
              {/* โซนหลัก — chip สี */}
              {zone.pct > 0 && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "0.7rem",
                    fontWeight: 650,
                    padding: "1px 7px",
                    borderRadius: 10,
                    color: "#fff",
                    background: ZONE_COLOR[zone.label] ?? "#64748b",
                  }}
                >
                  {zone.label} {zone.pct}%
                </span>
              )}
              {/* ระยะ·เวลา — เสริม ชิดขวา */}
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--color-muted)", fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>
                {lap.distance_km != null ? `${lap.distance_km.toFixed(2)}km · ` : ""}
                {clock(lap.elapsed_s)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
