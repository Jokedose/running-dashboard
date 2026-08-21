# แผนย้าย dashboard ขึ้นโดเมนของตัวเองบน Cloudflare

tags: #deploy #cloudflare #pwa #supabase

สถานะ: **ร่างแผน ยังไม่ลงมือ** — ต้องเลือกข้อ 0 ก่อนถึงจะเริ่มได้

ตอนนี้เว็บอยู่ที่ `jokedose.github.io/running-dashboard/` deploy ด้วย
`.github/workflows/deploy.yml` (GitHub Pages) ทุกครั้งที่ push เข้า main

---

## 0. สองอย่างที่ต้องตัดสินใจก่อน

| หัวข้อ | ตัวเลือก | ผลต่อแผน |
| --- | --- | --- |
| **ที่อยู่** | `run.<domain>` (subdomain) **แนะนำ** · หรือ `<domain>` (root) | ไม่ต่างกันเชิงเทคนิคเลย — แต่ subdomain เก็บ root ไว้ทำอย่างอื่นได้ |
| **ตัว host** | **Cloudflare Pages** (แนะนำ) · หรือ GitHub Pages + custom domain | ต่างกันมาก ดูข้อ 1 |

ทั้งสองทางต้องแก้ `base` path เหมือนกัน (ข้อ 2) เพราะทั้งคู่ย้ายจาก
`/running-dashboard/` ไปอยู่ที่ราก `/` ของโดเมน

---

## 1. เลือกตัว host

### ทางที่แนะนำ — Cloudflare Pages

โดเมนอยู่ที่ Cloudflare อยู่แล้ว การผูกจึงเป็นแค่การเลือกจาก dropdown
ไม่ต้องแตะ DNS เอง ไม่ต้องรอ cert และไม่ต้องคิดเรื่อง proxy

- build เองจาก repo — ไม่ต้องพึ่ง GitHub Pages อีก
- preview deployment ให้ทุก PR อัตโนมัติ (เห็นหน้าเว็บก่อน merge — มีประโยชน์มากกับงานที่ผ่านมาที่ต้องรัน dev server ทุกครั้ง)
- rollback กลับ build ก่อนหน้าได้ในคลิกเดียว
- free tier พอเหลือเฟือสำหรับเว็บส่วนตัว (500 builds/เดือน)

### ทางสำรอง — GitHub Pages + custom domain

เก็บ workflow เดิมไว้ทั้งหมด แค่ชี้ DNS มา แต่มีขั้นตอนที่พลาดง่าย:

- ต้องเพิ่ม `public/CNAME` ที่มีชื่อโดเมนบรรทัดเดียว ไม่งั้น GitHub ลืมค่าทุกครั้งที่ deploy
- ใน Cloudflare DNS ต้อง **ปิด proxy (สีเทา DNS only) ก่อน** จนกว่า GitHub จะออก cert สำเร็จ แล้วค่อยเปิดสีส้ม — ถ้าเปิด proxy ตั้งแต่แรก GitHub จะออก cert ไม่ได้ค้างอยู่แบบนั้น
- SSL/TLS mode ใน Cloudflare ต้องเป็น **Full (strict)** ไม่ใช่ Flexible (Flexible จะทำให้ redirect วนไม่รู้จบ)

> เลือกทางนี้เฉพาะถ้าอยากให้ทุกอย่างเหมือนเดิมที่สุด — ไม่งั้น Pages ดีกว่าชัดเจน

---

## 2. แก้ base path (ทำเหมือนกันทั้งสองทาง)

ตอนนี้ทุกอย่างถูก hardcode ไว้ที่ `/running-dashboard/` เพราะ GitHub Pages
เสิร์ฟใต้ชื่อ repo พอย้ายไปโดเมนของตัวเอง เว็บจะอยู่ที่รากแล้ว

**สามจุดที่ต้องแก้พร้อมกัน** — แก้ไม่ครบแล้วอาการจะแปลก ๆ (หน้าขาว หรือ PWA ติดตั้งไม่ได้)

| ไฟล์ | ตอนนี้ | ต้องเป็น |
| --- | --- | --- |
| `vite.config.ts` | `base: "/running-dashboard/"` | `base: "/"` |
| `public/manifest.webmanifest` | `"start_url": "/running-dashboard/"` | `"start_url": "/"` |
| `public/manifest.webmanifest` | `"scope": "/running-dashboard/"` | `"scope": "/"` |

ข้อดีอย่างหนึ่งของโปรเจกต์นี้: routing เป็น **hash** (`#/reports`) ทั้งหมด
จึงไม่ต้องตั้ง SPA rewrite / `_redirects` ใด ๆ ทุก path ชี้ `index.html` อยู่แล้ว

---

## 3. ตั้ง environment variables

`VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ต้องมีตอน **build**
(vite ฝังค่าเข้า bundle ไม่ได้อ่านตอน runtime) ตอนนี้อยู่ใน GitHub secrets

- **Cloudflare Pages**: Settings → Environment variables → ใส่ทั้งสองตัวใน
  environment **Production และ Preview** (ถ้าใส่แค่ Production หน้า preview ของ PR จะขึ้นหน้า login แล้วล็อกอินไม่ได้)
- ค่า anon key เป็นค่าสาธารณะโดยออกแบบ — ตัวที่กันข้อมูลคือ RLS ที่เปิด
  read-own ไว้ทุกตาราง ไม่ใช่การซ่อน key

---

## 4. ตั้งค่าฝั่ง Supabase

ในหน้า Authentication → URL Configuration ของโปรเจกต์ `vhjhgegoorjorhfsybxp`:

- **Site URL**: `https://<domain ใหม่>`
- **Redirect URLs**: เพิ่ม `https://<domain ใหม่>/**` และเก็บ
  `http://localhost:5173/**` ไว้สำหรับ dev

หน้า login ปัจจุบันใช้ `signInWithPassword` ซึ่งไม่พึ่ง redirect
แต่ `detectSessionInUrl: true` ถูกเปิดไว้ใน `src/supabase.ts` — วันไหนเปลี่ยนไปใช้
magic link หรือ OAuth แล้วไม่ได้ตั้งไว้ จะเจออาการล็อกอินแล้วเด้งกลับหน้าเดิมเงียบ ๆ
ตั้งตอนนี้ทีเดียวจบ

---

## 5. เรื่อง PWA ที่จะเจอแน่ ๆ

เว็บนี้ลง service worker ไว้ (`vite-plugin-pwa`, `registerType: autoUpdate`)
เครื่องที่เคยเปิด `jokedose.github.io/running-dashboard/` จะยังมี SW เก่าค้างอยู่
ซึ่ง **ไม่หายไปเองเมื่อย้ายโดเมน** เพราะ SW ผูกกับ origin เดิม

- โดเมนใหม่จะลง SW ของตัวเองแยกกัน ไม่ชนกัน — ใช้งานได้ทันที
- แต่ถ้าเคย "Add to Home Screen" จากที่อยู่เดิมไว้ ไอคอนนั้นจะยังชี้ github.io ต่อไป
  ต้องลบแล้วติดตั้งใหม่จากโดเมนใหม่เอง
- `cleanupOutdatedCaches: true` ตั้งไว้แล้ว จึงไม่ต้องกังวลเรื่อง cache ค้างข้ามเวอร์ชันบนโดเมนใหม่

---

## 6. ลำดับการลงมือ

1. เลือกข้อ 0 (ที่อยู่ + host)
2. เปิด branch แก้ base path 3 จุดตามข้อ 2 → เปิด PR **แต่ยังไม่ merge**
3. ตั้ง Cloudflare Pages: เชื่อม repo, build command `bun run build`, output `dist`, ใส่ env vars ตามข้อ 3
4. กด deploy ครั้งแรกบน URL ชั่วคราวของ Pages (`*.pages.dev`) — เช็คว่า
   หน้าเว็บขึ้น, ล็อกอินได้, ข้อมูลมาครบ ก่อนผูกโดเมนจริง
5. ผูก custom domain แล้วตั้งค่า Supabase ตามข้อ 4
6. merge PR ข้อ 2
7. เก็บ GitHub Pages ไว้อีกสักพัก (ยังใช้ได้ ไม่ชนกัน) แล้วค่อยตัดสินใจว่าจะปิด
   workflow เดิมหรือปล่อยไว้เป็นสำรอง

---

## 7. สิ่งที่ต้องเช็คหลัง deploy

- [ ] เปิดโดเมนใหม่แล้วขึ้นหน้า login (ไม่ใช่หน้าขาว — หน้าขาวมักแปลว่า base path ผิด)
- [ ] ล็อกอินผ่าน แล้วข้อมูลขึ้นครบทุกหน้า
- [ ] เปิด DevTools → Console ไม่มี error โดยเฉพาะ `Optional dashboard data failed to load`
- [ ] แท็บพลังงานใน Reports มีข้อมูล และ Activities มีคอลัมน์พลังงาน
- [ ] เปิดบนมือถือ → Add to Home Screen ได้ และเปิดแบบ standalone
- [ ] ทุก path ที่ bookmark ไว้ยังใช้ได้ (`#/reports`, `#/energy` ที่ alias ไป Reports)
- [ ] กด deploy ซ้ำแล้วเว็บอัปเดตจริง (SW autoUpdate ทำงาน)

---

## ค่าที่ต้องเติมก่อนเริ่ม

- โดเมนที่ซื้อไว้: `__________`
- จะใช้ root หรือ subdomain: `__________`
- host ที่เลือก: `__________`
