// คลังท่า strength ของแผนจริง — ตรงกับ rules/kettlebell-core-strength.md ใน running-results
// (Session A/B/C/D/E) ไม่ใช่ตาราง KB รายวันแบบเก่า
//
// รูปท่าดึงจาก dataset yuhonas/free-exercise-db (Public Domain) — hotlink 2 เฟรม
// (start/end) สลับกันแสดงเป็น pseudo-animation แทน gif
// ท่าไหนที่ dataset ไม่มีรูป (Bird Dog, Clamshell, Wall Sit, Elevated Pike Push-up,
// KB Halo) frames = null แล้วการ์ดจะขึ้นเป็นกล่องข้อความแทน — ไม่ใส่รูปท่าอื่นมาแทน
// เพราะรูปผิดท่าอันตรายกว่าไม่มีรูป

export type MoveGroup = "core" | "push" | "pull" | "posterior" | "progression";

export type StrengthMove = {
  key: string;
  name: string;
  group: MoveGroup;
  target: string;
  cue: string;
  /** ทำได้ระหว่างหน้าแข้งขวาสถานะ OPEN หรือไม่ (ตาม rules/kettlebell-core-strength.md) */
  shinSafe: boolean;
  /** เหตุผลที่ต้องเลี่ยง/ระวัง — แสดงเมื่อ shinSafe = false */
  warn?: string;
  /** หมายเหตุเวลารูปในคลังไม่ตรงอุปกรณ์จริงของเรา (KB 8kg) */
  imageNote?: string;
  frames: [string, string] | null;
};

export const MOVE_GROUP_LABEL: Record<MoveGroup, string> = {
  core: "Core / anti-rotation",
  push: "Upper push (ดัน)",
  pull: "Upper pull (ดึง)",
  posterior: "Lower posterior chain (shin-safe)",
  progression: "ท่าเสริม — progression ในอนาคต",
};

const FEDB = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const frames = (dir: string): [string, string] => [`${FEDB}/${dir}/0.jpg`, `${FEDB}/${dir}/1.jpg`];

