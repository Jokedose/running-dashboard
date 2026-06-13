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
