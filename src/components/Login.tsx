import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
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
    if (error) {
      setMessage("เข้าสู่ระบบไม่สำเร็จ ตรวจอีเมล/รหัสผ่าน หรือเพิ่มผู้ใช้ใน Supabase ก่อน");
    }
  }

  return (
    <main className="login-shell">
      <Stack component="section" className="login-panel">
        <BrandLogo />
        <Typography component="h1" variant="h3">
          แดชบอร์ดวิ่ง
        </Typography>
        <Typography>
          เข้าสู่ระบบด้วยอีเมล/รหัสผ่านของผู้ใช้ Supabase ที่ถูกเพิ่มไว้แล้วเท่านั้น
        </Typography>
        {!supabaseConfigured ? (
          <Alert severity="warning">ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY</Alert>
        ) : (
          <Stack component="form" onSubmit={loginWithPassword} spacing={1.25}>
            <TextField
              type="email"
              label="อีเมล Supabase"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              fullWidth
            />
            <TextField
              type="password"
              label="รหัสผ่าน"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Button disabled={busy} type="submit" variant="contained" color="secondary">
              {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </Stack>
        )}
        {message && <Alert severity="error">{message}</Alert>}
      </Stack>
    </main>
  );
}