export const strengthMoves: StrengthMove[] = [
  // ---- Core ----
  {
    key: "plank",
    name: "Plank",
    group: "core",
    target: "Core / anti-extension",
    cue: "ศอกใต้ไหล่ · ก้นไม่ตก ไม่โด่ง · เกร็งก้นกับหน้าท้องพร้อมกัน หายใจปกติ",
    shinSafe: true,
    frames: frames("Plank"),
  },
  {
    key: "side-plank",
    name: "Side Plank (ซ้าย/ขวา)",
    group: "core",
    target: "Core ด้านข้าง / anti-rotation",
    cue: "ศอกใต้ไหล่ · สะโพกยกเป็นเส้นตรงจากหัวถึงส้นเท้า · อย่าให้สะโพกหล่นไปข้างหน้า",
    shinSafe: true,
    frames: frames("Side_Bridge"),
  },
  {
    key: "dead-bug",
    name: "Dead Bug",
    group: "core",
    target: "Core deep stabilizer (ปลอดภัยกับหลังล่าง)",
    cue: "หลังล่างแนบพื้นตลอด · ยืดแขน-ขาตรงข้ามพร้อมกันช้าๆ · หลังเริ่มแอ่นเมื่อไหร่คือสุดช่วงแล้ว",
    shinSafe: true,
    frames: frames("Dead_Bug"),
  },
  {
    key: "bird-dog",
    name: "Bird Dog",
    group: "core",
    target: "Core + hip stability (ตรงกับการวิ่ง)",
    cue: "คลาน 4 ขา · ยืดแขนกับขาตรงข้ามจนขนานพื้น ค้าง 1-2 วิ · สะโพกไม่บิด ห้ามแอ่นหลัง",
    shinSafe: true,
    frames: null,
  },
  {
    key: "bicycle-crunch",
    name: "Bicycle Crunch",
    group: "core",
    target: "Core / obliques",
    cue: "ศอกเข้าหาเข่าตรงข้ามช้าๆ · อย่าดึงคอ · หลังล่างแนบพื้น",
    shinSafe: true,
    frames: frames("Air_Bike"),
  },
  // ---- Upper push ----
  {
    key: "push-up",
    name: "Push-up (ปรับระดับ: มือบนโต๊ะ → พื้น → เท้าสูง)",
    group: "push",
    target: "อก / ไหล่หน้า / ไตรเซป",
    cue: "ลำตัวเป็นแผ่นเดียวกับ plank · ศอกเฉียง ~45° ไม่กางตั้งฉาก · ลงจนอกเกือบแตะ",
    shinSafe: true,
    frames: frames("Pushups"),
  },
  {
    key: "kb-floor-press",
    name: "KB Floor Press (ข้างเดียวสลับ)",
    group: "push",
    target: "อก / ไตรเซป + core anti-rotation",
    cue: "นอนหงาย ต้นแขนแตะพื้นเบาๆ ทุกครั้ง · อีกมือแนบลำตัวกันตัวบิด",
    shinSafe: true,
    frames: frames("One-Arm_Kettlebell_Floor_Press"),
  },
  {
    key: "pike-push-up",
    name: "Elevated Pike Push-up (มือบนเก้าอี้/ม้านั่งมั่นคง)",
    group: "push",
    target: "ไหล่ด้านหน้า/บน",
    cue: "ก้นชี้ฟ้าเป็นตัว Λ · มือบนเก้าอี้ที่ไม่ขยับ · ลงหัวไปข้างหน้ามือ ไม่ใช่ระหว่างมือ",
    shinSafe: true,
    frames: null,
  },
  {
    key: "kb-overhead-press",
    name: "KB Strict Overhead Press (ยืนนิ่ง ไม่ดันด้วยขา)",
    group: "push",
    target: "ไหล่ / ไตรเซป",
    cue: "เกร็งก้น+ท้องกันแอ่นหลัง · ดันตรงขึ้นจนแขนล็อก · ห้ามย่อขาช่วย",
    shinSafe: true,
    imageNote: "ภาพในคลังเป็นเวอร์ชันดันเฉียงออกข้าง — ของเราดันตรงขึ้นเหนือศีรษะ",
    frames: frames("One-Arm_Kettlebell_Military_Press_To_The_Side"),
  },
  // ---- Upper pull ----
  {
    key: "kb-row",
    name: "KB Single-arm Row (ยันเข่า/โต๊ะ)",
    group: "pull",
    target: "หลังกลาง / lat / ไบเซป",
    cue: "หลังตรงขนานพื้น · ดึงศอกเข้าสะโพก บีบสะบักค้าง 1 วิ · ลำตัวไม่บิดตาม",
    shinSafe: true,
    frames: frames("One-Arm_Kettlebell_Row"),
  },
  {
    key: "inverted-row",
    name: "Inverted Row (ใต้โต๊ะแข็งแรง)",
    group: "pull",
    target: "หลัง / ไบเซป ด้วยน้ำหนักตัว",
    cue: "ตัวตรงเป็น plank กลับหัว · ดึงอกเข้าหาขอบโต๊ะ · เท้าเลื่อนเข้ามาถ้าหนักเกิน",
    shinSafe: true,
    frames: frames("Inverted_Row"),
  },
  {
    key: "kb-halo",
    name: "KB Halo",
    group: "pull",
    target: "ไหล่ / core rotation",
    cue: "ถือ KB คว่ำที่หูจับ วนรอบศีรษะช้าๆ ชิดหัว · ลำตัวนิ่ง ไม่แอ่นหลัง · สลับทิศเท่ากัน",
    shinSafe: true,
    frames: null,
  },
  {
    key: "kb-curl",
    name: "KB Curl (สองมือจับ)",
    group: "pull",
    target: "ไบเซป",
    cue: "ศอกแนบลำตัว · ยกด้วยแขนล้วน ไม่เหวี่ยงสะโพก · ลงช้ากว่าขึ้น",
    shinSafe: true,
    imageNote: "ภาพในคลังเป็นดัมเบล — ของเราจับ KB ตัวเดียวสองมือ",
    frames: frames("Dumbbell_Bicep_Curl"),
  },
  // ---- Lower posterior chain ----
  {
    key: "glute-bridge",
    name: "Glute Bridge (สองขา)",
    group: "posterior",
    target: "Glute / hamstring",
    cue: "ดันผ่านส้นเท้า · บีบก้นค้างบนสุด 2 วิ · อย่าแอ่นหลังแทนการใช้ก้น",
    shinSafe: true,
    frames: frames("Butt_Lift_Bridge"),
  },
  {
    key: "single-leg-glute-bridge",
    name: "Single-leg Glute Bridge",
    group: "posterior",
    target: "Glute ข้างเดียว — แก้ความไม่สมดุลซ้าย-ขวา",
    cue: "ขาลอยงอเข่า 90° · สะโพกสองข้างสูงเท่ากัน ห้ามเอียง · ดันผ่านส้นเท้าข้างที่ยัน",
    shinSafe: true,
    frames: frames("Single_Leg_Glute_Bridge"),
  },
  {
    key: "kb-rdl",
    name: "KB Romanian Deadlift (สองมือ, ลงช้า 3 วิ)",
    group: "posterior",
    target: "Hamstring / glute / หลังล่าง — ตรงกับ stride การวิ่ง",
    cue: "เข่างอเล็กน้อยค้างไว้ · ดันสะโพกไปหลัง KB เลียดขา · รู้สึกตึงหลังต้นขาคือถูก",
    shinSafe: true,
    imageNote: "ภาพในคลังเป็นบาร์เบล — ของเราถือ KB สองมือ ท่วงท่าเดียวกัน",
    frames: frames("Romanian_Deadlift"),
  },
  {
    key: "kb-deadlift",
    name: "KB Deadlift (สองมือ, ยกจากพื้น)",
    group: "posterior",
    target: "Posterior chain รวม",
    cue: "KB อยู่ระหว่างเท้า · ย่อสะโพกลงจับ หลังตรง · ยืนขึ้นด้วยก้น ไม่ใช่หลังล่าง",
    shinSafe: true,
    imageNote: "ภาพในคลังเป็นบาร์เบลท่า sumo — ของเราวาง KB ระหว่างเท้าแทน",
    frames: frames("Sumo_Deadlift"),
  },
  {
    key: "clamshell",
    name: "Clamshell / Side-lying Hip Abduction",
    group: "posterior",
    target: "Glute medius — ตัวคุมสะโพกตอนลงน้ำหนักขาเดียว",
    cue: "นอนตะแคง เข่างอ ส้นเท้าชิดกัน · เปิดเข่าบนขึ้นช้าๆ · สะโพกห้ามหมุนตามไปหลัง",
    shinSafe: true,
    frames: null,
  },
  {
    key: "wall-sit",
    name: "Wall Sit (หลังพิงผนัง หน้าแข้งตั้งฉาก)",
    group: "posterior",
    target: "Quad isometric แบบไม่ต้องงอข้อเท้าลึก",
    cue: "หลังแนบผนัง · เข่า ~90° หน้าแข้งตั้งฉากพื้น · น้ำหนักลงส้นเท้า ไม่ใช่ปลายเท้า",
    shinSafe: true,
    frames: null,
  },
  // ---- ท่าเสริม / ท่าที่ยังห้ามช่วงขาขวา OPEN ----
  {
    key: "kb-goblet-squat",
    name: "KB Goblet Squat",
    group: "progression",
    target: "Quad / hamstring / core",
    cue: "ถือ KB ระดับอก ศอกชิดลำตัว · ลงจนสบายโดยส้นเท้าไม่ลอย",
    shinSafe: false,
    warn: "ท่วงท่าเดียวกับที่ทำให้ปวด 15 ส.ค. และตึง 18 ส.ค. — งดตราบใดที่หน้าแข้งขวายัง OPEN",
    frames: frames("Goblet_Squat"),
  },
  {
    key: "kb-rear-lunge",
    name: "KB Rear Lunge (สลับขา)",
    group: "progression",
    target: "Glute / quad / core ข้างเดียว + balance",
    cue: "ก้าวถอยหลัง เข่าหน้าไม่เลยปลายเท้า · ลดระยะก้าวถ้าขาขวายังตึง",
    shinSafe: false,
    warn: "ห้ามระหว่างหน้าแข้งขวา OPEN — ใส่ได้เมื่อไม่มีอาการต่อเนื่องอย่างน้อย 2 สัปดาห์",
    frames: frames("Dumbbell_Rear_Lunge"),
  },
  {
    key: "kb-suitcase-carry",
    name: "KB Suitcase Carry",
    group: "progression",
    target: "Core anti-lateral-flexion",
    cue: "ถือ KB ข้างเดียว เดินตัวตรง · ไหล่สองข้างระดับเดียวกัน ห้ามเอียงตาม",
    shinSafe: false,
    warn: "เป็นท่าเดิน-ลงน้ำหนักขา — รอจนพ้น OPEN ก่อน",
    imageNote: "ภาพในคลังเป็น farmer's walk สองมือ — ของเราถือข้างเดียวทีละข้าง",
    frames: frames("Farmers_Walk"),
  },
  {
    key: "mountain-climber",
    name: "Mountain Climber",
    group: "progression",
    target: "Core + cardio เบาๆ",
    cue: "ตัว plank · ดึงเข่าเข้าอกสลับเร็ว สะโพกไม่เด้งขึ้นลง",
    shinSafe: false,
    warn: "ปลายเท้ากระแทกพื้นซ้ำๆ — เลี่ยงระหว่างหน้าแข้งขวายังมีอาการ",
    frames: frames("Mountain_Climbers"),
  },
  {
    key: "bodyweight-squat",
    name: "Bodyweight Squat",
    group: "progression",
    target: "ขา / quad โดยรวม",
    cue: "เท้ากว้างเท่าสะโพก · ดันสะโพกไปหลังก่อนงอเข่า · ส้นเท้าติดพื้น",
    shinSafe: false,
    warn: "ลงน้ำหนักขาแบบยืน + งอข้อเท้า — ใส่กลับได้หลังพ้น OPEN",
    frames: frames("Bodyweight_Squat"),
  },
];

