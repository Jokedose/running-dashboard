# 📊 Running Dashboard

Personal running dashboard for tracking 10K training — built with Vite + React, deployed on GitHub Pages.

🔗 **Live:** [jokedose.github.io/running-dashboard](https://jokedose.github.io/running-dashboard/)

---

## Pages

| Page | Nav | Content |
| --- | --- | --- |
| **Plan** | 10K แผน | Long-term training phases + planned sessions |
| **Today** | วันนี้ | Daily readiness — Recovery, HRV, Sleep, Load ratio, session recommendation |
| **Calendar** | ปฏิทิน | Training plan schedule + session status |
| **Race** | แข่ง | Race readiness score, 10K projection chart, strengths/risks |
| **Zone 2** | โซน 2 | Zone 2 analysis — drift, decoupling, sweet spot |
| **Pace** | เพซโซน | Pace-zone breakdown per session |
| **Weekly** | สัปดาห์ | Weekly summary — total km, session quality, planned vs actual |
| **Trends** | แนวโน้ม | Long-term trend charts — pace, HR, Z2% |
| **Load** | โหลด | Training load — acute/chronic ratio, HR strain |
| **Injury** | บาดเจ็บ | Active injury status (source of truth: `injury_status` table) + pain history from run logs |
| **Strength** | เวต KB | Kettlebell strength routine + exercise reference |
| **Gear** | รองเท้า | Shoe mileage tracker |
| **Body** | ร่างกาย | Body composition — weight, fat %, muscle mass (OCR intake) |
| **Activities** | กิจกรรม | Run logs — distance, pace, HR, Z2%, drift |

---

## Data

Read-only Supabase client. Tables synced from external repos (run logs, training plan, `injury_status`) or captured in-app (body composition via OCR edge function). RLS: read-own, authenticated.

---

## Tech Stack

React 19 · Vite 7 · MUI v9 · Recharts v3 · Supabase · GitHub Pages

---

## Develop

```bash
bun install
bun run dev        # vite dev server
bun run build      # tsc -b + vite build
bun run typecheck  # tsc -b
```
