import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { Activity, CalendarCheck, CalendarDays, CalendarRange, Footprints, Gauge, ShieldCheck, Trophy, TrendingUp } from "lucide-react";
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
  TrainingPlan,
  WeeklySummary,
} from "./types";
import { emptyData } from "./utils/data";
import { useHashRoute } from "./hooks/useHashRoute";
import { theme } from "./theme";
import "./styles.css";

const navItems: NavItem[] = [
  { key: "plan", label: "10K แผน", icon: CalendarCheck },
  { key: "today", label: "วันนี้", icon: CalendarDays },
  { key: "calendar", label: "ปฏิทิน", icon: CalendarRange },
  { key: "race", label: "แข่ง", icon: Trophy },
  { key: "zone2", label: "โซน 2", icon: Gauge },
  { key: "weekly", label: "สัปดาห์", icon: Activity },
  { key: "trends", label: "แนวโน้ม", icon: TrendingUp },
  { key: "gear", label: "รองเท้า", icon: Footprints },
  { key: "activities", label: "กิจกรรม", icon: ShieldCheck },
];

const Activities = lazy(() => import("./pages/Activities").then((module) => ({ default: module.Activities })));
const Calendar = lazy(() => import("./pages/Calendar").then((module) => ({ default: module.Calendar })));
const Gear = lazy(() => import("./pages/Gear").then((module) => ({ default: module.Gear })));
const Plan = lazy(() => import("./pages/Plan").then((module) => ({ default: module.Plan })));
const Race = lazy(() => import("./pages/Race").then((module) => ({ default: module.Race })));
const Today = lazy(() => import("./pages/Today").then((module) => ({ default: module.Today })));
const Trends = lazy(() => import("./pages/Trends").then((module) => ({ default: module.Trends })));
const Weekly = lazy(() => import("./pages/Weekly").then((module) => ({ default: module.Weekly })));
const Zone2 = lazy(() => import("./pages/Zone2").then((module) => ({ default: module.Zone2 })));

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="login-shell">
      <Box sx={{ display: "grid", placeItems: "center", gap: 1.5 }}>
        <CircularProgress size={28} />
        {label}
      </Box>
    </main>
  );
}

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
      supabase.from("training_plan").select("*").order("plan_date", { ascending: true }),
    ]).then(([daily, runs, weekly, gear, race, plan]) => {
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
        plan: plan.error ? [] : ((plan.data ?? []) as TrainingPlan[]),
      });
      setLoadState("ready");
    });
  }, [session]);

  const hasData = Boolean(data.daily.length || data.runs.length || data.weekly.length || data.gear.length || data.race || data.plan.length);
  const page = useMemo(() => {
    if (!hasData && loadState === "ready") return <EmptyState />;
    if (route === "plan") return <Plan data={data} />;
    if (route === "today") return <Today data={data} />;
    if (route === "calendar") return <Calendar data={data} />;
    if (route === "race") return <Race data={data} />;
    if (route === "zone2") return <Zone2 data={data} />;
    if (route === "weekly") return <Weekly data={data} />;
    if (route === "trends") return <Trends data={data} />;
    if (route === "gear") return <Gear data={data} />;
    if (route === "activities") return <Activities data={data} />;
    return <Plan data={data} />;
  }, [data, hasData, loadState, route]);

  if (loading) return <LoadingScreen label="กำลังโหลด..." />;
  if (!session) return <Login />;
  if (loadState === "loading") return <LoadingScreen label="กำลังโหลดแดชบอร์ด..." />;
  if (loadState === "error") {
    return <main className="login-shell">อ่านข้อมูลจาก Supabase ไม่สำเร็จ ตรวจ RLS และสิทธิ์ของตาราง</main>;
  }

  return (
    <Layout session={session} route={route} navItems={navItems} onLogout={() => supabase.auth.signOut()}>
      <Suspense fallback={<div className="empty-state">กำลังโหลดหน้า...</div>}>{page}</Suspense>
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);
