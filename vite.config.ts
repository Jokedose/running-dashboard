import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/running-dashboard/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // ใช้ manifest เดิมใน public/ + <link> ใน index.html (ไม่ให้ plugin สร้างซ้ำ)
      manifest: false,
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,jpg,png,webmanifest}"],
        // app-shell offline; ข้อมูล Supabase ยังต้องออนไลน์
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /supabase/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // แยก vendor chunk เพื่อลด index.js ก้อนเดียว 639kB + cache ดีขึ้น
        manualChunks: {
          mui: ["@mui/material", "@emotion/react", "@emotion/styled"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
