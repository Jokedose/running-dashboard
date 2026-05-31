import { useEffect, useState } from "react";

export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace("#/", "") || "today");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace("#/", "") || "today");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return route;
}
