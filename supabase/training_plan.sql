-- รันไฟล์นี้ใน Supabase SQL Editor ของโปรเจกต์แดชบอร์ดวิ่ง
-- ไฟล์นี้สร้างตารางแผนซ้อมที่ใช้กับหน้า "แผน" ของแอป

create table if not exists public.training_plan (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  week_id text,
  title text not null,
  session_type text,
  target_distance_km numeric(6,2),
  target_duration_min integer,
  target_pace_sec_per_km integer,
  intensity text,
  planned_shoe text,
  priority text default 'normal' check (priority in ('low', 'normal', 'high', 'race')),
  status text default 'planned' check (status in ('planned', 'done', 'skipped', 'adjusted')),
  notes text,
  created_at timestamptz default now(),
  unique (plan_date, title)
);

alter table public.training_plan enable row level security;

drop policy if exists "Authenticated users can read training plan" on public.training_plan;

create policy "Authenticated users can read training plan"
  on public.training_plan
  for select
  to authenticated
  using (true);

grant select on table public.training_plan to authenticated;

create index if not exists training_plan_plan_date_idx on public.training_plan (plan_date);
create index if not exists training_plan_week_id_idx on public.training_plan (week_id);

insert into public.training_plan (
  plan_date,
  week_id,
  title,
  session_type,
  target_distance_km,
  target_duration_min,
  target_pace_sec_per_km,
  intensity,
  planned_shoe,
  priority,
  status,
  notes
) values
  ('2026-06-04', '2026-W23', 'วิ่งเบาฟื้นตัว + ยืดเหยียด', 'วิ่งเบา', 4.00, 42, 630, 'Z2 เบา', 'รองเท้าซ้อมประจำวัน', 'normal', 'planned', 'คุมหัวใจให้นิ่ง แล้วปิดท้ายด้วย การเคลื่อนไหว 8 นาที'),
  ('2026-06-05', '2026-W23', 'พัก / เดินเบา', 'ฟื้นตัว', null, 30, null, 'เบามาก', null, 'low', 'planned', 'เดินได้ถ้าขายังสด ไม่ต้องฝืนซ้อม'),
  ('2026-06-06', '2026-W23', 'วิ่งยาว Z2', 'วิ่งยาว', 8.00, 84, 630, 'Z2', 'รองเท้าซ้อมประจำวัน', 'high', 'planned', 'ซ้อมหลักของสัปดาห์ เป้า การไหลของหัวใจไม่เกิน 5 bpm ไม่ไล่เพซ'),
  ('2026-06-08', '2026-W24', 'วิ่งเบา + สไตรด์', 'วิ่งเบา', 5.00, 50, 600, 'Z2 + สไตรด์', 'รองเท้าเบา', 'normal', 'planned', 'ปิดท้ายด้วย สไตรด์ผ่อนคลาย 4 x 20 วินาที'),
  ('2026-06-10', '2026-W24', 'เทมโปเป็นช่วง', 'ซ้อมคุณภาพ', 6.00, 60, 555, 'เทมโป', 'รองเท้าเบา', 'high', 'planned', '3 x 6 นาทีแบบหนักพอคุมได้ ไม่หลุดฟอร์ม'),
  ('2026-06-12', '2026-W24', 'จ็อกฟื้นตัว', 'ฟื้นตัว', 3.50, 38, 650, 'เบา', 'รองเท้าซ้อมประจำวัน', 'low', 'planned', 'ใช้เช็กความสดก่อนวิ่งยาว'),
  ('2026-06-14', '2026-W24', 'วิ่งยาวไล่ระดับ', 'วิ่งยาว', 9.00, 92, 615, 'Z2 นิ่ง', 'รองเท้าซ้อมประจำวัน', 'high', 'planned', 'ถ้าการไหลของหัวใจยังนิ่ง ค่อยเพิ่มความเร็ว 10 นาทีท้าย'),
  ('2026-06-17', '2026-W25', 'ซ้อมจังหวะ 10K', 'ซ้อมคุณภาพ', 7.00, 68, 540, 'เฉพาะทางวันแข่ง', 'รองเท้าเบา', 'high', 'planned', '2 กม. เบา, 3 กม. จังหวะเป้า, 2 กม. เบา'),
  ('2026-06-21', '2026-W25', 'วิ่งยาวที่สุดก่อนแข่ง', 'วิ่งยาว', 10.00, 105, 630, 'Z2', 'รองเท้าซ้อมประจำวัน', 'high', 'planned', 'สร้างความมั่นใจ คุมให้อยู่ในแอโรบิก'),
  ('2026-07-19', '2026-W29', 'วันแข่ง 10K', 'แข่ง', 10.00, 90, 540, 'แข่ง', 'รองเท้าวันแข่ง', 'race', 'planned', 'เป้า 1:30:00 เริ่มนิ่ง แล้วค่อยเร่งหลัง 6K')
on conflict (plan_date, title) do update set
  week_id = excluded.week_id,
  session_type = excluded.session_type,
  target_distance_km = excluded.target_distance_km,
  target_duration_min = excluded.target_duration_min,
  target_pace_sec_per_km = excluded.target_pace_sec_per_km,
  intensity = excluded.intensity,
  planned_shoe = excluded.planned_shoe,
  priority = excluded.priority,
  status = excluded.status,
  notes = excluded.notes;
