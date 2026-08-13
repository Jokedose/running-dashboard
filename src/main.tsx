import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { Activity, CalendarRange, Cross, Dumbbell, Gauge, HeartPulse, Home as HomeIcon, ShieldCheck, Trophy, TrendingUp, User } from "lucide-react";
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
  StrengthPlan,
  TrainingPhase,
  TrainingPlan,
  WeeklySummary,
} from "./types";
import { emptyData } from "./utils/data";
import { useHashRoute } from "./hooks/useHashRoute";
import { theme } from "./theme";
import "./styles.css";

const navItems: NavItem[] = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "calendar", label: "Calendar", icon: CalendarRange },
  { key: "race", label: "Race", icon: Trophy },
  { key: "zone2", label: "Zone 2", icon: Gauge },
  { key: "reports", label: "Reports", icon: Activity },
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "load", label: "Load", icon: HeartPulse },
  { key: "injury", label: "Injury", icon: Cross },
  { key: "strength", label: "Strength", icon: Dumbbell },
  { key: "profile", label: "Profile", icon: User },
  { key: "activities", label: "Activities", icon: ShieldCheck },
];

const Activities = lazy(() => import("./pages/Activities").then((module) => ({ default: module.Activities })));
const Calendar = lazy(() => import("./pages/Calendar").then((module) => ({ default: module.Calendar })));
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const Race = lazy(() => import("./pages/Race").then((module) => ({ default: module.Race })));
const Reports = lazy(() => import("./pages/Reports").then((module) => ({ default: module.Reports })));
const Trends = lazy(() => import("./pages/Trends").then((module) => ({ default: module.Trends })));
const Zone2 = lazy(() => import("./pages/Zone2").then((module) => ({ default: module.Zone2 })));
const Profile = lazy(() => import("./pages/Profile").then((module) => ({ default: module.Profile })));
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
const DATA_QUERY_LIMIT = 2000; // personal dashboard guardrail; increase with pagination when history exceeds this

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
    try {
      const [daily, runs, weekly, gear, race, plan, strengthPlan, body, monthly, injuries, raceGoals, profile, criteria, gateRules, phases] = await Promise.all([
      supabase.from("daily_readiness").select("*").order("log_date", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("run_logs").select("*").order("run_date", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("weekly_summaries").select("*").order("week_id", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("gear_mileage").select("*").order("shoe_slug", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("race_readiness").select("*").order("race_date", { ascending: false }).limit(DATA_QUERY_LIMIT),
      supabase.from("training_plan").select("*").order("plan_date", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("strength_plan").select("*").order("plan_date", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("body_composition").select("*").order("measured_date", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("monthly_summaries").select("*").order("month", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("injury_status").select("*").order("last_updated_date", { ascending: false }).limit(DATA_QUERY_LIMIT),
      supabase.from("race_goals").select("*").order("race_date", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("runner_profile").select("*").limit(1),
      supabase.from("session_criteria").select("*").order("session_kind", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("readiness_gate_rules").select("*").order("rule_order", { ascending: true }).limit(DATA_QUERY_LIMIT),
      supabase.from("training_phases").select("*").order("sort_order", { ascending: true }).limit(DATA_QUERY_LIMIT),
      ]);
    // hard-fail เฉพาะข้อมูลแกนหลัก — ตารางอื่น error ให้ degrade เป็นค่าว่างแทนที่จะบล็อกทั้งแอป
      if (daily.error || runs.error) {
        setLoadState("error");
        return;
      }
      const softErrors = [
        ["weekly_summaries", weekly.error],
        ["gear_mileage", gear.error],
        ["race_readiness", race.error],
        ["training_plan", plan.error],
        ["strength_plan", strengthPlan.error],
        ["body_composition", body.error],
        ["monthly_summaries", monthly.error],
        ["injury_status", injuries.error],
        ["race_goals", raceGoals.error],
        ["runner_profile", profile.error],
        ["session_criteria", criteria.error],
        ["readiness_gate_rules", gateRules.error],
        ["training_phases", phases.error],
      ].filter((entry) => Boolean(entry[1]));
      if (softErrors.length) console.warn("Optional dashboard data failed to load", softErrors.map(([table, error]) => ({ table, error })));
      lastFetchRef.current = Date.now();
      setData({
      daily: (daily.data ?? []) as DailyReadiness[],
      runs: (runs.data ?? []) as RunLog[],
      weekly: (weekly.data ?? []) as WeeklySummary[],
      gear: (gear.data ?? []) as GearMileage[],
      races: (race.data ?? []) as RaceReadiness[],
      plan: plan.error ? [] : ((plan.data ?? []) as TrainingPlan[]),
      strengthPlan: strengthPlan.error ? [] : ((strengthPlan.data ?? []) as StrengthPlan[]),
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
    } catch {
      setLoadState("error");
    }
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

  const page = useMemo(() => {
    if (!hasData && loadState === "ready") return <EmptyState />;
    if (route === "home") return <Home data={data} />;
    if (route === "calendar") return <Calendar data={data} />;
    if (route === "race") return <Race data={data} />;
    if (route === "zone2") return <Zone2 data={data} />;
    if (route === "reports") return <Reports data={data} />;
    if (route === "trends") return <Trends data={data} />;
    if (route === "load") return <Load data={data} />;
    if (route === "injury") return <Injury data={data} />;
    if (route === "strength") return <Strength data={data} />;
    if (route === "profile") return <Profile data={data} onSaved={fetchData} />;
    if (route === "activities") return <Activities data={data} />;
    return <Home data={data} />;
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
