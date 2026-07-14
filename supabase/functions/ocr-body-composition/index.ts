// Supabase Edge Function: OCR a COROS/scale body-composition screenshot via Claude vision.
// Requires secret ANTHROPIC_API_KEY. Returns structured JSON for the client to preview before saving.
// verify_jwt is enabled by default, so only authenticated dashboard users can call it.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOOL = {
  name: "record_body_composition",
  description: "Record the body composition metrics read from the image.",
  input_schema: {
    type: "object",
    properties: {
      measured_date: { type: "string", description: "Date+time at the very top, format YYYY-MM-DD. The image shows DD/MM/YYYY (day first). e.g. '15/06/2026' becomes '2026-06-15'. Omit if absent." },
      weight_kg: { type: "number", description: "Large weight number near the top, kg." },
      bmi: { type: "number", description: "BMI value, typically 18-30. Label: BMI." },
      body_score: { type: "integer", description: "Body score, typically 60-100. NOT visceral fat level." },
      body_fat_pct: { type: "number", description: "Body fat % (เปอร์เซ็นต์ไขมันในร่างกาย), near the top next to BMI, typically 18-25." },
      body_fat_mass_kg: { type: "number", description: "Fat mass in kg (มวลไขมัน). Sanity check: this ≈ weight_kg × body_fat_pct / 100. Usually LARGER than protein mass. Listed near the top of องค์ประกอบของร่างกาย." },
      visceral_fat_level: { type: "number", description: "Visceral fat LEVEL (ระดับไขมันในอวัยวะใน), a small standalone integer 1-15 with NO unit. NOT the ไขมันช่องท้อง percent." },
      muscle_mass_kg: { type: "number", description: "Muscle mass kg (มวลกล้ามเนื้อ), typically 50-55." },
      muscle_pct: { type: "number", description: "Muscle percent (เปอร์เซ็นต์ของกล้ามเนื้อ), with %, typically 70-78." },
      skeletal_muscle_kg: { type: "number", description: "Skeletal muscle mass kg (มวลกล้ามเนื้อโครงร่าง), typically 26-30. NOT the มวลน้ำในร่างกาย/body-water-mass (~38 kg)." },
      body_water_pct: { type: "number", description: "Body water PERCENT (น้ำในร่างกาย), WITH a % sign, typically 52-56. NOT the fat-free-mass kg (~55 kg)." },
      protein_mass_kg: { type: "number", description: "Protein mass kg (มวลโปรตีน), typically 12-15. Listed LAST in องค์ประกอบของร่างกาย (after มวลน้ำ, มวลไขมัน, แร่ธาตุกระดูก). Usually SMALLER than fat mass." },
      bone_mineral_kg: { type: "number", description: "Bone mineral kg (แร่ธาตุในกระดูก), typically 2-4." },
      fat_free_mass_kg: { type: "number", description: "Fat free mass kg (น้ำหนักร่างกายไร้ไขมัน), at the very bottom, typically 54-57. A kg value WITHOUT %, NOT the skeletal muscle (~27 kg)." },
      bmr_kcal: { type: "integer", description: "BMR kcal, typically 1400-1800." },
      body_age: { type: "integer", description: "Body age in years (อายุร่างกาย)." },
    },
  },
};

const PROMPT =
  "This is a COROS / smart-scale body composition screenshot in Thai. Each metric has a NUMBER directly above its Thai LABEL. Match each number to its label CAREFULLY using the field descriptions. " +
  "IMPORTANT: the image contains EXTRA values that do NOT map to any field — ignore them: มวลน้ำในร่างกาย (body water MASS ~38 kg, we only want body water PERCENT), เปอร์เซ็นต์แร่ธาตุในกระดูก (bone mineral %, ~4%), and any ratio like 0.7. " +
  "Do not let these extra values push into skeletal_muscle, body_water_pct, or fat_free_mass. " +
  "The date at the very top is DD/MM/YYYY HH:MM (day first) — read the DAY digits carefully then convert to YYYY-MM-DD (e.g. '15/06/2026 07:56' -> '2026-06-15'). " +
  "The องค์ประกอบของร่างกาย section lists masses in this order: มวลน้ำในร่างกาย (ignore), มวลไขมัน (=fat mass, larger), แร่ธาตุกระดูก (bone), มวลโปรตีน (=protein, smaller, last). " +
  "Read each value exactly. Omit any field you cannot read with high confidence.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const image = body.image?.replace(/^data:image\/\w+;base64,/, "");
  const mediaType = body.mediaType ?? "image/jpeg";
  if (!image) return json({ error: "missing image" }, 400);

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_body_composition" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const text = await anthropicRes.text();
    return json({ error: `Claude API ${anthropicRes.status}`, detail: text }, 502);
  }

  const result = await anthropicRes.json();
  const toolUse = result.content?.find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse) return json({ error: "no structured output", raw: result }, 502);

  return json({ data: toolUse.input });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
