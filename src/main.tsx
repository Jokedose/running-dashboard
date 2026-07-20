import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { Activity, CalendarCheck, CalendarDays, CalendarRange, Cross, Dumbbell, Footprints, Gauge, HeartPulse, Scale, ShieldCheck, Trophy, TrendingUp } from "lucide-react";
import { EmptyState } from "./components/EmptyState";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { supabase, supabaseConfigured } from "./supabase";
import type {
  BodyComposition,
  DailyReadiness,
  DashboardData,
  GearMileage,
  InjuryStatus,
  LoadState,
  MonthlySummary,
  NavItem,
  RaceGoal,
  RaceReadiness,
  ReadinessGateRule,
  RunLog,
  RunnerProfile,
  SessionCriteria,
  TrainingPhase,
  TrainingPlan,
  WeeklySummary,
} from "./types";
import { emptyData, resolveCurrentRaceGoal, todayIso } from "./utils/data";
import { raceShortLabel } from "./utils/context";
import { useHashRoute } from "./hooks/useHashRoute";
import { theme } from "./theme";
import "./styles.css";

// label ของเมนู plan ถูกแทนด้วยชื่อแข่งถัดไปจาก race_goals ตอน runtime (ดู navItems ใน App)
const baseNavItems: NavItem[] = [
  { key: "plan", label: "Plan", icon: CalendarCheck },
  { key: "today", label: "Today", icon: CalendarDays },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "race", label: "Race", icon: Trophy },
  { key: "zone2", label: "Zone 2", icon: Gauge },
  { key: "weekly", label: "Weekly", icon: Activity },
  // { key: "monthly", label: "Monthly", icon: CalendarRange }, // ซ่อนชั่วคราว
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "load", label: "Load", icon: HeartPulse },
  { key: "injury", label: "Injury", icon: Cross },
  { key: "strength", label: "Strength", icon: Dumbbell },
  { key: "gear", label: "Gear", icon: Footprints },
  { key: "body", label: "Body", icon: Scale },
  { key: "activities", label: "Activities", icon: ShieldCheck },
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
const Body = lazy(() => import("./pages/Body").then((module) => ({ default: module.Body })));
const Monthly = lazy(() => import("./pages/Monthly").then((module) => ({ default: module.Monthly })));
const Load = lazy(() => import("./pages/Load").then((module) => ({ default: module.Load })));
const Injury = lazy(() => import("./pages/Injury").then((module) => ({ default: module.Injury })));
const Strength = lazy(() => import("./pages/Strength").then((module) => ({ default: module.Strength })));

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

const DATA_STALE_MS = 30 * 60 * 1000; // re-fetch หลัง 30 นาที

