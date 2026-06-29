// ท่า kettlebell จาก dataset hasaneyldrm/exercises-dataset (educational/non-commercial)
// gif hotlink จาก raw.githubusercontent — injurySafe = ทำได้ช่วงขาเจ็บ (no/low impact)
export type KbGroup = "power" | "upper" | "core" | "stability";

export type KbExercise = {
  name: string;
  group: KbGroup;
  injurySafe: boolean;
  target: string;
  gif: string;
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

export const kbExercises: KbExercise[] = [
  { name: "KB swing", group: "power", injurySafe: true, target: "สะโพก", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0549-UHJlbu3.gif", note: "Swing สะโพก hip-hinge" },
  { name: "KB sumo high pull", group: "power", injurySafe: true, target: "ทราพีเซียส", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0548-8ARQ9Hw.gif", note: "ดึงขึ้นท่า sumo" },
  { name: "KB two arm clean", group: "power", injurySafe: true, target: "ไหล่", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0552-7Ba7bQ2.gif", note: "Clean สองมือ" },
  { name: "KB thruster", group: "power", injurySafe: false, target: "ไหล่", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0550-yWxMvB5.gif", note: "Squat + press ต่อเนื่อง" },
  { name: "KB two arm military press", group: "upper", injurySafe: true, target: "ไหล่", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0553-blBXysN.gif", note: "ดันบ่าสองมือ" },
  { name: "KB arnold press", group: "upper", injurySafe: true, target: "ไหล่", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0523-UM8mgyG.gif", note: "Arnold press" },
  { name: "KB one arm row", group: "upper", injurySafe: true, target: "หลังบน", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0541-g9AsZ8P.gif", note: "โรว์มือเดียว" },
  { name: "KB alternating renegade row", group: "upper", injurySafe: true, target: "หลังบน", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0521-b9kqlBy.gif", note: "Renegade row สลับ" },
  { name: "KB figure 8", group: "core", injurySafe: true, target: "core", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0532-L4ay0PW.gif", note: "เลข 8 รอบขา" },
  { name: "KB windmill", group: "core", injurySafe: true, target: "core", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0554-9Tkqa9O.gif", note: "Windmill core+hip" },
  { name: "KB turkish get up (squat style)", group: "stability", injurySafe: true, target: "สะโพก", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0551-Ha7SZ3y.gif", note: "TGU squat style" },
  { name: "KB goblet squat", group: "stability", injurySafe: true, target: "สะโพก", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0534-ZA8b5hc.gif", note: "Goblet squat" },
  { name: "KB pistol squat", group: "stability", injurySafe: false, target: "สะโพก", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0544-5bpPTHv.gif", note: "Pistol squat ขาเดียว" },
  { name: "KB lunge pass through", group: "stability", injurySafe: false, target: "สะโพก", gif: "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0536-WKMQzCD.gif", note: "Lunge ส่ง KB" },
];
