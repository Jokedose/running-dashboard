import { useState } from "react";
import { Activity, AlertCircle, Clock3, Gauge, Timer, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { RunLaps } from "../components/RunLaps";
import type { DashboardData, RunLog, SessionCriteria } from "../types";
import { evaluateRun, type RunEvaluation } from "../utils/evaluate";
import { km, minutes, pace, percent, sessionLabel } from "../utils/format";
import { painLevel } from "../utils/session";
import { thaiText } from "../utils/thaiText";

// verdict จาก evaluateRun (เกณฑ์ session_criteria ใน db) → icon + label + สี
function verdictBadge(evaluation: RunEvaluation | null): { icon: string; label: string; bg: string; color: string } | null {
  if (!evaluation || evaluation.verdict === "unknown") return null;
  if (evaluation.verdict === "pass") return { icon: "✅", label: "ผ่านเกณฑ์", bg: "#d8eee5", color: "#1a6847" };
  if (evaluation.verdict === "warn") return { icon: "⚠️", label: "หลุด 1 ข้อ", bg: "#fef9ec", color: "#7a5300" };
  return { icon: "⛔", label: "หลุดหลายข้อ", bg: "#fee2e8", color: "#9d1c37" };
}

function painColor(level: ReturnType<typeof painLevel>): string {
  switch (level) {
    case "high": return "#9d1c37";
    case "moderate": return "#c2410c";
    case "mild": return "#b45309";
    default: return "#d8eee5";
  }
}

function painText(level: ReturnType<typeof painLevel>): string {
  switch (level) {
    case "high": return "หนัก";
    case "moderate": return "ปานกลาง";
    case "mild": return "เบา";
    default: return "OK";
  }
}

function RunDetailModal({ run, criteria, onClose }: { run: RunLog; criteria: SessionCriteria[]; onClose: () => void }) {
  const zones = [
    { name: "Z1", value: run.z1_percent ?? 0, color: "#94a3b8" },
    { name: "Z2", value: run.z2_percent ?? 0, color: "#3aa99e" },
    { name: "Z3", value: run.z3_percent ?? 0, color: "#f59e0b" },
    { name: "Z4", value: run.z4_percent ?? 0, color: "#ef4444" },
    { name: "Z5", value: run.z5_percent ?? 0, color: "#7c3aed" },
  ];
  const hasZones = zones.some((z) => z.value > 0);
  const evaluation = evaluateRun(run, criteria);
  const badge = verdictBadge(evaluation);
  const failedKeys = new Set((evaluation?.checks ?? []).filter((c) => !c.ok).map((c) => c.key));
  const cadenceWarn = run.cadence_spm != null && run.cadence_spm < 168;
  const driftWarn = failedKeys.has("drift");
  const decouplingWarn = failedKeys.has("decoupling");

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="cal-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: "1rem" }}>{run.run_date}</strong>
            <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8" }}>
              {sessionLabel(run.session_type)}
            </span>
            {badge && (
              <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 4, background: badge.bg, color: badge.color }}>
                {badge.icon} {badge.label}
              </span>
            )}
            {run.shoe_slug && (
              <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 4, background: "#e0e7ff", color: "#4338ca" }}>
                {run.shoe_slug}
              </span>
            )}
          </div>
          <button className="cal-modal-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        <div className="cal-block" style={{ borderLeftColor: chartColors.primary }}>
          <span className="cal-block-title">📊 สรุป</span>
          <div className="cal-data-grid">
            <DataRow label="ระยะ" value={km(run.distance_km)} />
            <DataRow label="เวลา" value={minutes(run.duration_min)} />
            <DataRow label="เพซ" value={pace(run.pace_sec_per_km)} />
            <DataRow label="ชีพจรเฉลี่ย" value={`${run.avg_hr_bpm?.toFixed(0) ?? "-"} bpm`} />
            <DataRow label="ชีพจรสูงสุด" value={`${run.hr_max_bpm?.toFixed(0) ?? "-"} bpm`} />
            <DataRow label="RPE" value={thaiText(run.rpe)} />
          </div>
        </div>

        {hasZones && (
          <div className="cal-block" style={{ borderLeftColor: chartColors.primary }}>
            <span className="cal-block-title">💓 Heart Rate Zones</span>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={zones} margin={chartMargin} layout="vertical">
                <CartesianGrid {...chartGrid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} {...chartAxis} />
                <YAxis type="category" dataKey="name" {...chartAxis} width={32} />
                <ChartTooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "เวลา"]} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {zones.map((z) => <Cell key={z.name} fill={z.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", marginTop: 4 }}>
              Sweet spot: {percent(run.sweet_spot_percent)}
            </div>
          </div>
        )}

        <div className="cal-block" style={{ borderLeftColor: driftWarn || decouplingWarn ? "#c2410c" : chartColors.primary }}>
          <span className="cal-block-title">📈 คุณภาพ aerobic</span>
          <div className="cal-data-grid">
            <DataRow label="Drift" value={`${run.drift_bpm?.toFixed(1) ?? "-"} bpm${driftWarn ? " ⚠" : ""}`} />
            <DataRow label="Decoupling" value={`${percent(run.decoupling_percent)}${decouplingWarn ? " ⚠" : ""}`} />
            <DataRow label="Z2 main" value={`${percent(run.z2_percent)}${failedKeys.has("z2") ? " ⚠" : ""}`} />
          </div>
          {evaluation && evaluation.checks.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, fontSize: "0.75rem" }}>
              {evaluation.checks.map((check) => (
                <span
                  key={check.key}
                  style={{
                    padding: "2px 8px", borderRadius: 4,
                    background: check.ok ? "#d8eee5" : "#fee2e8",
                    color: check.ok ? "#1a6847" : "#9d1c37",
                  }}
                >
                  {check.ok ? "✓" : "✗"} {check.label}: {check.actual.toFixed(1)} / {check.limit}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="cal-block" style={{ borderLeftColor: cadenceWarn ? "#c2410c" : chartColors.primary }}>
          <span className="cal-block-title">🦵 Biomechanics</span>
          <div className="cal-data-grid">
            <DataRow label="Cadence" value={`${run.cadence_spm?.toFixed(0) ?? "-"} spm${cadenceWarn ? " ⚠ ต่ำกว่า 168" : ""}`} />
            <DataRow label="ความยาวก้าว" value={`${run.stride_cm?.toFixed(1) ?? "-"} cm`} />
            <DataRow label="เวลาสัมผัสพื้น" value={`${run.gct_ms?.toFixed(0) ?? "-"} ms`} />
            <DataRow label="Power" value={`${run.power_w?.toFixed(0) ?? "-"} w`} />
          </div>
        </div>

        <RunLaps laps={run.laps} />

        {(run.weather || run.temperature_c != null || run.humidity_percent != null) && (
          <div className="cal-block" style={{ borderLeftColor: "#5aa9e6" }}>
            <span className="cal-block-title">🌤 Environment</span>
            <div className="cal-data-grid">
              {run.weather && <DataRow label="อากาศ" value={thaiText(run.weather)} />}
              {run.temperature_c != null && <DataRow label="อุณหภูมิ" value={`${run.temperature_c}°C`} />}
              {run.humidity_percent != null && <DataRow label="ความชื้น" value={`${run.humidity_percent}%`} />}
            </div>
          </div>
        )}

        {(run.pain || run.note) && (
          <div className="cal-block" style={{ borderLeftColor: "#eed28b", background: "#fef9ec" }}>
            <span className="cal-block-title">📝 Subjective</span>
            {run.pain && <div className="cal-note-line"><b>Pain:</b> {thaiText(run.pain)}</div>}
            {run.note && <div className="cal-note-line"><b>Note:</b> {thaiText(run.note)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
      <span style={{ color: "var(--color-muted)", fontSize: "0.75rem", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 650, color: "var(--color-ink)" }}>{value}</span>
    </div>
  );
}

export function Activities({ data }: { data: DashboardData }) {
  const [selectedRun, setSelectedRun] = useState<RunLog | null>(null);
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const totalDuration = data.runs.reduce((sum, run) => sum + (run.duration_min ?? 0), 0);
  const avgPaceSeconds = totalDistance > 0 && totalDuration > 0 ? (totalDuration * 60) / totalDistance : null;
  const totalActivities = data.runs.length;
  const recentPain = data.runs.slice(-30).map((run: RunLog) => ({
    date: run.run_date,
    level: painLevel(run.pain),
    pain: run.pain,
    session: run.session_type,
  }));
  const painCount = recentPain.filter((p) => p.level !== "none").length;

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="กิจกรรมทั้งหมด" value={String(totalActivities)} detail="รายการที่บันทึกไว้" icon={Activity} />
        <MetricCard label="เวลารวมทั้งหมด" value={minutes(totalDuration || null)} detail="รวมเวลาที่ใช้ทุกกิจกรรม" icon={Timer} tone="good" />
        <MetricCard label="ระยะรวม" value={km(totalDistance || null)} detail="รวมจากบันทึกวิ่งทั้งหมด" icon={Gauge} />
        <MetricCard label="เพซเฉลี่ยรวม" value={pace(avgPaceSeconds)} detail="คำนวณจากเวลารวมและระยะรวม" icon={Clock3} />
      </div>

      <Panel title="Pain / soreness timeline" subtitle={`30 ครั้งล่าสุด · มีอาการ ${painCount} ครั้ง`}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {recentPain.map((p) => (
            <div key={p.date} title={`${p.date} · ${p.session ?? ""} · ${p.pain ?? "ไม่มี"}`}
              style={{
                width: 24, height: 24, borderRadius: 5,
                background: painColor(p.level),
                border: "1px solid var(--color-line-soft)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {p.level !== "none" && <AlertCircle size={12} color="#fff" />}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: "0.75rem", color: "var(--color-muted)" }}>
          {(["none", "mild", "moderate", "high"] as const).map((lvl) => (
            <span key={lvl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: painColor(lvl), display: "inline-block" }} />
              {painText(lvl)}
            </span>
          ))}
        </div>
      </Panel>

      {/* มือถือ (≤620px): card list แทนตาราง 11 คอลัมน์ — แตะเปิด modal เดิม */}
      <div className="activities-cards">
        {[...data.runs].reverse().map((run) => {
          const badge = verdictBadge(evaluateRun(run, data.criteria));
          return (
            <button key={run.id} className="activity-card" onClick={() => setSelectedRun(run)} type="button">
              <div className="activity-card-top">
                <strong>{run.run_date}</strong>
                <span className="activity-card-type">{sessionLabel(run.session_type)}</span>
                {badge && (
                  <span style={{ background: badge.bg, color: badge.color, borderRadius: 4, padding: "1px 7px", fontSize: "0.75rem" }}>
                    {badge.icon} {badge.label}
                  </span>
                )}
              </div>
              <div className="activity-card-metrics">
                <span>{km(run.distance_km)}</span>
                <span>{pace(run.pace_sec_per_km)}</span>
                <span>{run.avg_hr_bpm == null ? "-" : `${run.avg_hr_bpm.toFixed(0)} bpm`}</span>
                <span>Z2 {percent(run.z2_percent)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="table-panel activities-table">
        <div className="panel-head">
          <div>
            <h2>บันทึกกิจกรรม</h2>
            <p>รายการวิ่งล่าสุด เรียงจากใหม่ไปเก่า พร้อมเวลาที่ใช้แต่ละครั้ง</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ประเภท</th>
                <th>เกณฑ์</th>
                <th>ระยะ</th>
                <th>เวลา</th>
                <th>เพซ</th>
                <th>ชีพจร</th>
                <th>Z2</th>
                <th>การไหล</th>
                <th>Cadence</th>
                <th>รองเท้า</th>
              </tr>
            </thead>
            <tbody>
              {[...data.runs].reverse().map((run) => (
                <tr key={run.id} onClick={() => setSelectedRun(run)} style={{ cursor: "pointer" }}>
                  <td>{run.run_date}</td>
                  <td>{sessionLabel(run.session_type)}</td>
                  <td title={verdictBadge(evaluateRun(run, data.criteria))?.label}>
                    {verdictBadge(evaluateRun(run, data.criteria))?.icon ?? "–"}
                  </td>
                  <td>{km(run.distance_km)}</td>
                  <td>{minutes(run.duration_min)}</td>
                  <td>{pace(run.pace_sec_per_km)}</td>
                  <td>{run.avg_hr_bpm?.toFixed(1) ?? "-"} bpm</td>
                  <td>{percent(run.z2_percent)}</td>
                  <td>{run.drift_bpm?.toFixed(1) ?? "-"} bpm</td>
                  <td style={{ color: run.cadence_spm != null && run.cadence_spm < 168 ? "#c2410c" : undefined }}>
                    {run.cadence_spm?.toFixed(0) ?? "-"} spm
                  </td>
                  <td>{thaiText(run.shoe_slug)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRun && <RunDetailModal run={selectedRun} criteria={data.criteria} onClose={() => setSelectedRun(null)} />}
    </section>
  );
}
