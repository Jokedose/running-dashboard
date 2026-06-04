import { Activity, Brain, Footprints, Gauge, ShieldCheck, Trophy } from "lucide-react";
import { Panel } from "./Panel";

const features = [
  {
    title: "Readiness cockpit",
    detail: "รวม recovery, sleep, HRV, RHR และ load ratio เป็นคำตอบว่าวันนี้ควรซ้อมแค่ไหน",
    icon: ShieldCheck,
  },
  {
    title: "Training load",
    detail: "ดู volume รายสัปดาห์, long run, quality run และสัญญาณเพิ่มโหลดเร็วเกินไป",
    icon: Activity,
  },
  {
    title: "Zone 2 engine",
    detail: "ติดตาม Z2 %, drift, decoupling และ pace เพื่อให้ aerobic base โตแบบวัดผลได้",
    icon: Gauge,
  },
  {
    title: "Race readiness",
    detail: "คาดการณ์ 10K จากผลซ้อมจริง เทียบเป้า เวลา cutoff และ gap ที่ต้องปิดก่อนวันแข่ง",
    icon: Trophy,
  },
  {
    title: "Recovery trend",
    detail: "ดู HRV, sleep score และ resting HR เป็น trend เพื่อจับ fatigue ก่อนเจ็บหรือหลุดแผน",
    icon: Brain,
  },
  {
    title: "Gear rotation",
    detail: "คุมระยะรองเท้า บทบาทของแต่ละคู่ และสัญญาณใกล้ถึงรอบเปลี่ยน",
    icon: Footprints,
  },
];

export function CoreFeatures() {
  return (
    <Panel title="Core features" subtitle="แกนหลักที่ dashboard ควรตอบให้ได้ทุกสัปดาห์" className="span-12">
      <div className="feature-grid">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article className="feature-card" key={feature.title}>
              <Icon size={20} />
              <strong>{feature.title}</strong>
              <p>{feature.detail}</p>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
