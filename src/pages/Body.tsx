import { useRef, useState } from "react";
import { Activity, Droplet, Flame, Scale, Upload } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartTooltip, chartAxis, chartColors, chartGrid, chartMargin } from "../components/ChartKit";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { supabase } from "../supabase";
import type { BodyComposition, DashboardData } from "../types";
import { shortDate } from "../utils/format";

const TARGET_WEIGHT = 63;
const TARGET_BODY_FAT = 18;

// เส้นแนะนำ: คงน้ำหนักช่วง peak ก.ค. แล้วค่อยๆ ลดไป 63 kg ภายใน ธ.ค.
const GUIDE_MILESTONES: { date: string; weight: number; note: string }[] = [
  { date: "2026-07-19", weight: 70, note: "B-race — คงน้ำหนัก ไม่ลดช่วง peak" },
  { date: "2026-09-01", weight: 68, note: "Phase B — เริ่มลดไขมันเบาๆ" },
  { date: "2026-10-15", weight: 66, note: "Phase C — ลดต่อเนื่อง" },
  { date: "2026-12-06", weight: TARGET_WEIGHT, note: `A-race — เป้า ${TARGET_WEIGHT} kg` },
];

type FieldKey = keyof Omit<BodyComposition, "id" | "measured_date" | "source">;

const FIELD_DEFS: { key: FieldKey | "measured_date"; label: string; step?: string }[] = [
  { key: "measured_date", label: "วันที่" },
  { key: "weight_kg", label: "น้ำหนัก (kg)", step: "0.1" },
  { key: "bmi", label: "BMI", step: "0.1" },
  { key: "body_score", label: "คะแนนร่างกาย" },
  { key: "body_fat_pct", label: "ไขมัน %", step: "0.1" },
  { key: "body_fat_mass_kg", label: "มวลไขมัน (kg)", step: "0.1" },
  { key: "subcutaneous_fat_pct", label: "ไขมันใต้ผิว %", step: "0.1" },
  { key: "visceral_fat_level", label: "ไขมันในช่องท้อง", step: "0.1" },
  { key: "muscle_mass_kg", label: "มวลกล้ามเนื้อ (kg)", step: "0.1" },
  { key: "muscle_pct", label: "กล้ามเนื้อ %", step: "0.1" },
  { key: "skeletal_muscle_kg", label: "Skeletal muscle (kg)", step: "0.1" },
  { key: "body_water_pct", label: "น้ำในร่างกาย %", step: "0.1" },
  { key: "protein_mass_kg", label: "โปรตีน (kg)", step: "0.1" },
  { key: "bone_mineral_kg", label: "แร่ธาตุกระดูก (kg)", step: "0.1" },
  { key: "fat_free_mass_kg", label: "มวลไร้ไขมัน (kg)", step: "0.1" },
  { key: "bmr_kcal", label: "BMR (kcal)" },
  { key: "body_age", label: "อายุร่างกาย" },
];

function delta(rows: BodyComposition[], key: FieldKey): string | undefined {
  if (rows.length < 2) return undefined;
  const a = rows[rows.length - 1][key];
  const b = rows[rows.length - 2][key];
  if (a == null || b == null) return undefined;
  const d = Number(a) - Number(b);
  if (d === 0) return "เท่าเดิม";
  return `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)} จากครั้งก่อน`;
}

