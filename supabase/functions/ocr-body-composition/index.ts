// Supabase Edge Function: OCR a COROS/scale body-composition screenshot via Claude vision.
// Requires secret ANTHROPIC_API_KEY. Returns structured JSON for the client to preview before saving.
// verify_jwt is enabled by default, so only authenticated dashboard users can call it.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIELDS = `
weight_kg, bmi, body_score, body_fat_pct, body_fat_mass_kg, subcutaneous_fat_pct,
visceral_fat_level, muscle_mass_kg, muscle_pct, skeletal_muscle_kg, body_water_pct,
protein_mass_kg, bone_mineral_kg, fat_free_mass_kg, bmr_kcal, body_age, measured_date`;

const TOOL = {
  name: "record_body_composition",
  description: "Record the body composition metrics read from the image.",
  input_schema: {
    type: "object",
    properties: {
      measured_date: { type: "string", description: "Date shown in image, format YYYY-MM-DD. Null if absent." },
      weight_kg: { type: "number" },
      bmi: { type: "number" },
      body_score: { type: "integer" },
      body_fat_pct: { type: "number" },
      body_fat_mass_kg: { type: "number" },
      subcutaneous_fat_pct: { type: "number" },
      visceral_fat_level: { type: "number" },
      muscle_mass_kg: { type: "number" },
      muscle_pct: { type: "number" },
      skeletal_muscle_kg: { type: "number" },
      body_water_pct: { type: "number" },
      protein_mass_kg: { type: "number" },
      bone_mineral_kg: { type: "number" },
      fat_free_mass_kg: { type: "number" },
      bmr_kcal: { type: "integer" },
      body_age: { type: "integer" },
    },
  },
};

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
            {
              type: "text",
              text: `Read this body composition / scale screenshot (may be in Thai) and extract these fields: ${FIELDS}. ` +
                `Use the numeric values exactly as shown. Convert Thai labels: น้ำหนัก=weight, ไขมัน=fat, กล้ามเนื้อ=muscle, ` +
                `น้ำในร่างกาย=body water, โปรตีน=protein, กระดูก=bone, ไขมันในช่องท้อง/อวัยวะภายใน=visceral fat, ` +
                `อายุร่างกาย=body age, มวลไร้ไขมัน=fat free mass. Omit any field you cannot read confidently.`,
            },
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
