import { useEffect, useRef } from "react";
import { Route } from "lucide-react";
import { Panel } from "./Panel";
import { ProgressBar } from "./ProgressBar";
import type { DashboardData } from "../types";
import type { TrainingContext } from "../utils/context";
import { shortDate } from "../utils/format";

/* ─────────────────────────────────────────────
   Phase strip — timeline ของ training_phases + จุดที่อยู่ตอนนี้
   ใช้ร่วมกันทั้งหน้า Today และหน้า Plan (หน้าหลัก)
   ───────────────────────────────────────────── */
export function PhaseStrip({ ctx, data }: { ctx: TrainingContext; data: DashboardData }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // มือถือ: strip เลื่อนแนวนอนได้ — เลื่อนให้ phase ปัจจุบันอยู่ในวิวเองตอนโหลด
  // ใช้ scrollLeft ของ container เองเท่านั้น ห้ามใช้ scrollIntoView ตรงๆ เพราะมันไล่ scroll
  // ทุก ancestor ที่ scroll ได้รวมถึง window ด้วย — ทำให้หน้าเด้งลงมาทับ scroll-to-top
  // ตอนเปลี่ยน route (useHashRoute รีเซ็ต scrollTop=0 แล้ว effect นี้มาไล่ทับทีหลัง)
  useEffect(() => {
    const container = listRef.current;
    const current = container?.querySelector<HTMLElement>('[data-current="true"]');
    if (!container || !current) return;
    const targetLeft = current.offsetLeft - container.clientWidth / 2 + current.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" });
  }, [ctx.phase?.id]);
  if (!data.phases.length) return null;
  const phases = [...data.phases].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <Panel
      title="Training phase"
      subtitle={
        ctx.currentRace
          ? `${ctx.currentRace.race_name ?? ctx.currentRace.race_slug} · ${ctx.daysToRace != null ? `อีก ${ctx.daysToRace} วัน` : ctx.currentRace.race_date}`
          : "ยังไม่มีแข่งถัดไปในแผน"
      }
      className="span-12"
      action={<Route size={18} />}
    >
      <div ref={listRef} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {phases.map((phase) => {
          const isCurrent = ctx.phase?.id === phase.id;
          const isPast = phase.end_date < ctx.today;
          return (
            <div
              key={phase.id}
              data-current={isCurrent || undefined}
              style={{
                minWidth: 132, flex: 1, padding: "10px 12px", borderRadius: 10,
                border: isCurrent ? "2px solid var(--color-primary)" : "1px solid var(--color-line)",
                background: isCurrent ? "rgba(79,138,120,0.10)" : "transparent",
                opacity: isPast && !isCurrent ? 0.55 : 1,
              }}
            >
              <div style={{ fontWeight: 650, fontSize: "0.82rem" }}>
                {isPast && !isCurrent ? "✓ " : ""}
                {phase.phase_name}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 2 }}>
                {shortDate(phase.start_date)} – {shortDate(phase.end_date)}
              </div>
              {isCurrent && (
                <div style={{ marginTop: 8 }}>
                  <ProgressBar value={ctx.phaseProgressPct} label={`คุณอยู่ตรงนี้ · ${ctx.phaseProgressPct.toFixed(0)}%`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