export function Body({ data, onSaved }: { data: DashboardData; onSaved: () => void }) {
  const rows = data.body;
  const latest = rows[rows.length - 1] ?? null;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ measured_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Merge actual measurements with the recommended guide trajectory into one
  // date-sorted series. The guide starts from the latest actual weight so the
  // dashed line visually continues from where the runner is now.
  const chartData = (() => {
    const byDate = new Map<string, { date: string; weight: number | null; fat: number | null; guide: number | null }>();
    for (const r of rows) {
      byDate.set(r.measured_date, { date: r.measured_date, weight: r.weight_kg, fat: r.body_fat_pct, guide: null });
    }
    if (latest?.weight_kg != null) {
      const seed = byDate.get(latest.measured_date);
      if (seed) seed.guide = latest.weight_kg;
    }
    for (const m of GUIDE_MILESTONES) {
      const existing = byDate.get(m.date);
      if (existing) existing.guide = m.weight;
      else byDate.set(m.date, { date: m.date, weight: null, fat: null, guide: m.weight });
    }
    return [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: shortDate(d.date) }));
  })();

  async function onUpload(file: File) {
    setOcrBusy(true);
    setErr(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-body-composition`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: base64, mediaType: file.type || "image/jpeg" }),
      });
      const out = await res.json();
      if (!res.ok || out.error) throw new Error(out.error ?? `OCR failed (${res.status})`);
      const parsed = out.data as Record<string, number | string>;
      // Default to today — the user uploads the morning's photo, and OCR date digits
      // (e.g. 15 vs 13) are the least reliable field. They can still edit it.
      const next: Record<string, string> = { measured_date: new Date().toISOString().slice(0, 10) };
      for (const [k, v] of Object.entries(parsed)) {
        if (k === "measured_date") continue;
        if (v != null && v !== "") next[k] = String(v);
      }
      setForm(next);
      setShowForm(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "OCR error");
    } finally {
      setOcrBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setErr("ไม่พบ session");
      setSaving(false);
      return;
    }
    const payload: Record<string, unknown> = { user_id: uid, source: "manual" };
    for (const f of FIELD_DEFS) {
      const v = form[f.key];
      if (v == null || v === "") continue;
      payload[f.key] = f.key === "measured_date" ? v : Number(v);
    }
    const { error } = await supabase.from("body_composition").upsert(payload, { onConflict: "user_id,measured_date" });
    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setShowForm(false);
    setForm({ measured_date: new Date().toISOString().slice(0, 10) });
    onSaved();
  }

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="น้ำหนัก" value={latest?.weight_kg == null ? "-" : `${latest.weight_kg} kg`} detail={delta(rows, "weight_kg") ?? `เป้า ${TARGET_WEIGHT} kg`} icon={Scale} />
        <MetricCard
          label="ไขมันร่างกาย"
          value={latest?.body_fat_pct == null ? "-" : `${latest.body_fat_pct}%`}
          detail={`เป้า ${TARGET_BODY_FAT}% · ${delta(rows, "body_fat_pct") ?? ""}`}
          icon={Flame}
          tone={latest?.body_fat_pct != null && latest.body_fat_pct > 20 ? "warn" : "good"}
        />
        <MetricCard label="มวลกล้ามเนื้อ" value={latest?.muscle_mass_kg == null ? "-" : `${latest.muscle_mass_kg} kg`} detail={`รักษาไว้ · ${delta(rows, "muscle_mass_kg") ?? ""}`} icon={Activity} tone="good" />
        <MetricCard
          label="ไขมันช่องท้อง"
          value={latest?.visceral_fat_level == null ? "-" : String(latest.visceral_fat_level)}
          detail={latest?.visceral_fat_level != null && latest.visceral_fat_level >= 10 ? "สูง (≥10)" : "ปกติ (1-9)"}
          icon={Droplet}
          tone={latest?.visceral_fat_level != null && latest.visceral_fat_level >= 10 ? "hot" : "good"}
        />
      </div>

      <div className="content-grid">
        <Panel
          title="น้ำหนัก · ไขมัน trend"
          subtitle={`เส้นทึบ = น้ำหนักจริง · เส้นประเขียว = เส้นแนะนำ (คงน้ำหนักช่วงแข่ง ก.ค. แล้วค่อยลดไป ${TARGET_WEIGHT} kg ธ.ค.)`}
          className="span-12"
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={ocrBusy} style={{ minHeight: 32, padding: "0 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Upload size={14} />{ocrBusy ? "กำลังอ่านรูป..." : "อัปโหลดรูป"}
              </button>
              <button type="button" onClick={() => setShowForm((s) => !s)} style={{ minHeight: 32, padding: "0 12px", fontSize: 13, background: "transparent", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}>{showForm ? "ปิด" : "กรอกเอง"}</button>
            </div>
          }
        >
          {showForm && (
            <div style={{ marginBottom: 16, padding: 14, border: "1px solid var(--color-line)", borderRadius: 6, background: "var(--color-nav)" }}>
              <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 10px" }}>ตรวจค่าที่อ่านจากรูปก่อนบันทึก — แก้ตรงไหนก็ได้</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {FIELD_DEFS.map((f) => (
                  <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--color-muted)" }}>
                    {f.label}
                    <input
                      type={f.key === "measured_date" ? "date" : "number"}
                      step={f.step}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ minHeight: 34, fontSize: 13 }}
                    />
                  </label>
                ))}
              </div>
              {err && <p style={{ color: "#9d1c37", fontSize: 13, marginTop: 8 }}>{err}</p>}
              <button type="button" onClick={save} disabled={saving} style={{ marginTop: 12, minHeight: 38, padding: "0 18px" }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} />
              <YAxis yAxisId="left" domain={[TARGET_WEIGHT - 2, "dataMax + 2"]} {...chartAxis} />
              <YAxis yAxisId="right" orientation="right" domain={[10, 30]} {...chartAxis} />
              <ChartTooltip />
              <ReferenceLine yAxisId="left" y={TARGET_WEIGHT} stroke={chartColors.muted} strokeDasharray="2 4" label={{ value: `${TARGET_WEIGHT}kg`, position: "insideBottomRight", fontSize: 10, fill: chartColors.muted }} />
              <Line yAxisId="left" dataKey="guide" stroke={chartColors.primary} strokeWidth={2.5} strokeDasharray="7 6" dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }} name="เส้นแนะนำ kg" connectNulls />
              <Line yAxisId="left" dataKey="weight" stroke={chartColors.ink} strokeWidth={3} dot={{ r: 4, fill: chartColors.ink, strokeWidth: 0 }} name="น้ำหนักจริง kg" connectNulls />
              <Line yAxisId="right" dataKey="fat" stroke={chartColors.accent} strokeWidth={2} strokeDasharray="3 4" dot={{ r: 3, fill: chartColors.accent, strokeWidth: 0 }} name="ไขมัน %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
          {rows.length < 2 && <p className="chart-note">บันทึกข้อมูลอย่างน้อย 2 ครั้งเพื่อเห็น trend — เพิ่มทุกเช้าเพื่อติดตามต่อเนื่อง</p>}
        </Panel>

        {latest && (
          <Panel title="องค์ประกอบร่างกายล่าสุด" subtitle={latest.measured_date} className="span-12">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { label: "BMI", value: latest.bmi },
                { label: "คะแนนร่างกาย", value: latest.body_score },
                { label: "มวลไขมัน", value: latest.body_fat_mass_kg, unit: "kg" },
                { label: "Skeletal muscle", value: latest.skeletal_muscle_kg, unit: "kg" },
                { label: "กล้ามเนื้อ", value: latest.muscle_pct, unit: "%" },
                { label: "น้ำในร่างกาย", value: latest.body_water_pct, unit: "%" },
                { label: "โปรตีน", value: latest.protein_mass_kg, unit: "kg" },
                { label: "BMR", value: latest.bmr_kcal, unit: "kcal" },
                { label: "อายุร่างกาย", value: latest.body_age, unit: "ปี" },
                { label: "มวลไร้ไขมัน", value: latest.fat_free_mass_kg, unit: "kg" },
              ].map((m) => (
                <div key={m.label} style={{ padding: "10px 12px", border: "1px solid var(--color-line)", borderRadius: 6, background: "var(--color-panel)" }}>
                  <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{m.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
                    {m.value == null ? "-" : `${m.value}${m.unit ? ` ${m.unit}` : ""}`}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}
