const replacements: Array<[RegExp, string]> = [
  [/\bdrift\b/gi, "การไหลของหัวใจ"],
  [/\bdecoupling\b/gi, "การหลุดแอโรบิก"],
  [/\bmobility\b/gi, "การเคลื่อนไหว"],
  [/\brecovery-high\b/gi, "ฟื้นตัวสูง"],
  [/\brecovery\b/gi, "ฟื้นตัว"],
  [/\breadiness\b/gi, "ความพร้อม"],
  [/\bload-optimized\b/gi, "โหลดเหมาะสม"],
  [/\bload\b/gi, "โหลด"],
  [/\bsession\b/gi, "รายการซ้อม"],
  [/\bintensity\b/gi, "ความหนัก"],
  [/\bpain\b/gi, "อาการเจ็บ"],
  [/\blow\b/gi, "ต่ำ"],
  [/\bhigh\b/gi, "สูง"],
  [/\bsleep-good\b/gi, "นอนดี"],
  [/\bsleep\b/gi, "การนอน"],
  [/\bdaily\b/gi, "รายวัน"],
  [/\bhrv-normal\b/gi, "HRV ปกติ"],
  [/\bcoros\b/gi, "COROS"],
  [/\b10k\b/gi, "10K"],
  [/\bzone\b/gi, "โซน"],
  [/\beffort\b/gi, "ความรู้สึกหนัก"],
  [/\bpace\b/gi, "เพซ"],
  [/\bquality\b/gi, "ซ้อมคุณภาพ"],
  [/\bdaily trainer\b/gi, "รองเท้าซ้อมประจำวัน"],
  [/\blight trainer\b/gi, "รองเท้าเบา"],
  [/\brace shoe\b/gi, "รองเท้าวันแข่ง"],
  [/\brace\b/gi, "แข่ง"],
  [/\bnovablast\b/gi, "โนวาบลาสต์"],
];

export function thaiText(value: string | null | undefined, fallback = "-") {
  if (!value) return fallback;
  const isTag = value.trim().startsWith("#");
  let text = value;
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  if (isTag) {
    text = text.replaceAll("#", "").replaceAll("-", " ");
  }
  return text
    .replaceAll("  ", " ")
    .replaceAll("ปิดท้ายด้วย สไตรด์", "ปิดท้ายด้วยสไตรด์")
    .replaceAll("ถ้า การไหลของหัวใจ", "ถ้าการไหลของหัวใจ")
    .replaceAll("หัวใจ ยัง", "หัวใจยัง")
    .replaceAll("ทำ วิ่งยาว ได้", "ทำวิ่งยาวได้")
    .replaceAll("ทำ วิ่งยาว ตามแผน", "ทำวิ่งยาวตามแผน")
    .replaceAll("มี รายการซ้อม", "มีรายการซ้อม")
    .replaceAll("ให้ รายการซ้อม", "ให้รายการซ้อม")
    .replaceAll("ถ้า รายการซ้อม", "ถ้ารายการซ้อม")
    .replaceAll("ลด ความหนัก", "ลดความหนัก")
    .replaceAll("เช็ก อาการเจ็บ", "เช็กอาการเจ็บ")
    .replaceAll("การไหลของหัวใจ สูง", "การไหลของหัวใจสูง")
    .replaceAll("ซ้อมคุณภาพ ถัดไป", "ซ้อมคุณภาพถัดไป")
    .replaceAll("เป็น ฟื้นตัว", "เป็นฟื้นตัว")
    .replaceAll("ความรู้สึกหนัก มากกว่า เพซ", "ความรู้สึกหนักมากกว่าเพซ")
    .trim();
}
