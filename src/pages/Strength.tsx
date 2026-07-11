import { useEffect, useState } from "react";
import { CalendarCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { Panel } from "../components/Panel";
import { KB_GROUP_LABEL, kbExercises, kbRoutine, type KbGroup } from "../data/kbExercises";

const GROUPS: KbGroup[] = ["power", "upper", "core", "stability"];
const framesByName = new Map(kbExercises.map((e) => [e.name, e.frames]));
const safeByName = new Map(kbExercises.map((e) => [e.name, e.injurySafe]));

// สลับ 2 เฟรม (start/end) แทน gif เคลื่อนไหว
function FlipImage({ frames, alt, className, onClick }: { frames: [string, string]; alt: string; className?: string; onClick?: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v === 0 ? 1 : 0)), 700);
    return () => clearInterval(id);
  }, []);
  return <img src={frames[i]} alt={alt} loading="lazy" className={className} onClick={onClick} />;
}

export function Strength() {
  const [safeOnly, setSafeOnly] = useState(true);
  const [zoom, setZoom] = useState<{ frames: [string, string]; name: string } | null>(null);
  const todayWeekday = new Date().getDay(); // 0=อา 1=จ ...

  const list = safeOnly ? kbExercises.filter((e) => e.injurySafe) : kbExercises;

  return (
    <section className="page-stack">
      {zoom && (
        <div className="kb-lightbox" role="dialog" aria-label={zoom.name} onClick={() => setZoom(null)}>
          <div className="kb-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="kb-lightbox-close" onClick={() => setZoom(null)} aria-label="ปิด" type="button">✕</button>
            <FlipImage frames={zoom.frames} alt={zoom.name} className="kb-lightbox-gif" />
            <strong className="kb-lightbox-name">{zoom.name}</strong>
          </div>
        </div>
      )}
      <Panel
        title="Kettlebell (8kg) — daily plan + exercises"
        subtitle="แผน KB แต่ละวัน + คลังท่า (gif) · injury-safe = ทำได้ช่วงขาเจ็บ"
      >
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
          คลังท่า: แสดงเฉพาะที่ปลอดภัยช่วงขาเจ็บ (ซ่อนท่าลงขากระแทก)
        </label>
        <p className="chart-note" style={{ marginTop: 8 }}>
          🩹 ช่วงฟื้น shin: เลี่ยง thruster / pistol / lunge — เน้น press, row, swing, TGU, goblet
        </p>
      </Panel>

      {/* ตาราง KB รายวัน */}
      <div className="content-grid">
        {kbRoutine.map((d) => {
          const isToday = d.weekday === todayWeekday;
          return (
            <Panel
              key={d.weekday}
              title={`${d.day} · ${d.label}`}
              subtitle={isToday ? "📌 วันนี้" : `${d.items.length} ท่า`}
              className="span-6"
            >
              <div className={`kb-day${isToday ? " today" : ""}`}>
                {d.items.map((it, i) => {
                  const safe = safeByName.get(it.name);
                  return (
                    <div className="kb-day-row" key={`${it.name}-${i}`}>
                      <FlipImage frames={framesByName.get(it.name) ?? ["", ""]} alt={it.name} className="kb-day-thumb" onClick={() => setZoom({ frames: framesByName.get(it.name) ?? ["", ""], name: it.name })} />
                      <span className="kb-day-name">
                        {it.name}
                        {safe === false && <TriangleAlert size={12} style={{ marginLeft: 4, verticalAlign: "-1px", color: "#9d1c37" }} />}
                      </span>
                      <strong className="kb-day-sets">{it.sets}</strong>
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* คลังท่าทั้งหมด */}
      {GROUPS.map((g) => {
        const items = list.filter((e) => e.group === g);
        if (!items.length) return null;
        return (
          <Panel key={g} title={`Exercise library · ${KB_GROUP_LABEL[g]}`} subtitle={`${items.length} ท่า`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {items.map((ex) => (
                <div key={ex.name} className="kb-card">
                  <FlipImage frames={ex.frames} alt={ex.name} className="kb-gif" onClick={() => setZoom({ frames: ex.frames, name: ex.name })} />
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
