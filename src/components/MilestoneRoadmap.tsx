import { useState } from "react";
import { CheckCircle2, Clock, Flag, Zap } from "lucide-react";
import { Panel } from "./Panel";
import { ProgressBar } from "./ProgressBar";
import type { DashboardData, RaceGoal, TrainingPhase } from "../types";
import { raceShortLabel } from "../utils/context";
import { raceTime } from "../utils/format";

export type MilestoneStatus = "done" | "in-progress" | "upcoming";

export type MilestoneItem = {
  id: string;
  phase: string;
  title: string;
  desc: string;
  targetDate: string;
  status: MilestoneStatus;
  metricBadge: string;
};

function phaseStatus(phase: TrainingPhase, today: string): MilestoneStatus {
  if (today > phase.end_date) return "done";
  if (today >= phase.start_date) return "in-progress";
  return "upcoming";
}

function phaseBadge(phase: TrainingPhase, status: MilestoneStatus): string {
  if (status === "done") return "✓ Completed";
  if (status === "in-progress") return "⚡ In progress";
  return `🔒 เริ่ม ${phase.start_date}`;
}

function raceMilestone(goal: RaceGoal, races: DashboardData["races"], phases: TrainingPhase[]): MilestoneItem {
  const result = races.find((r) => r.race_date === goal.race_date && r.result_time_min != null);
  const status: MilestoneStatus = result ? "done" : "upcoming";
  const badge = result ? `✓ Completed (${raceTime(result.result_time_min)})` : "🏁 Race day";
  const desc = goal.target_a_text
    ? `เป้า: ${goal.target_a_text}`
    : goal.target_b_text
    ? `เป้า: ${goal.target_b_text}`
    : "วันแข่งจริง";
  // จัดกลุ่ม pill ตาม phase ที่วันแข่งตกอยู่ในช่วง (ถ้ามี) ไม่งั้นเป็นกลุ่มของตัวเอง
  const containingPhase = phases.find((p) => goal.race_date >= p.start_date && goal.race_date <= p.end_date);
  return {
    id: `race-${goal.race_slug}`,
    phase: containingPhase?.phase_name ?? "Race day",
    title: raceShortLabel(goal) ?? goal.race_name ?? goal.race_slug,
    desc,
    targetDate: goal.race_date,
    status,
    metricBadge: badge,
  };
}

