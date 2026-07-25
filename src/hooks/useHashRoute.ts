import { useEffect, useState } from "react";

export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace("#/", "") || "plan");

  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash.replace("#/", "") || "plan");
      // เปิดหน้าใหม่ต้องเริ่มบนสุดเสมอ ไม่ค้าง scroll position จากหน้าก่อน
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return route;
}
