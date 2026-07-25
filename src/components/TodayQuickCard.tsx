import { Activity, Footprints, Heart, Moon, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";
import type { DailyReadiness, RunnerProfile, SessionCriteria, TrainingPlan } from "../types";
import type { GateResult } from "../utils/evaluate";
import { criteriaFor } from "../utils/evaluate";
import { classifySession, getRecommendedShoe, type SessionKind } from "../utils/session";
import { thaiText } from "../utils/thaiText";

// HR ceiling ต่อ session kind — ใช้ session_criteria (quality) หรือ RunnerProfile
// (easy/recovery zone) จาก DB เป็นหลัก ตกไป default ทั่วไปเฉพาะไม่มีข้อมูลจริง
function hrCeilingText(kind: SessionKind, criteria: SessionCriteria[], profile: RunnerProfile | null): string {
  const isQuality = kind === "tempo" || kind === "vo2" || kind === "test" || kind === "race";
  if (isQuality) {
    const row = criteriaFor(kind, criteria);
    if (row?.hr_avg_max_bpm != null) return `HR เฉลี่ยไม่เกิน ${row.hr_avg_max_bpm} bpm`;
    return "คุม HR ตาม rep — อย่าฝืนเกิน Z4/Z5";
  }
  if (kind === "recovery" && profile?.easy_hr_min != null) {
    return `HR ${profile.easy_hr_min}-${profile.easy_hr_ceiling ?? profile.easy_hr_max ?? "-"} bpm (Recovery)`;
  }
  if (profile?.easy_hr_min != null && profile?.easy_hr_ceiling != null) {
    return `HR ${profile.easy_hr_min}-${profile.easy_hr_ceiling} bpm (Z2 Easy)`;
  }
  return "คุม HR ให้อยู่ Z2";
}

export function TodayQuickCard({
  todayPlan,
  todayReadiness,
  gate,
  profile,
  criteria,
}: {
  todayPlan: TrainingPlan | null;
  todayReadiness: DailyReadiness | null;
  gate: GateResult | null;
  profile: RunnerProfile | null;
  criteria: SessionCriteria[];
}) {
  const sessionTitle = todayPlan?.session_type ?? todayPlan?.title ?? "Rest / พักซ้อม";
  const kind = classifySession(sessionTitle);
  // รองเท้าจากแผนจริง (training_plan.planned_shoe) ก่อนเสมอ — ใช้ heuristic
  // เดาจาก session title เฉพาะตอนแผนวันนี้ยังไม่ระบุรองเท้า
  const fallbackShoe = getRecommendedShoe(sessionTitle);
  const isQualitySession = kind === "tempo" || kind === "vo2" || kind === "test" || kind === "race";
  const shoeInfo = todayPlan?.planned_shoe
    ? { name: todayPlan.planned_shoe, role: fallbackShoe.role, isQuality: isQualitySession }
    : fallbackShoe;

  const hrLimitText = hrCeilingText(kind, criteria, profile);

  const sleepHours = todayReadiness?.sleep_minutes == null ? null : todayReadiness.sleep_minutes / 60;
  const recoveryPct = todayReadiness?.recovery_percent ?? null;
  const isRestDay = sessionTitle.toLowerCase().includes("rest") || sessionTitle.toLowerCase().includes("พัก");

  // สถานะความพร้อม — จาก gate จริง (evaluateGate + readiness_gate_rules ที่ sync มา)
  // แทนเกณฑ์ sleep/recovery ที่เคย hardcode ซ้ำกับ default ของ evaluateGate เอง
  const readinessStatus =
    gate?.severity === "stop"
      ? { label: gate.decision ?? "หยุดพัก", icon: ShieldAlert, bg: "#fee2e8", border: "#efb4c3", text: "#9d1c37" }
      : gate?.severity === "caution"
      ? { label: gate.decision ?? "ระวัง — ปรับลดความหนัก", icon: ShieldAlert, bg: "#fef9ec", border: "#eed28b", text: "#7a5300" }
      : gate?.severity === "ok"
      ? { label: gate.decision ?? "พร้อมซ้อมตามแผน", icon: ShieldCheck, bg: "#d8eee5", border: "#add9c9", text: "#1a6847" }
      : { label: "ยังไม่มีข้อมูลความพร้อมวันนี้", icon: ShieldCheck, bg: "var(--color-primary-soft)", border: "#b8e4de", text: "var(--color-primary)" };

  const StatusIcon = readinessStatus.icon;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(79, 138, 120, 0.08) 0%, transparent 60%), var(--color-panel)",
        color: "var(--color-ink)",
        borderRadius: "var(--radius)",
        padding: "16px 20px",
        border: "1px solid var(--color-line)",
        display: "grid",
        gap: 14,
        marginBottom: 8,
      }}
    >
      {/* Top Header Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              border: "1px solid #add9c9",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: "0.75rem",
              fontWeight: 750,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              letterSpacing: "0.5px",
            }}
          >
            <Sparkles size={13} /> PWA QUICK VIEW · เช้านี้
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
            {new Date().toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>

        <div
          style={{
            background: readinessStatus.bg,
            border: `1px solid ${readinessStatus.border}`,
            color: readinessStatus.text,
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: "0.78rem",
            fontWeight: 750,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <StatusIcon size={14} /> {readinessStatus.label}
        </div>
      </div>

      {/* Main Quick View Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {/* Session Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            border: "1px solid var(--color-line-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: "0.78rem" }}>
            <Activity size={15} color="var(--color-primary)" /> 📋 Session วันนี้
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 750, marginTop: 4, color: isRestDay ? "var(--color-muted)" : "var(--color-ink)" }}>
            {thaiText(sessionTitle)}
          </div>
          {todayPlan?.target_distance_km && (
            <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", marginTop: 2 }}>
              เป้าหมาย: {todayPlan.target_distance_km} km ({todayPlan.target_duration_min ?? "-"} นาที)
            </div>
          )}
        </div>

        {/* HR Limit Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            border: "1px solid var(--color-line-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: "0.78rem" }}>
            <Heart size={15} color="#b0593f" /> 💓 HR Ceiling Target
          </div>
          <div style={{ fontSize: "1.02rem", fontWeight: 750, marginTop: 4, color: "#9d1c37" }}>
            {hrLimitText}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", marginTop: 2 }}>
            โซนปลอดภัย ป้องกันตึงขาสะสม
          </div>
        </div>

        {/* Recommended Shoe Card */}
        <div
          style={{
            background: shoeInfo.isQuality ? "#faf6ec" : "#ffffff",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            border: shoeInfo.isQuality ? "1px solid #eed28b" : "1px solid var(--color-line-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: "0.78rem" }}>
              <Footprints size={15} color={shoeInfo.isQuality ? "#b08642" : "var(--color-primary)"} /> 👟 รองเท้าแนะนำ
            </div>
            {shoeInfo.isQuality && (
              <span
                style={{
                  background: "#b08642",
                  color: "#ffffff",
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                SPEED / QUALITY
              </span>
            )}
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 750, marginTop: 4, color: shoeInfo.isQuality ? "#7a5300" : "var(--color-ink)" }}>
            {shoeInfo.name}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", marginTop: 2 }}>
            {shoeInfo.role}
          </div>
        </div>

        {/* Readiness Sleep & Recovery Snapshot */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            border: "1px solid var(--color-line-soft)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: "0.78rem" }}>
            <Moon size={15} color="#6f93b0" /> 🌙 การนอน & Recovery
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 750, color: "var(--color-ink)" }}>
              {sleepHours != null ? `${sleepHours.toFixed(1)} ชม.` : "-"}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--color-muted)" }}>
              Recovery: <strong style={{ color: "var(--color-primary)" }}>{recoveryPct != null ? `${recoveryPct}%` : "-"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
