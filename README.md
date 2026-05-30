# Running Dashboard

Public GitHub Pages frontend สำหรับดูข้อมูลวิ่งส่วนตัวหลัง login ด้วย Supabase email/password

## Setup

ตั้ง GitHub Actions secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ตั้ง Supabase Auth:

- เปิด Email provider
- ปิด public signup ได้
- เพิ่ม user เฉพาะคนที่อนุญาตใน `Authentication > Users`

เพิ่ม user ที่อนุญาต:

1. เพิ่ม email ใน `Authentication > Users`
2. ตั้ง password ให้ user
3. ใช้ email/password นั้นเข้าสู่ dashboard

ข้อมูลจริงอยู่ใน Supabase หลัง RLS เท่านั้น repo นี้ไม่มี `.fit`, raw Markdown หรือ service role key
