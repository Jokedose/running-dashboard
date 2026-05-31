import type { FormEvent } from "react";
import { useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { supabase, supabaseConfigured } from "../supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loginWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage("เข้าสู่ระบบไม่สำเร็จ ตรวจ email/password หรือเพิ่ม user ใน Supabase ก่อน");
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <BrandLogo />
        <h1>Running Dashboard</h1>
        <p>เข้าสู่ระบบด้วย email/password ของ Supabase user ที่ถูกเพิ่มไว้แล้วเท่านั้น</p>
        {!supabaseConfigured ? (
          <div className="notice">ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY</div>
        ) : (
          <form onSubmit={loginWithPassword}>
            <input
              type="email"
              placeholder="อีเมล Supabase"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
          </form>
        )}
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}