function App() {
  const route = useHashRoute();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  async function fetchData() {
    setLoadState("loading");
    const [daily, runs, weekly, gear, race, plan, body, monthly, injuries, raceGoals, profile, criteria, gateRules, phases] = await Promise.all([
      supabase.from("daily_readiness").select("*").order("log_date", { ascending: true }),
      supabase.from("run_logs").select("*").order("run_date", { ascending: true }),
      supabase.from("weekly_summaries").select("*").order("week_id", { ascending: true }),
      supabase.from("gear_mileage").select("*").order("shoe_slug", { ascending: true }),
      supabase.from("race_readiness").select("*").order("race_date", { ascending: false }),
      supabase.from("training_plan").select("*").order("plan_date", { ascending: true }),
      supabase.from("body_composition").select("*").order("measured_date", { ascending: true }),
      supabase.from("monthly_summaries").select("*").order("month", { ascending: true }),
      supabase.from("injury_status").select("*").order("last_updated_date", { ascending: false }),
      supabase.from("race_goals").select("*").order("race_date", { ascending: true }),
      supabase.from("runner_profile").select("*").limit(1),
      supabase.from("session_criteria").select("*").order("session_kind", { ascending: true }),
      supabase.from("readiness_gate_rules").select("*").order("rule_order", { ascending: true }),
      supabase.from("training_phases").select("*").order("sort_order", { ascending: true }),
    ]);
    // hard-fail เฉพาะข้อมูลแกนหลัก — ตารางอื่น error ให้ degrade เป็นค่าว่างแทนที่จะบล็อกทั้งแอป
    if (daily.error || runs.error) {
      setLoadState("error");
      return;
    }
    lastFetchRef.current = Date.now();
    setData({
      daily: (daily.data ?? []) as DailyReadiness[],
      runs: (runs.data ?? []) as RunLog[],
      weekly: (weekly.data ?? []) as WeeklySummary[],
      gear: (gear.data ?? []) as GearMileage[],
      races: (race.data ?? []) as RaceReadiness[],
      plan: plan.error ? [] : ((plan.data ?? []) as TrainingPlan[]),
      body: body.error ? [] : ((body.data ?? []) as BodyComposition[]),
      monthly: monthly.error ? [] : ((monthly.data ?? []) as MonthlySummary[]),
      injuries: injuries.error ? [] : ((injuries.data ?? []) as InjuryStatus[]),
      raceGoals: raceGoals.error ? [] : ((raceGoals.data ?? []) as RaceGoal[]),
      profile: profile.error ? null : (((profile.data ?? [])[0] as RunnerProfile | undefined) ?? null),
      criteria: criteria.error ? [] : ((criteria.data ?? []) as SessionCriteria[]),
      gateRules: gateRules.error ? [] : ((gateRules.data ?? []) as ReadinessGateRule[]),
      phases: phases.error ? [] : ((phases.data ?? []) as TrainingPhase[]),
    });
    setLoadState("ready");
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      // validate session กับ server ทุกครั้งที่ refresh (getSession อ่านแค่ localStorage)
      // ถ้า session ถูก revoke (เช่น login เครื่องอื่น) → เตะออกทันทีตอน refresh
      if (sessionData.session) {
        const { error } = await supabase.auth.getUser();
        if (error) {
          await supabase.auth.signOut();
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(sessionData.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const newToken = nextSession?.access_token ?? null;
      // อัพเดท session เฉพาะเมื่อ token เปลี่ยนจริง (ไม่ใช่แค่ object reference ใหม่)
      if (newToken !== tokenRef.current) {
        tokenRef.current = newToken;
        setSession(nextSession);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // auth guard: เช็ค user ทุก 15 นาที + ทุกครั้ง tab focus
  useEffect(() => {
    if (!session) return;

    async function checkUser() {
      const { error } = await supabase.auth.getUser();
      if (error) await supabase.auth.signOut();
    }

    const interval = setInterval(checkUser, 15 * 60 * 1000);

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      checkUser();
      // re-fetch ข้อมูลเฉพาะเมื่อ stale
      if (Date.now() - lastFetchRef.current > DATA_STALE_MS) fetchData();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session]);

  // fetch ครั้งแรกเมื่อ login หรือ token เปลี่ยน
  useEffect(() => {
    if (!session) {
      setData(emptyData);
      setLoadState("idle");
      lastFetchRef.current = 0;
      return;
    }
    fetchData();
  }, [session]);

  const hasData = Boolean(data.daily.length || data.runs.length || data.weekly.length || data.gear.length || data.races.length || data.plan.length || data.body.length);

  // เมนู plan ใช้ชื่อแข่งถัดไป (เช่น "Allianz 10K") — เปลี่ยนเองเมื่อ race goal เปลี่ยน
  const navItems = useMemo(() => {
    const label = raceShortLabel(resolveCurrentRaceGoal(data.raceGoals, todayIso()));
    return baseNavItems.map((item) => (item.key === "plan" && label ? { ...item, label: `${label} Plan` } : item));
  }, [data.raceGoals]);

  const page = useMemo(() => {
    if (!hasData && loadState === "ready") return <EmptyState />;
    if (route === "plan") return <Plan data={data} />;
    if (route === "today") return <Today data={data} />;
    if (route === "calendar") return <Calendar data={data} />;
    if (route === "race") return <Race data={data} />;
    if (route === "zone2") return <Zone2 data={data} />;
    if (route === "weekly") return <Weekly data={data} />;
    if (route === "monthly") return <Monthly data={data} />;
    if (route === "trends") return <Trends data={data} />;
    if (route === "load") return <Load data={data} />;
    if (route === "injury") return <Injury data={data} />;
    if (route === "strength") return <Strength data={data} />;
    if (route === "gear") return <Gear data={data} />;
    if (route === "body") return <Body data={data} onSaved={fetchData} />;
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
