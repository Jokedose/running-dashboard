# แดชบอร์ดวิ่ง

เว็บ GitHub Pages สำหรับดูข้อมูลวิ่งส่วนตัวหลังเข้าสู่ระบบด้วยอีเมล/รหัสผ่านของ Supabase

## การตั้งค่า

ตั้ง GitHub Actions secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ตั้ง Supabase Auth:

- เปิดผู้ให้บริการอีเมล
- ปิดการสมัครสมาชิกสาธารณะได้
- เพิ่มผู้ใช้เฉพาะคนที่อนุญาตใน `Authentication > Users`

เพิ่มผู้ใช้ที่อนุญาต:

1. เพิ่มอีเมลใน `Authentication > Users`
2. ตั้งรหัสผ่านให้ผู้ใช้
3. ใช้อีเมล/รหัสผ่านนั้นเข้าสู่แดชบอร์ด

ข้อมูลจริงอยู่ใน Supabase หลัง RLS เท่านั้น คลังนี้ไม่มีไฟล์ `.fit`, Markdown ดิบ หรือ service role key
