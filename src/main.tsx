import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { Activity, CalendarDays, Footprints, Gauge, ShieldCheck, Trophy } from "lucide-react";
import { EmptyState } from "./components/EmptyState";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { supabase, supabaseConfigured } from "./supabase";
import type {
  DailyReadiness,
  DashboardData,
  GearMileage,
  LoadState,
  NavItem,
  RaceReadiness,
  RunLog,
  WeeklySummary,
} from "./types";
import { emptyData } from "./utils/data";
import { useHashRoute } from "./hooks/useHashRoute";
import "./styles.css";

const navItems: NavItem[] = [
  { key: "today", label: "วันนี้", icon: CalendarDays },
  { key: "race", label: "10K", icon: Trophy },
  { key: "zone2", label: "Zone 2", icon: Gauge },
  { key: "weekly", label: "สัปดาห์", icon: Activity },
  { key: "gear", label: "รองเท้า", icon: Footprints },
  { key: "activities", label: "กิจกรรม", icon: ShieldCheck },
];

const Activities = lazy(() => import("./pages/Activities").then((module) => ({ default: module.Activities })));
const Gear = lazy(() => import("./pages/Gear").then((module) => ({ default: module.Gear })));
const Race = lazy(() => import("./pages/Race").then((module) => ({ default: module.Race })));
const Today = lazy(() => import("./pages/Today").then((module) => ({ default: module.Today })));
const Weekly = lazy(() => import("./pages/Weekly").then((module) => ({ default: module.Weekly })));
const Zone2 = lazy(() => import("./pages/Zone2").then((module) => ({ default: module.Zone2 })));

function App() {
  const route = useHashRoute();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setData(emptyData);
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    Promise.all([
      supabase.from("daily_readiness").select("*").order("log_date", { ascending: true }),
      supabase.from("run_logs").select("*").order("run_date", { ascending: true }),
      supabase.from("weekly_summaries").select("*").order("week_id", { ascending: true }),
      supabase.from("gear_mileage").select("*").order("shoe_slug", { ascending: true }),
      supabase.from("race_readiness").select("*").order("race_date", { ascending: false }).limit(1),
    ]).then(([daily, runs, weekly, gear, race]) => {
      if (daily.error || runs.error || weekly.error || gear.error || race.error) {
        setLoadState("error");
        return;
      }

      setData({
        daily: (daily.data ?? []) as DailyReadiness[],
        runs: (runs.data ?? []) as RunLog[],
        weekly: (weekly.data ?? []) as WeeklySummary[],
        gear: (gear.data ?? []) as GearMileage[],
        race: ((race.data ?? [])[0] as RaceReadiness | undefined) ?? null,
      });
      setLoadState("ready");
    });
  }, [session]);

  const hasData = Boolean(data.daily.length || data.runs.length || data.weekly.length || data.gear.length || data.race);
  const page = useMemo(() => {
    if (!hasData && loadState === "ready") return <EmptyState />;
    if (route === "race") return <Race data={data} />;
    if (route === "zone2") return <Zone2 data={data} />;
    if (route === "weekly") return <Weekly data={data} />;
    if (route === "gear") return <Gear data={data} />;
    if (route === "activities") return <Activities data={data} />;
    return <Today data={data} />;
  }, [data, hasData, loadState, route]);

  if (loading) return <main className="login-shell">กำลังโหลด...</main>;
  if (!session) return <Login />;
  if (loadState === "loading") return <main className="login-shell">กำลังโหลด dashboard...</main>;
  if (loadState === "error") {
    return <main className="login-shell">อ่านข้อมูลจาก Supabase ไม่สำเร็จ ตรวจ RLS และ table grants</main>;
  }

  return (
    <Layout session={session} route={route} navItems={navItems} onLogout={() => supabase.auth.signOut()}>
      <Suspense fallback={<div className="empty-state">กำลังโหลดหน้า...</div>}>{page}</Suspense>
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
