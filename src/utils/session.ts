import type { GearMileage } from "../types";

export type SessionKind =
  | "easy"
  | "long"
  | "recovery"
  | "strides"
  | "tempo"
  | "vo2"
  | "test"
  | "race"
  | "rest"
  | "other";

// Single source of truth for classifying a session_type / title string.
// Order matters: more specific buckets (strides, tests) are checked before
// the broad "easy" bucket so "Easy + strides" is not mislabelled as easy.
export function classifySession(value: string | null | undefined): SessionKind {
  const t = (value ?? "").toLowerCase();
  if (!t) return "other";
  if (t.includes("strides") || t.includes("stride") || t.includes("สไตรด์")) return "strides";
  if (t.includes("race-sim") || t.includes("race simulation") || t.includes("calibration") || t.includes("test")) return "test";
  if (t.includes("vo2") || t.includes("interval")) return "vo2";
  if (t.includes("tempo") || t.includes("threshold") || t.includes("steady") || t.includes("race-pace") || t.includes("race pace")) return "tempo";
  if (t.includes("recovery") || t.includes("ฟื้น")) return "recovery";
  if (t.includes("long") || t.includes("ยาว")) return "long";
  if (t.includes("easy") || t.includes("เบา")) return "easy";
  if (t.includes("race") || t.includes("แข่ง")) return "race";
  if (t.includes("rest") || t.includes("off") || t.includes("พัก") || t.includes("shakeout")) return "rest";
  return "other";
}

// Pure aerobic steady-state runs — used for pace consistency & efficiency.
// Excludes strides/tempo/intervals which have intentionally variable pace.
export function isSteadyAerobic(value: string | null | undefined): boolean {
  const kind = classifySession(value);
  return kind === "easy" || kind === "long" || kind === "recovery";
}

export type PainLevel = "none" | "mild" | "moderate" | "high";

// Single source of truth for interpreting a free-text pain/soreness note.
export function painLevel(pain: string | null | undefined): PainLevel {
  if (!pain) return "none";
  const p = pain.toLowerCase().trim();
  if (p === "-" || p === "none" || p.includes("ไม่มี") || p.includes("หาย")) return "none";
  const match = p.match(/(\d+)\s*\/\s*10/);
  if (match) {
    const n = parseInt(match[1]);
    if (n >= 7) return "high";
    if (n >= 4) return "moderate";
    return "mild";
  }
  if (p.includes("ตึง") || p.includes("เจ็บ") || p.includes("ปวด")) return "mild";
  return "none";
}

export type RecommendedShoeInfo = {
  slug: string;
  name: string;
  role: string;
  isQuality: boolean;
};

type ShoeCategory = "quality" | "recovery" | "daily";

function categoryFor(kind: SessionKind): ShoeCategory {
  if (kind === "tempo" || kind === "vo2" || kind === "test" || kind === "race") return "quality";
  if (kind === "recovery") return "recovery";
  return "daily";
}

// จับคำใน role/ชื่อรองเท้าเพื่อหาคู่ที่เหมาะกับ category ของ session — role เป็น
// free text จาก gear_mileage เลยแมตช์แบบ keyword แทนค่าคงที่
const CATEGORY_KEYWORDS: Record<ShoeCategory, RegExp> = {
  quality: /race|tempo|speed|quality|interval|vo2|carbon|แข่ง|คุณภาพ|เทมโป/i,
  recovery: /recovery|ฟื้น/i,
  daily: /daily|trainer|easy|long|ประจำวัน|เบา|ยาว/i,
};

const RETIRED_STATUS = /ปลดระวาง|retired|เกษียณ/i;

function isAvailable(shoe: GearMileage): boolean {
  if (shoe.status && RETIRED_STATUS.test(shoe.status)) return false;
  if (shoe.used_percent != null && shoe.used_percent >= 100) return false;
  return true;
}

// fallback ตายตัว ใช้เฉพาะตอนยังไม่มีข้อมูลรองเท้าใน gear_mileage เลย (ไม่งั้นการ์ด
// รองเท้าแนะนำจะว่างเปล่าตอนยังไม่ได้ sync ตาราง gear)
const FALLBACK_BY_CATEGORY: Record<ShoeCategory, RecommendedShoeInfo> = {
  quality: { slug: "xtep-2000km-5-pro", name: "Xtep 2000km 5.0 Pro", role: "ซ้อมคุณภาพ / Interval / Tempo / แข่ง", isQuality: true },
  recovery: { slug: "xtep-2000-km-3", name: "Xtep 2000km 3", role: "ฟื้นตัว / Easy เบาๆ", isQuality: false },
  daily: { slug: "novablast-5", name: "Novablast 5", role: "Easy / Long run ประจำวัน", isQuality: false },
};

/** แนะนำรองเท้าจากคู่ที่มีจริงใน gear_mileage ก่อนเสมอ — เลือกคู่ที่ role/ชื่อ
 *  ตรงกับประเภท session (quality/recovery/daily) แล้วเลือกคู่ที่สึกน้อยสุด
 *  (used_percent ต่ำสุด) ในกลุ่มนั้น ตัดคู่ที่ปลดระวางหรือหมดอายุใช้งานแล้วออก
 *  ใช้ FALLBACK_BY_CATEGORY เฉพาะตอนยังไม่มีรองเท้าที่ match/ใช้งานได้เลย */
export function getRecommendedShoe(sessionType: string | null | undefined, gear: GearMileage[] = []): RecommendedShoeInfo {
  const kind = classifySession(sessionType);
  const category = categoryFor(kind);
  const isQuality = category === "quality";

  const available = gear.filter(isAvailable);
  const keyword = CATEGORY_KEYWORDS[category];
  const matched = available.filter((s) => keyword.test(s.role ?? "") || keyword.test(s.shoe_name ?? ""));
  const pool = matched.length ? matched : available;
  const pick = [...pool].sort((a, b) => (a.used_percent ?? 0) - (b.used_percent ?? 0))[0];

  if (!pick) return FALLBACK_BY_CATEGORY[category];
  return {
    slug: pick.shoe_slug,
    name: pick.shoe_name ?? pick.shoe_slug,
    role: pick.role ?? FALLBACK_BY_CATEGORY[category].role,
    isQuality,
  };
}

