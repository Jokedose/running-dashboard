// Supabase Edge Function: OCR a COROS/scale body-composition screenshot via Claude vision.
// Requires secret ANTHROPIC_API_KEY. Returns structured JSON for the client to preview before saving.
// verify_jwt is enabled by default, so only authenticated dashboard users can call it.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";

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
      measured_date: { type: "string", description: "Date at the top, format YYYY-MM-DD. Image may show DD/MM/YYYY — convert carefully. Omit if absent." },
      weight_kg: { type: "number", description: "Large weight number near the top, kg." },
      bmi: { type: "number", description: "BMI value, typically 18-30. Label: BMI. NOT body fat percent." },
      body_score: { type: "integer", description: "Body score, typically 60-100. NOT visceral fat level." },
      body_fat_pct: { type: "number", description: "Body fat percentage with % sign, typically 10-30." },
      body_fat_mass_kg: { type: "number", description: "Fat mass in kg (มวลไขมัน)." },
      subcutaneous_fat_pct: { type: "number", description: "Subcutaneous fat percent." },
      visceral_fat_level: { type: "number", description: "Visceral fat LEVEL, small integer 1-15. NOT a percent or kg." },
      muscle_mass_kg: { type: "number", description: "Muscle mass kg, typically 45-60." },
      muscle_pct: { type: "number", description: "Muscle percentage with %, typically 70-80." },
      skeletal_muscle_kg: { type: "number", description: "Skeletal muscle kg, typically 25-35." },
      body_water_pct: { type: "number", description: "Body water percent, typically 50-60." },
      protein_mass_kg: { type: "number", description: "Protein mass kg, typically 10-16." },
      bone_mineral_kg: { type: "number", description: "Bone mineral kg, typically 2-4." },
      fat_free_mass_kg: { type: "number", description: "Fat free mass kg, typically 50-60." },
      bmr_kcal: { type: "integer", description: "BMR kcal, typically 1400-1800." },
      body_age: { type: "integer", description: "Body age in years." },
    },
  },
};

const PROMPT =
  "This is a COROS / smart-scale body composition screenshot in Thai. Each metric has a NUMBER directly above or beside its Thai LABEL. " +
  "Match each number to its label CAREFULLY — do not swap values. Avoid these mistakes: (1) BMI (~24) vs body fat % (~22). " +
  "(2) body score (~80, large) vs visceral fat level (~8, small integer). (3) percentages (%) vs masses (kg). " +
  "(4) มวลไขมัน (fat mass kg) vs เปอร์เซ็นต์ไขมัน (fat %). Read each value exactly. Omit any field you cannot read with high confidence.";

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
