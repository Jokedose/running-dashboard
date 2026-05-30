# Running Dashboard

Public GitHub Pages frontend สำหรับดูข้อมูลวิ่งส่วนตัวหลัง login ผ่าน Supabase Magic Link

## Setup

ตั้ง GitHub Actions secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ตั้ง Supabase Auth redirect URL:

- `https://jokedose.github.io/running-dashboard/`

ข้อมูลจริงอยู่ใน Supabase หลัง RLS เท่านั้น repo นี้ไม่มี `.fit`, raw Markdown หรือ service role key