// สร้าง milestone list จาก training_phases + race_goals + races จริง (ไม่ fabricate
// วันที่/สถานะ) — แทนที่ DEFAULT_MILESTONES เดิมที่ hardcode ทั้งชุด
function buildMilestones(data: DashboardData, today: string): MilestoneItem[] {
  const phaseItems: MilestoneItem[] = data.phases.map((phase) => {
    const status = phaseStatus(phase, today);
    return {
      id: `phase-${phase.id}`,
      phase: phase.phase_name,
      title: phase.phase_name,
      desc: `${phase.start_date} – ${phase.end_date}`,
      targetDate: phase.end_date,
      status,
      metricBadge: phaseBadge(phase, status),
    };
  });
  const raceItems: MilestoneItem[] = data.raceGoals.map((goal) => raceMilestone(goal, data.races, data.phases));
  return [...phaseItems, ...raceItems].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

export function MilestoneRoadmap({ data, today }: { data: DashboardData; today: string }) {
  const initial = buildMilestones(data, today);
  const [milestones, setMilestones] = useState<MilestoneItem[]>(initial);
  const [selectedPhase, setSelectedPhase] = useState<string>("all");

  if (initial.length === 0) {
    return (
      <Panel title="🎯 Milestone Roadmap" subtitle="ยังไม่มีข้อมูล training phase หรือ race goal" className="span-12">
        <p className="chart-note">เพิ่มไฟล์ schedule/goal ใน running-results แล้ว sync เพื่อดูเส้นทางสู่วันแข่ง</p>
      </Panel>
    );
  }

  // ลำดับ pill ตามลำดับวันที่ปรากฏครั้งแรก แทนที่ list phase ตายตัวเดิม
  const phases = ["all", ...[...new Map(milestones.map((m) => [m.phase, m])).values()].map((m) => m.phase)];

  const filtered = selectedPhase === "all" ? milestones : milestones.filter((m) => m.phase === selectedPhase);
  const doneCount = milestones.filter((m) => m.status === "done").length;
  const nextRace = [...data.raceGoals].sort((a, b) => a.race_date.localeCompare(b.race_date)).find((g) => g.race_date >= today);
  const roadmapLabel = nextRace ? raceShortLabel(nextRace) ?? nextRace.race_name ?? "วันแข่ง" : "วันแข่ง";

  const toggleStatus = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextStatus: MilestoneStatus = m.status === "done" ? "upcoming" : m.status === "upcoming" ? "in-progress" : "done";
        return { ...m, status: nextStatus };
      })
    );
  };

  const progressPct = milestones.length ? (doneCount / milestones.length) * 100 : 0;
  const inProgressCount = milestones.filter((m) => m.status === "in-progress").length;

  return (
    <Panel
      title="🎯 Interactive Milestone Roadmap to Race Day"
      subtitle={`เส้นทางพัฒนาและเป้าหมายย่อยสู่ ${roadmapLabel}`}
      className="span-12"
    >
      <div style={{ display: "grid", gap: 20 }}>
        {/* Progress summary */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 16px",
            borderRadius: "var(--radius)",
            background: "var(--color-nav)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Flag size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <ProgressBar value={progressPct} label={`${doneCount}/${milestones.length} milestones สำเร็จแล้ว · ${progressPct.toFixed(0)}%`} />
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: "0.78rem", fontWeight: 650, whiteSpace: "nowrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#1a6847" }}>
              <CheckCircle2 size={14} /> {doneCount} เสร็จแล้ว
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#7a5300" }}>
              <Zap size={14} /> {inProgressCount} กำลังทำ
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--color-muted)" }}>
              <Clock size={14} /> {milestones.length - doneCount - inProgressCount} รออยู่
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {phases.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPhase(p)}
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                borderRadius: 20,
                border: selectedPhase === p ? "1px solid var(--color-primary)" : "1px solid var(--color-line)",
                font: "inherit",
                fontSize: "0.8rem",
                fontWeight: selectedPhase === p ? 750 : 600,
                cursor: "pointer",
                background: selectedPhase === p ? "var(--color-primary)" : "var(--color-panel)",
                color: selectedPhase === p ? "#ffffff" : "var(--color-ink)",
                transition: "all 0.15s ease",
              }}
            >
              {p === "all" ? "ทุก Phase" : p}
            </button>
          ))}
        </div>

        {/* Milestone Timeline */}
        <div style={{ position: "relative" }}>
          {/* connecting line */}
          <div
            style={{
              position: "absolute",
              left: 15,
              top: 8,
              bottom: 8,
              width: 2,
              background: "var(--color-line)",
            }}
          />
          <div style={{ display: "grid", gap: 6 }}>
            {filtered.map((item, idx) => {
              const isDone = item.status === "done";
              const isInProgress = item.status === "in-progress";
              const isLast = idx === filtered.length - 1;

              const dotColor = isDone ? "#1a6847" : isInProgress ? "#b8924c" : "var(--color-muted)";
              const dotBg = isDone ? "#d8eee5" : isInProgress ? "#fef3c7" : "var(--color-nav)";
              const cardBorder = isDone ? "#add9c9" : isInProgress ? "#eed28b" : "var(--color-line-soft)";

              return (
                <div
                  key={item.id}
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "32px 1fr",
                    gap: 12,
                    paddingBottom: isLast ? 0 : 14,
                  }}
                >
                  {/* Status dot */}
                  <button
                    type="button"
                    onClick={() => toggleStatus(item.id)}
                    title="คลิกเพื่อเปลี่ยนสถานะ (ดูตัวอย่างเท่านั้น ไม่บันทึกลง DB)"
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: dotBg,
                      border: `2px solid ${dotColor}`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      minHeight: "auto",
                      flexShrink: 0,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 color={dotColor} size={17} />
                    ) : isInProgress ? (
                      <Zap color={dotColor} size={17} />
                    ) : (
                      <Clock color={dotColor} size={17} />
                    )}
                  </button>

                  {/* Milestone Card */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: "10px 14px",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${cardBorder}`,
                      background: "var(--color-panel)",
                      opacity: item.status === "upcoming" ? 0.85 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.92rem", color: "var(--color-ink)" }}>{item.title}</strong>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "var(--color-nav)",
                            border: "1px solid var(--color-line)",
                            color: "var(--color-muted)",
                            fontWeight: 600,
                          }}
                        >
                          {item.phase}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 3 }}>{item.desc}</div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--color-ink)" }}>
                        {item.targetDate}
                      </div>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          fontSize: "0.72rem",
                          fontWeight: 750,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isDone ? "#d8eee5" : isInProgress ? "#fef3c7" : "var(--color-nav)",
                          border: `1px solid ${cardBorder}`,
                          color: dotColor,
                        }}
                      >
                        {item.metricBadge}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}
