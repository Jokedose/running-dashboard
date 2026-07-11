import { Activity, AlertTriangle, CalendarCheck, HeartPulse, MapPin, ShieldAlert } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import type { DashboardData, InjuryStatus } from "../types";
import { shortDate } from "../utils/format";
import { painLevel, type PainLevel } from "../utils/session";

type Tone = "good" | "warn" | "hot" | "neutral";

// tone ตามสถานะ injury_status: OPEN=hot, HEALING=warn, CLOSED=good
function statusTone(status: string): Tone {
  const s = status.toUpperCase();
  if (s === "OPEN") return "hot";
  if (s === "HEALING") return "warn";
  if (s === "CLOSED") return "good";
  return "neutral";
}

const STATUS_LABEL: Record<string, string> = { OPEN: "กำลังเจ็บ", HEALING: "กำลังฟื้น", CLOSED: "หายแล้ว" };

function ActiveInjuryPanel({ injury }: { injury: InjuryStatus }) {
  const tone = statusTone(injury.status);
  const label = STATUS_LABEL[injury.status.toUpperCase()] ?? injury.status;
  const days = injury.last_symptom_date ? daysSince(injury.last_symptom_date) : null;
  const rows: { icon: typeof HeartPulse; text: string | null; tag: string }[] = [
    { icon: Activity, text: injury.trend, tag: "แนวโน้ม" },
    { icon: HeartPulse, text: injury.care, tag: "ดูแล" },
    { icon: ShieldAlert, text: injury.current_rule, tag: "กติกาวิ่ง" },
  ];
  return (
    <Panel
      title={`🩹 ${injury.title ?? injury.injury_slug}`}
      subtitle={`สถานะจาก injury_status · อัปเดต ${injury.last_updated_date ? shortDate(injury.last_updated_date) : "-"}`}
      className="span-12"
      action={<strong className={tone}>{label}</strong>}
    >
      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <MetricCard
          label="สถานะ"
          value={label}
          detail={injury.status.toUpperCase()}
          icon={ShieldAlert}
          tone={tone}
        />
        <MetricCard
          label="เจ็บล่าสุด"
          value={days == null ? "ไม่ระบุ" : `${days} วันก่อน`}
          detail={injury.last_symptom_date ? shortDate(injury.last_symptom_date) : "ไม่มีวันที่"}
          icon={CalendarCheck}
          tone={days == null ? "neutral" : days >= 14 ? "good" : days >= 5 ? "warn" : "hot"}
        />
      </div>
      <div className="signal-list">
        {rows.filter((r) => r.text).map((r) => (
          <div key={r.tag}>
            <r.icon size={16} />
            <span>{r.text}</span>
            <strong>{r.tag}</strong>
          </div>
        ))}
        {injury.tags?.length ? (
          <div>
            <MapPin size={16} />
            <span>{injury.tags.join(" · ")}</span>
            <strong>tags</strong>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

// แยกจุดที่เจ็บจาก free-text pain note (Thai keywords)
const BODY_PARTS: { key: string; label: string; match: RegExp }[] = [
  { key: "shin", label: "หน้าแข้ง", match: /หน้าแข้ง|แข้ง|shin/i },
  { key: "calf", label: "น่อง", match: /น่อง|calf/i },
  { key: "knee", label: "เข่า", match: /เข่า|knee/i },
  { key: "ankle", label: "ข้อเท้า", match: /ข้อเท้า|ankle/i },
  { key: "heel", label: "ส้นเท้า", match: /ส้น|heel|plantar/i },
  { key: "hip", label: "สะโพก", match: /สะโพก|hip|it band|itb/i },
  { key: "thigh", label: "ต้นขา", match: /ต้นขา|quad|hamstring|แฮม/i },
  { key: "foot", label: "เท้า", match: /ฝ่าเท้า|เท้า|foot/i },
];

function sideOf(text: string): string {
  if (/ขวา|right/i.test(text)) return "ขวา";
  if (/ซ้าย|left/i.test(text)) return "ซ้าย";
  return "";
}

function partsOf(text: string): string[] {
  const side = sideOf(text);
  const hits = BODY_PARTS.filter((p) => p.match.test(text)).map((p) => (side ? `${p.label}${side}` : p.label));
  return hits.length ? hits : [side ? `ขา${side}` : "ไม่ระบุจุด"];
}

const LEVEL_LABEL: Record<PainLevel, string> = { none: "ไม่มี", mild: "เล็กน้อย", moderate: "ปานกลาง", high: "สูง" };
const LEVEL_TONE: Record<PainLevel, "good" | "warn" | "hot" | "neutral"> = {
  none: "good", mild: "warn", moderate: "warn", high: "hot",
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(`${dateStr}T00:00:00`).getTime()) / 86400000);
}

export function Injury({ data }: { data: DashboardData }) {
  const niggles = data.runs
    .filter((r) => r.run_date && painLevel(r.pain) !== "none")
    .sort((a, b) => b.run_date.localeCompare(a.run_date));

  const lastNiggle = niggles[0] ?? null;
  const daysPainFree = lastNiggle ? daysSince(lastNiggle.run_date) : null;

  // ความถี่ตามจุด
  const partCount = new Map<string, number>();
  for (const r of niggles) for (const p of partsOf(r.pain ?? "")) partCount.set(p, (partCount.get(p) ?? 0) + 1);
  const partRanked = [...partCount.entries()].sort((a, b) => b[1] - a[1]);
  const topPart = partRanked[0] ?? null;
  const maxCount = partRanked[0]?.[1] ?? 1;

  // recurrence ใน 30 วันล่าสุด
  const recent30 = niggles.filter((r) => daysSince(r.run_date) <= 30);
  const recentTopPart = (() => {
    const m = new Map<string, number>();
    for (const r of recent30) for (const p of partsOf(r.pain ?? "")) m.set(p, (m.get(p) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  })();
  const recurrenceAlert = recentTopPart && recentTopPart[1] >= 2;

  const highCount = niggles.filter((r) => painLevel(r.pain) === "high").length;

  // source of truth: injury_status (open ก่อน). run_logs = supporting detail ด้านล่าง
  const openInjuries = data.injuries.filter((i) => i.is_open);

  return (
    <section className="page-stack">
      {openInjuries.length > 0 && (
        <div className="content-grid">
          {openInjuries.map((injury) => (
            <ActiveInjuryPanel key={injury.injury_slug} injury={injury} />
          ))}
        </div>
      )}

      <div className="metric-grid">
        <MetricCard
          label="ปลอดเจ็บล่าสุด"
          value={daysPainFree == null ? "ไม่มีบันทึก" : `${daysPainFree} วัน`}
          detail={lastNiggle ? `ล่าสุด ${shortDate(lastNiggle.run_date)}` : "ยังไม่มี pain note"}
          icon={CalendarCheck}
          tone={daysPainFree == null ? "good" : daysPainFree >= 14 ? "good" : daysPainFree >= 5 ? "warn" : "hot"}
        />
        <MetricCard
          label="บันทึกอาการเจ็บ"
          value={String(niggles.length)}
          detail={`ระดับสูง ${highCount} ครั้ง`}
          icon={Activity}
          tone={highCount ? "hot" : niggles.length ? "warn" : "good"}
        />
        <MetricCard
          label="จุดที่เจ็บบ่อยสุด"
          value={topPart ? topPart[0] : "-"}
          detail={topPart ? `${topPart[1]} ครั้ง` : "ไม่มี"}
          icon={MapPin}
          tone={topPart ? "warn" : "good"}
        />
        <MetricCard
          label="ซ้ำใน 30 วัน"
          value={recentTopPart ? `${recentTopPart[1]} ครั้ง` : "0"}
          detail={recentTopPart ? recentTopPart[0] : "ไม่มีอาการซ้ำ"}
          icon={AlertTriangle}
          tone={recurrenceAlert ? "hot" : recent30.length ? "warn" : "good"}
        />
      </div>

      {recurrenceAlert && (
        <div className="content-grid">
          <Panel title="⚠️ เตือน: อาการซ้ำ" subtitle="จุดเดิมเจ็บหลายครั้งในเดือนนี้" className="span-12">
            <div className="signal-list">
              <div>
                <AlertTriangle size={16} />
                <span>
                  <b>{recentTopPart![0]}</b> เจ็บ {recentTopPart![1]} ครั้งใน 30 วัน — ควรพบ physio + หา root cause ก่อนกลับซ้อมหนัก
                </span>
                <strong>physio</strong>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div className="content-grid">
        <Panel title="ไทม์ไลน์อาการเจ็บ" subtitle="จาก pain note ใน run log (ล่าสุดก่อน)" className="span-7">
          {niggles.length === 0 ? (
            <p className="chart-note">ยังไม่มีอาการเจ็บที่บันทึก — รักษาแบบนี้ไว้</p>
          ) : (
            <div className="signal-list">
              {niggles.slice(0, 12).map((r) => {
                const lvl = painLevel(r.pain);
                return (
                  <div key={r.id}>
                    <MapPin size={16} />
                    <span>
                      {shortDate(r.run_date)} · {partsOf(r.pain ?? "").join(", ")} — {r.pain}
                    </span>
                    <strong className={LEVEL_TONE[lvl]}>{LEVEL_LABEL[lvl]}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="จุดที่เจ็บ (ความถี่)" subtitle="รวมทุกบันทึก" className="span-5">
          {partRanked.length === 0 ? (
            <p className="chart-note">ยังไม่มีข้อมูล</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {partRanked.map(([part, count]) => (
                <div key={part} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{part}</span>
                    <span style={{ color: "var(--color-muted)" }}>{count} ครั้ง</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "var(--color-line)", overflow: "hidden" }}>
                    <div style={{ width: `${(count / maxCount) * 100}%`, height: "100%", background: "var(--color-primary)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="แนวทางกลับมาวิ่ง" subtitle="หลักกลับวิ่งหลังบาดเจ็บ" className="span-12">
          <ul className="clean-list">
            <li>กลับวิ่งเมื่อ <b>เดิน + กดจุดเจ็บไม่เจ็บ</b> เท่านั้น</li>
            <li>เริ่ม run/walk หรือ continuous easy สั้น (20-30 นาที) ดู onset pain</li>
            <li>เจ็บตั้งแต่แรก + ไม่ลดใน 5 นาที = หยุด</li>
            <li>ไม่เจ็บระหว่าง + วันถัดไป → เพิ่ม ≤10-15%</li>
            <li>เจ็บจุดเดิมซ้ำ 2 ครั้ง = พบ physio ก่อน</li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}