export type SessionItem = { key: string; dose: string };

export type StrengthSession = {
  id: "A" | "B" | "C" | "D" | "E";
  title: string;
  format: string;
  /** true = งดทั้งชุดระหว่างหน้าแข้งขวา OPEN */
  suspended?: string;
  items: SessionItem[];
  finisher?: string;
};

// ลำดับ/จำนวนครั้งตาม rules/kettlebell-core-strength.md (running-results)
export const strengthSessions: StrengthSession[] = [
  {
    id: "A",
    title: "Session A — Core (bodyweight ล้วน)",
    format: "circuit 2-3 รอบ · พัก 20-30 วิ ระหว่างท่า · 60-90 วิ ระหว่างรอบ",
    items: [
      { key: "plank", dose: "ค้าง 30-45 วิ" },
      { key: "side-plank", dose: "ค้าง 20-30 วิ/ข้าง" },
      { key: "dead-bug", dose: "8-10 ครั้ง/ข้าง" },
      { key: "bird-dog", dose: "8-10 ครั้ง/ข้าง" },
      { key: "glute-bridge", dose: "12-15 ครั้ง" },
    ],
  },
  {
    id: "B",
    title: "Session B — Core + KB 8kg",
    format: "circuit 1-2 รอบ · พัก 20-30 วิ ระหว่างท่า · 60-90 วิ ระหว่างรอบ",
    suspended: "งดทั้งชุดระหว่างหน้าแข้งขวาสถานะ OPEN (มี Goblet Squat) — Session D ครอบคลุมงานขาส่วนที่ปลอดภัยแทนแล้ว",
    items: [
      { key: "plank", dose: "ค้าง 20-40 วิ" },
      { key: "dead-bug", dose: "8-10 ครั้ง/ข้าง" },
      { key: "bird-dog", dose: "8-10 ครั้ง/ข้าง" },
      { key: "glute-bridge", dose: "12-15 ครั้ง" },
      { key: "kb-goblet-squat", dose: "6-8 ครั้ง" },
      { key: "kb-deadlift", dose: "6-8 ครั้ง" },
    ],
  },
  {
    id: "C",
    title: "Session C — Upper Push + Core (ไม่ลงน้ำหนักขาเลย)",
    format: "straight sets · พัก 60-90 วิ ระหว่างเซต · ~30-35 นาที",
    items: [
      { key: "push-up", dose: "3 เซต · RIR 2-3" },
      { key: "kb-floor-press", dose: "3 × 6-10/ข้าง" },
      { key: "pike-push-up", dose: "2-3 × 6-10" },
      { key: "kb-overhead-press", dose: "3 × 5-8/ข้าง" },
      { key: "plank", dose: "3 × ค้าง 40-60 วิ" },
      { key: "dead-bug", dose: "3 × 6-8/ข้าง" },
      { key: "side-plank", dose: "2 × ค้าง 25-40 วิ/ข้าง" },
    ],
  },
  {
    id: "D",
    title: "Session D — Lower Posterior Chain (shin-safe)",
    format: "straight sets · พัก 60-90 วิ ระหว่างเซต · ~30 นาที",
    items: [
      { key: "glute-bridge", dose: "3 × 12 (ค้างบนสุด 2 วิ)" },
      { key: "single-leg-glute-bridge", dose: "3 × 8-10/ข้าง" },
      { key: "kb-rdl", dose: "3 × 8-12" },
      { key: "kb-deadlift", dose: "3 × 6-10" },
      { key: "clamshell", dose: "3 × 12-15/ข้าง" },
      { key: "bird-dog", dose: "3 × 8-10/ข้าง" },
      { key: "wall-sit", dose: "2 × ค้าง 20-30 วิ" },
    ],
  },
  {
    id: "E",
    title: "Session E — Upper Pull + Metabolic Finisher",
    format: "straight sets 4 ท่าแรก แล้วปิดท้ายด้วย circuit · ~35 นาที",
    items: [
      { key: "kb-row", dose: "3-4 × 8-12/ข้าง" },
      { key: "inverted-row", dose: "3 เซต · RIR 2-3" },
      { key: "kb-halo", dose: "3 × 6-8/ทิศ" },
      { key: "kb-curl", dose: "2-3 × 10-15" },
    ],
    finisher:
      "Finisher circuit 2-3 รอบ (พัก 45-60 วิ/รอบ): KB Deadlift 8 · KB Single-arm Row 6/ข้าง · Push-up 6-10 · Dead Bug 6-8/ข้าง · Plank 20-30 วิ — คุม HR ไม่เกิน Z3 ต้น",
  },
];

export const movesByKey = new Map(strengthMoves.map((m) => [m.key, m]));

/** ดึงตัวอักษร session (A-E) ออกจากข้อความ เช่น "Session D — สัปดาห์ที่ 2..." */
export function sessionIdFromText(...texts: (string | null | undefined)[]): StrengthSession["id"] | null {
  for (const text of texts) {
    const hit = text?.match(/session\s*([A-E])\b/i);
    if (hit) return hit[1].toUpperCase() as StrengthSession["id"];
  }
  return null;
}
