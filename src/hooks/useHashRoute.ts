import { useEffect, useState } from "react";

// หน้าที่ย้ายไปเป็นแท็บของหน้าอื่นแล้ว — ลิงก์/bookmark เก่าต้องยังเปิดได้
// และต้องได้ชื่อหน้าที่ถูกต้องบนหัวเรื่องด้วย ไม่ใช่ fallback เป็น "Dashboard"
const ROUTE_ALIASES: Record<string, string> = { energy: "reports" };

function readRoute() {
  const raw = window.location.hash.replace("#/", "") || "home";
  return ROUTE_ALIASES[raw] ?? raw;
}

export function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      // เปิดหน้าใหม่ต้องเริ่มบนสุดเสมอ ไม่ค้าง scroll position จากหน้าก่อน
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return route;
}
