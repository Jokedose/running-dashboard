# 📊 Running Dashboard

Web dashboard สำหรับติดตามผลการวิ่งส่วนตัว — build ด้วย Vite + React, deploy บน GitHub Pages, ข้อมูลผ่าน Supabase (auth + RLS)

🔗 **Live:** [jokedose.github.io/running-dashboard](https://jokedose.github.io/running-dashboard/)
📦 **Data source:** [running-results](https://github.com/Jokedose/running-results) (private repo)

---

## 📄 หน้า Dashboard

| หน้า | ข้อมูลที่แสดง |
| --- | --- |
| **Today** | Readiness วันนี้ — Recovery, HRV, Sleep, Load ratio, คำแนะนำซ้อม |
| **Calendar** | ตารางซ้อมรายวันจาก training plan + สถานะ (done / upcoming / skipped) |
| **Activities** | Run logs ทั้งหมด — ระยะ, pace, HR, Z2%, drift |
| **Race** | Race readiness score, กราฟ projection 10K, จุดแข็ง/ความเสี่ยง |
| **Weekly** | สรุปรายสัปดาห์ — km รวม, คุณภาพ session, planned vs actual |
| **Trends** | กราฟพัฒนาการระยะยาว — pace, HR, Z2% |
| **Zone 2** | วิเคราะห์ Zone 2 รายครั้ง — drift, decoupling, sweet spot |
| **Gear** | Mileage รองเท้าแต่ละคู่ |
| **Plan** | แผนซ้อมระยะยาว Phase A–E |

---

## 🛠 Tech Stack

| | |
| --- | --- |
| Framework | React + Vite |
| UI | MUI (Material UI) + Recharts |
| Auth | Supabase GitHub OAuth + RLS |
| Deploy | GitHub Pages (GitHub Actions) |
| Data sync | `scripts/sync_to_supabase.py` (running-results repo) |

---

## ⚙️ Setup

### 1. GitHub Actions Secrets

ตั้งใน `Settings > Secrets and variables > Actions`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 2. Supabase Auth

- Provider: GitHub OAuth
- เพิ่ม Redirect URL: `https://jokedose.github.io/running-dashboard/`
- RLS เปิดทุก table — ข้อมูลจะอ่านได้เฉพาะ user ที่ login แล้ว

### 3. Local Dev

```bash
bun install
bun dev
```

---

## 🗄 Supabase Tables

| Table | ข้อมูล |
| --- | --- |
| `daily_readiness` | Recovery, HRV, Sleep, Load ratio รายวัน |
| `run_logs` | Run logs รายครั้ง (pace, HR, zones, drift) |
| `training_plan` | Schedule รายวัน + สถานะ |
| `weekly_summaries` | สรุปรายสัปดาห์ |
| `race_readiness` | Race readiness score + strengths/risks |
| `gear_mileage` | Mileage รองเท้าแต่ละคู่ |

Schema: `supabase/migrations/` ใน running-results repo

---

## 🔒 Security

- ไม่มีไฟล์ `.fit`, GPS/route data หรือ raw Markdown ในนี้
- ไม่มี `SUPABASE_SERVICE_ROLE_KEY` — ใช้แค่ `ANON_KEY` + RLS
- ข้อมูลทั้งหมดอ่านผ่าน Supabase RLS เท่านั้น
