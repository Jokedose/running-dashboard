# ตั้งค่า Supabase

รัน `training_plan.sql` ใน Supabase SQL Editor ของโปรเจกต์แดชบอร์ดวิ่ง

SQL นี้จะสร้าง `public.training_plan`, เปิด RLS, ให้สิทธิ์ `select` กับ `authenticated` และใส่แผนซ้อม 10K เริ่มต้นสำหรับหน้า `แผน`

เก็บคีย์สำหรับ local ไว้ใน `.env.local` เท่านั้น และห้าม commit ไฟล์นั้น
