// ท่า kettlebell จาก dataset yuhonas/free-exercise-db (Public Domain)
// รูป hotlink จาก raw.githubusercontent — 2 เฟรม (start/end) สลับกันแสดงเป็น pseudo-animation แทน gif
export type KbGroup = "power" | "upper" | "core" | "stability";

export type KbExercise = {
  name: string;
  group: KbGroup;
  injurySafe: boolean;
  target: string;
  frames: [string, string];
  note: string;
};

export const KB_GROUP_LABEL: Record<KbGroup, string> = {
  power: "Day A — Power",
  upper: "Upper / Core",
  core: "Core / Anti-rotation",
  stability: "Day B — Stability / Mobility",
};

// ตาราง KB รายวัน (8kg) — injury-aware: เลี่ยง thruster/pistol/lunge ช่วงขาเจ็บ
export type KbSet = { name: string; sets: string };
export type KbDay = { weekday: number; day: string; label: string; items: KbSet[] };

// weekday: 1=จันทร์ ... 5=ศุกร์ (ตรงกับ Date.getDay() จันทร์=1)
export const kbRoutine: KbDay[] = [
  {
    weekday: 1, day: "จันทร์", label: "Day A — Power",
    items: [
      { name: "KB swing", sets: "3 × 15" },
      { name: "KB sumo high pull", sets: "3 × 10" },
      { name: "KB two arm clean", sets: "3 × 8" },
    ],
  },
  {
    weekday: 2, day: "อังคาร", label: "Upper / Core",
    items: [
      { name: "KB two arm military press", sets: "3 × 10" },
      { name: "KB arnold press", sets: "3 × 8" },
      { name: "KB one arm row", sets: "3 × 10/ข้าง" },
      { name: "KB alternating renegade row", sets: "3 × 8/ข้าง" },
      { name: "KB figure 8", sets: "3 × 10" },
    ],
  },
  {
    weekday: 4, day: "พฤหัส", label: "Day B — Stability",
    items: [
      { name: "KB turkish get up (squat style)", sets: "3 × 3/ข้าง" },
      { name: "KB goblet squat", sets: "3 × 10" },
      { name: "KB windmill", sets: "3 × 6/ข้าง" },
      { name: "KB one arm row", sets: "3 × 10/ข้าง" },
    ],
  },
  {
    weekday: 5, day: "ศุกร์", label: "Mobility",
    items: [
      { name: "KB goblet squat", sets: "2 × 10 tempo" },
      { name: "KB windmill", sets: "2 × 6/ข้าง" },
      { name: "KB figure 8", sets: "2 × 8" },
      { name: "KB turkish get up (squat style)", sets: "1-2/ข้าง ช้า" },
    ],
  },
];

const FEDB = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const frames = (dir: string): [string, string] => [`${FEDB}/${dir}/0.jpg`, `${FEDB}/${dir}/1.jpg`];

export const kbExercises: KbExercise[] = [
  { name: "KB swing", group: "power", injurySafe: true, target: "สะโพก", frames: frames("One-Arm_Kettlebell_Swings"), note: "Swing สะโพก hip-hinge" },
  { name: "KB sumo high pull", group: "power", injurySafe: true, target: "ทราพีเซียส", frames: frames("Kettlebell_Sumo_High_Pull"), note: "ดึงขึ้นท่า sumo" },
  { name: "KB two arm clean", group: "power", injurySafe: true, target: "ไหล่", frames: frames("Two-Arm_Kettlebell_Clean"), note: "Clean สองมือ" },
  { name: "KB thruster", group: "power", injurySafe: false, target: "ไหล่", frames: frames("Kettlebell_Thruster"), note: "Squat + press ต่อเนื่อง" },
  { name: "KB two arm military press", group: "upper", injurySafe: true, target: "ไหล่", frames: frames("Two-Arm_Kettlebell_Military_Press"), note: "ดันบ่าสองมือ" },
  { name: "KB arnold press", group: "upper", injurySafe: true, target: "ไหล่", frames: frames("Kettlebell_Arnold_Press"), note: "Arnold press" },
  { name: "KB one arm row", group: "upper", injurySafe: true, target: "หลังบน", frames: frames("One-Arm_Kettlebell_Row"), note: "โรว์มือเดียว" },
  { name: "KB alternating renegade row", group: "upper", injurySafe: true, target: "หลังบน", frames: frames("Alternating_Renegade_Row"), note: "Renegade row สลับ" },
  { name: "KB figure 8", group: "core", injurySafe: true, target: "core", frames: frames("Kettlebell_Figure_8"), note: "เลข 8 รอบขา" },
  { name: "KB windmill", group: "core", injurySafe: true, target: "core", frames: frames("Kettlebell_Windmill"), note: "Windmill core+hip" },
  { name: "KB turkish get up (squat style)", group: "stability", injurySafe: true, target: "สะโพก", frames: frames("Kettlebell_Turkish_Get-Up_Squat_style"), note: "TGU squat style" },
  { name: "KB goblet squat", group: "stability", injurySafe: true, target: "สะโพก", frames: frames("Goblet_Squat"), note: "Goblet squat" },
  { name: "KB pistol squat", group: "stability", injurySafe: false, target: "สะโพก", frames: frames("Kettlebell_Pistol_Squat"), note: "Pistol squat ขาเดียว" },
  { name: "KB lunge pass through", group: "stability", injurySafe: false, target: "สะโพก", frames: frames("Lunge_Pass_Through"), note: "Lunge ส่ง KB" },
];
