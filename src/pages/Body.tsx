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
const RACE_DAY = "2026-12-06";

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

// Linear regression บนน้ำหนักจริง — ทำนายวันที่ถึงเป้า และน้ำหนักคาดวันแข่ง
function weightProjection(rows: BodyComposition[]) {
  const pts = rows
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ t: Date.parse(`${r.measured_date}T00:00:00Z`), w: r.weight_kg as number }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / 86400000);
  const ys = pts.map((p) => p.w);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom; // kg/วัน
  const intercept = (sy - slope * sx) / n;
  const perWeek = slope * 7;
  const raceX = (Date.parse(`${RACE_DAY}T00:00:00Z`) - t0) / 86400000;
  const raceWeight = intercept + slope * raceX;
  let reachDate: string | null = null;
  if (slope < -0.0001) {
    const reachX = (TARGET_WEIGHT - intercept) / slope;
    if (reachX >= xs[n - 1]) reachDate = new Date(t0 + reachX * 86400000).toISOString().slice(0, 10);
  }
  return { perWeek, raceWeight, reachDate };
}

export function Body({ data, onSaved }: { data: DashboardData; onSaved: () => void }) {
  const rows = data.body;
  const latest = rows[rows.length - 1] ?? null;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ measured_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ocrErr, setOcrErr] = useState<string | null>(null);
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

  const projection = weightProjection(rows);
  const projStatus = (() => {
    if (!projection) return null;
    if (projection.perWeek >= -0.02) return { color: "#7a5300", text: "ยังไม่มีแนวโน้มลด — ปรับ deficit เพิ่ม" };
    if (projection.perWeek < -1.0) return { color: "#9d1c37", text: "ลดเร็วเกินไป (>1 kg/สัปดาห์) เสี่ยงเสียกล้ามเนื้อ" };
    if (projection.reachDate && projection.reachDate <= RACE_DAY) return { color: "#1a6847", text: `on track — น่าจะถึง ${TARGET_WEIGHT} kg ก่อนวันแข่ง` };
    return { color: "#7a5300", text: "ช้ากว่าเป้า — อาจถึง 63 kg หลังวันแข่ง" };
  })();

  async function onUpload(file: File) {
    setOcrBusy(true);
    setOcrErr(null);
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
      if (!res.ok || out.error) {
        // Surface the Claude API status + detail (e.g. 400 bad image) so the
        // modal shows something actionable instead of failing silently.
        const detail = typeof out.detail === "string" ? out.detail.slice(0, 300) : "";
        throw new Error([out.error ?? `OCR failed (${res.status})`, detail].filter(Boolean).join(" — "));
      }
      const parsed = out.data as Record<string, number | string>;
      // Use the date OCR read from the image (top of the screenshot, DD/MM/YYYY →
      // YYYY-MM-DD). Fall back to today only when it's missing or malformed. The
      // user can still edit it before saving.
      const today = new Date().toISOString().slice(0, 10);
      const ocrDate = typeof parsed.measured_date === "string" ? parsed.measured_date.trim() : "";
      const next: Record<string, string> = {
        measured_date: /^\d{4}-\d{2}-\d{2}$/.test(ocrDate) ? ocrDate : today,
      };
      for (const [k, v] of Object.entries(parsed)) {
        if (k === "measured_date") continue;
        if (v != null && v !== "") next[k] = String(v);
      }
      setForm(next);
      setShowForm(true);
    } catch (e) {
      setOcrErr(e instanceof Error ? e.message : "OCR error");
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
      {ocrErr && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOcrErr(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 8, padding: 20, maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#9d1c37" }}>อ่านรูปไม่สำเร็จ</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{ocrErr}</p>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--color-muted)" }}>ลองถ่ายรูปให้ชัดขึ้น/ครอปเฉพาะตาราง หรือกรอกค่าเองได้</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setOcrErr(null); fileRef.current?.click(); }}
                style={{ minHeight: 36, padding: "0 14px", background: "transparent", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
              >
                ลองใหม่
              </button>
              <button type="button" onClick={() => setOcrErr(null)} style={{ minHeight: 36, padding: "0 16px" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

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
          title="Weight · body-fat trend"
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

        {projection && (
          <Panel
            title="Weight projection (regression)"
            subtitle={`อิงแนวโน้มน้ำหนักจริง · เป้า ${TARGET_WEIGHT} kg ภายในวันแข่ง ${RACE_DAY}`}
            className="span-12"
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              <div style={{ padding: "10px 12px", border: "1px solid var(--color-line)", borderRadius: 6, background: "var(--color-panel)" }}>
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>เทรนด์ปัจจุบัน</div>
                <div style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{projection.perWeek >= 0 ? "+" : ""}{projection.perWeek.toFixed(2)} kg/สัปดาห์</div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid var(--color-line)", borderRadius: 6, background: "var(--color-panel)" }}>
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>คาดถึง {TARGET_WEIGHT} kg</div>
                <div style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{projection.reachDate ?? "—"}</div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid var(--color-line)", borderRadius: 6, background: "var(--color-panel)" }}>
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>น้ำหนักวันแข่ง (คาด)</div>
                <div style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{projection.raceWeight.toFixed(1)} kg</div>
              </div>
            </div>
            {projStatus && (
              <p className="chart-note" style={{ marginTop: 12, fontWeight: 700, color: projStatus.color }}>{projStatus.text}</p>
            )}
          </Panel>
        )}

        {latest && (
          <Panel title="Latest body composition" subtitle={latest.measured_date} className="span-12">
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
