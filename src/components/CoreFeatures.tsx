import { Activity, Brain, Footprints, Gauge, ShieldCheck, Trophy } from "lucide-react";
import { Panel } from "./Panel";

const features = [
  {
    title: "ศูนย์พร้อมซ้อม",
    detail: "รวม recovery, sleep, HRV, RHR และ load ratio เป็นคำตอบว่าวันนี้ควรซ้อมแค่ไหน",
    icon: ShieldCheck,
  },
  {
    title: "โหลดการซ้อม",
    detail: "ดู volume รายสัปดาห์, long run, quality run และสัญญาณเพิ่มโหลดเร็วเกินไป",
    icon: Activity,
  },
  {
    title: "ฐานแอโรบิก Zone 2",
    detail: "ติดตาม Z2 %, drift, decoupling และ pace เพื่อให้ aerobic base โตแบบวัดผลได้",
    icon: Gauge,
  },
  {
    title: "ความพร้อมวันแข่ง",
    detail: "คาดการณ์ 10K จากผลซ้อมจริง เทียบเป้า เวลา cutoff และ gap ที่ต้องปิดก่อนวันแข่ง",
    icon: Trophy,
  },
  {
    title: "แนวโน้มฟื้นตัว",
    detail: "ดู HRV, sleep score และ resting HR เป็น trend เพื่อจับ fatigue ก่อนเจ็บหรือหลุดแผน",
    icon: Brain,
  },
  {
    title: "รอบใช้งานรองเท้า",
    detail: "คุมระยะรองเท้า บทบาทของแต่ละคู่ และสัญญาณใกล้ถึงรอบเปลี่ยน",
    icon: Footprints,
  },
];

export function CoreFeatures() {
  return (
    <Panel title="ฟีเจอร์หลัก" subtitle="แกนหลักที่แดชบอร์ดควรตอบให้ได้ทุกสัปดาห์" className="span-12">
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
