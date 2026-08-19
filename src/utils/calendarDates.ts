export const WEEKDAYS_SHORT = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
export const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, n: number) {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
}

export function weekDates(refDate: string): string[] {
  const d = parseLocalDate(refDate);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return formatLocalDate(dd);
  });
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDow = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array(leadingDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** ISO-8601 week id ("2026-W34") — คีย์เดียวกับที่ pipeline ฝั่ง running-results
    ใช้ตั้งชื่อสัปดาห์ใน energy_weekly / intensity_distribution_weekly
    ใช้ UTC เพราะสนใจแค่ปฏิทิน ไม่ใช่เวลาจริง — เลี่ยง DST/timezone มาขยับวัน */
export function isoWeekId(dateString: string): string | null {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** ย้อนกลับ: "2026-W34" → วันจันทร์ของสัปดาห์นั้น (YYYY-MM-DD) */
export function isoWeekStart(isoWeek: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!match) return null;
  const [, year, week] = match;
  // 4 ม.ค. อยู่ในสัปดาห์ที่ 1 เสมอตามนิยาม ISO — ใช้เป็นหมุดแล้วนับถอยไปวันจันทร์
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (Number(week) - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

/** ป้ายสั้นสำหรับแกน x ของกราฟรายสัปดาห์ — "2026-W34" → "W34" */
export function shortIsoWeek(isoWeek: string): string {
  return isoWeek.replace(/^\d{4}-/, "");
}
