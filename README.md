# Running Dashboard

Public GitHub Pages frontend สำหรับดูข้อมูลวิ่งส่วนตัวหลัง login ผ่าน Supabase GitHub OAuth

## Setup

ตั้ง GitHub Actions secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ตั้ง Supabase Auth redirect URL:

- `https://jokedose.github.io/running-dashboard/`

เปิด Supabase Auth provider:

- Enable GitHub provider
- ใส่ GitHub OAuth Client ID/Secret ใน Supabase
- GitHub OAuth callback URL ใช้ค่าที่ Supabase แสดงในหน้า provider
- ปิด public signup ได้ โดย user ที่เข้า dashboard ต้องถูกเพิ่มใน Supabase ก่อนเท่านั้น

เพิ่ม user ที่อนุญาต:

1. เพิ่ม email ใน `Authentication > Users`
2. สร้าง row ใน `profiles` ด้วย `user_id` เดียวกับ Auth user
3. ถ้าไม่มี profile row หน้าเว็บจะ sign out และไม่แสดง dashboard

ข้อมูลจริงอยู่ใน Supabase หลัง RLS เท่านั้น repo นี้ไม่มี `.fit`, raw Markdown หรือ service role key
