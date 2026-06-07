import { Activity, Brain, Footprints, Gauge, ShieldCheck, Trophy } from "lucide-react";
import { Panel } from "./Panel";

const features = [
  {
    title: "ศูนย์พร้อมซ้อม",
    detail: "รวมค่าฟื้นตัว การนอน HRV ชีพจรพัก และอัตราโหลด เพื่อบอกว่าวันนี้ควรซ้อมแค่ไหน",
    icon: ShieldCheck,
  },
  {
    title: "โหลดการซ้อม",
    detail: "ดูระยะรายสัปดาห์ วิ่งยาว ซ้อมคุณภาพ และสัญญาณเพิ่มโหลดเร็วเกินไป",
    icon: Activity,
  },
  {
    title: "ฐานแอโรบิกโซน 2",
    detail: "ติดตามสัดส่วน Z2 การไหลของหัวใจ การหลุดแอโรบิก และเพซ เพื่อให้ฐานแอโรบิกโตแบบวัดผลได้",
    icon: Gauge,
  },
  {
    title: "ความพร้อมวันแข่ง",
    detail: "คาดการณ์ 10K จากผลซ้อมจริง เทียบเป้า เวลาตัดตัว และช่องว่างที่ต้องปิดก่อนวันแข่ง",
    icon: Trophy,
  },
  {
    title: "แนวโน้มฟื้นตัว",
    detail: "ดู HRV คะแนนการนอน และชีพจรพักเป็นแนวโน้ม เพื่อจับความล้าก่อนเจ็บหรือหลุดแผน",
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
