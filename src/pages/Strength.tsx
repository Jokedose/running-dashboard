import { useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Panel } from "../components/Panel";
import { KB_GROUP_LABEL, kbExercises, type KbGroup } from "../data/kbExercises";

const GROUPS: KbGroup[] = ["power", "upper", "core", "stability"];

export function Strength() {
  const [safeOnly, setSafeOnly] = useState(true);

  const list = safeOnly ? kbExercises.filter((e) => e.injurySafe) : kbExercises;

  return (
    <section className="page-stack">
      <Panel
        title="Kettlebell (8kg) — ท่าซ้อม"
        subtitle="ท่าจาก ExerciseDB · gif แสดงท่า · injury-safe = ทำได้ช่วงขาเจ็บ (no-impact)"
      >
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
          แสดงเฉพาะท่าที่ปลอดภัยช่วงขาเจ็บ (ซ่อนท่าลงขากระแทก)
        </label>
        <p className="chart-note" style={{ marginTop: 8 }}>
          🩹 ช่วงฟื้น shin: เลี่ยง thruster / pistol / lunge (โหลดหน้าแข้ง) — เน้น press, row, swing, TGU, goblet
        </p>
      </Panel>

      {GROUPS.map((g) => {
        const items = list.filter((e) => e.group === g);
        if (!items.length) return null;
        return (
          <Panel key={g} title={KB_GROUP_LABEL[g]} subtitle={`${items.length} ท่า`} className="">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {items.map((ex) => (
                <div key={ex.name} className="kb-card">
                  <img src={ex.gif} alt={ex.name} loading="lazy" className="kb-gif" />
                  <div className="kb-card-body">
                    <div className="kb-card-head">
                      <strong>{ex.name}</strong>
                      {ex.injurySafe ? (
                        <span className="kb-badge good"><ShieldCheck size={12} /> safe</span>
                      ) : (
                        <span className="kb-badge hot"><TriangleAlert size={12} /> เลี่ยง</span>
                      )}
                    </div>
                    <span className="kb-target">{ex.target}</span>
                    <span className="kb-note">{ex.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </section>
  );
}
