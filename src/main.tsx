import { createRoot } from "react-dom/client";
import { Activity, CalendarDays, Footprints, Gauge, LogOut, ShieldCheck, Trophy } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import "./styles.css";

type DailyReadiness = {
  id: string;
  log_date: string;
  readiness_status: string | null;
  recommendation: string | null;
  planned_session: string | null;
  recommended_shoe: string | null;
  recovery_percent: number | null;
  sleep_score: number | null;
  sleep_minutes: number | null;
  hrv_avg_ms: number | null;
  resting_hr_bpm: number | null;
  load_ratio: number | null;
  tags: string[] | null;
};

type RunLog = {
  id: string;
  run_date: string;
  session_type: string | null;
  distance_km: number | null;
  duration_min: number | null;
  pace_sec_per_km: number | null;
  avg_hr_bpm: number | null;
  z2_percent: number | null;
  drift_bpm: number | null;
  decoupling_percent: number | null;
  shoe_slug: string | null;
  rpe: string | null;
  pain: string | null;
  note: string | null;
};

type WeeklySummary = {
  id: string;
  week_id: string;
  total_distance_km: number | null;
  total_duration_min: number | null;
  run_count: number | null;
  long_run_count: number | null;
  quality_count: number | null;
  readiness_issues: string | null;
  coach_recommendation: string | null;
};

type GearMileage = {
  id: string;
  shoe_slug: string;
  shoe_name: string | null;
  total_km: number | null;
  remaining_km: number | null;
  role: string | null;
  status: string | null;
  used_percent: number | null;
};

type RaceReadiness = {
  id: string;
  race_date: string;
  race_name: string;
  readiness_score: number | null;
  activity_records: number | null;
  long_runs: number | null;
  quality_logs: number | null;
  longest_distance_km: number | null;
  fastest_quality_pace_sec_per_km: number | null;
  strengths: string[] | null;
  risks: string[] | null;
  race_decision: string | null;
};

type DashboardData = {
  daily: DailyReadiness[];
  runs: RunLog[];
  weekly: WeeklySummary[];
  gear: GearMileage[];
  race: RaceReadiness | null;
};

const emptyData: DashboardData = {
  daily: [],
  runs: [],
  weekly: [],
  gear: [],
  race: null,
};

const navItems = [
  { key: "today", label: "วันนี้", icon: CalendarDays },
  { key: "race", label: "10K", icon: Trophy },
  { key: "zone2", label: "Zone 2", icon: Gauge },
  { key: "weekly", label: "สัปดาห์", icon: Activity },
  { key: "gear", label: "รองเท้า", icon: Footprints },
  { key: "activities", label: "กิจกรรม", icon: ShieldCheck },
];

function pace(value: number | null | undefined) {
  if (!value) return "-";
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

function km(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(2)} km`;
}

function minutes(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value)} นาที`;
}

function latest<T>(rows: T[], dateKey: keyof T) {
  return [...rows].sort((a, b) => String(b[dateKey]).localeCompare(String(a[dateKey])))[0];
}

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace("#/", "") || "today");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace("#/", "") || "today");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function Login() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const redirectTo = `${window.location.origin}/running-dashboard/`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    setMessage(error ? error.message : "ส่ง Magic Link แล้ว ตรวจอีเมลเพื่อเข้าสู่ dashboard");
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">10K</div>
        <h1>Running Dashboard</h1>
        <p>เข้าสู่ระบบเพื่อดูข้อมูล readiness, Zone 2, แผน 10K และรองเท้าวิ่งส่วนตัว</p>
        {!supabaseConfigured ? (
          <div className="notice">ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY</div>
        ) : (
          <form onSubmit={submit}>
            <input
              type="email"
              placeholder="อีเมล Supabase"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button disabled={busy}>{busy ? "กำลังส่ง..." : "ส่ง Magic Link"}</button>
          </form>
        )}
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Layout({
  session,
  route,
  onLogout,
  children,
}: {
  session: Session;
  route: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside>
        <div className="app-title">
          <span>10K</span>
          <strong>Running</strong>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a className={route === item.key ? "active" : ""} href={`#/${item.key}`} key={item.key}>
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <button className="logout" onClick={onLogout}>
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </aside>
      <main>
        <header>
          <div>
            <p>Private dashboard</p>
            <h1>{navItems.find((item) => item.key === route)?.label ?? "Dashboard"}</h1>
          </div>
          <span>{session.user.email}</span>
        </header>
        {children}
      </main>
    </div>
  );
}

function Today({ data }: { data: DashboardData }) {
  const today = latest(data.daily, "log_date");
  const lastRun = latest(data.runs, "run_date");
  return (
    <section className="dashboard-grid">
      <MetricCard label="Readiness" value={today?.readiness_status ?? "-"} detail={today?.log_date} />
      <MetricCard label="Recovery" value={today?.recovery_percent == null ? "-" : `${today.recovery_percent}%`} />
      <MetricCard label="HRV" value={today?.hrv_avg_ms == null ? "-" : `${today.hrv_avg_ms} ms`} />
      <MetricCard label="Sleep" value={today?.sleep_minutes == null ? "-" : minutes(today.sleep_minutes)} />
      <div className="wide-card">
        <h2>แผนวันนี้</h2>
        <p>{today?.planned_session ?? "-"}</p>
        <p>{today?.recommendation ?? "-"}</p>
        <span>รองเท้า: {today?.recommended_shoe ?? "-"}</span>
      </div>
      <div className="wide-card">
        <h2>วิ่งล่าสุด</h2>
        <p>
          {lastRun?.session_type ?? "-"} · {km(lastRun?.distance_km)} · {pace(lastRun?.pace_sec_per_km)}
        </p>
        <span>Z2 {lastRun?.z2_percent?.toFixed(1) ?? "-"}% · Drift {lastRun?.drift_bpm?.toFixed(1) ?? "-"} bpm</span>
      </div>
    </section>
  );
}

function Race({ data }: { data: DashboardData }) {
  const race = data.race;
  const daysLeft = race ? Math.ceil((new Date(race.race_date).getTime() - Date.now()) / 86400000) : null;
  return (
    <section className="dashboard-grid">
      <MetricCard label="Countdown" value={daysLeft == null ? "-" : `${daysLeft} วัน`} detail={race?.race_date} />
      <MetricCard label="Readiness score" value={race?.readiness_score == null ? "-" : `${race.readiness_score}/100`} />
      <MetricCard label="Long runs" value={race?.long_runs == null ? "-" : String(race.long_runs)} />
      <MetricCard label="Longest run" value={km(race?.longest_distance_km)} />
      <div className="wide-card">
        <h2>Race decision</h2>
        <p>{race?.race_decision ?? "-"}</p>
      </div>
      <ListCard title="Strengths" items={race?.strengths ?? []} />
      <ListCard title="Risks" items={race?.risks ?? []} />
    </section>
  );
}

function Zone2({ data }: { data: DashboardData }) {
  const rows = data.runs
    .filter((run) => run.z2_percent != null || run.pace_sec_per_km != null)
    .slice(-16)
    .map((run) => ({
      date: run.run_date.slice(5),
      z2: run.z2_percent ?? 0,
      pace: run.pace_sec_per_km ? run.pace_sec_per_km / 60 : null,
    }));
  return (
    <section className="dashboard-grid">
      <MetricCard label="เป้าหมายระยะยาว" value="7:00/km" detail="Zone 2 pace" />
      <MetricCard label="Easy runs" value={String(data.runs.filter((run) => run.session_type?.includes("easy")).length)} />
      <div className="chart-card">
        <h2>Z2 trend</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line dataKey="z2" stroke="#e11d48" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Weekly({ data }: { data: DashboardData }) {
  const week = latest(data.weekly, "week_id");
  return (
    <section className="dashboard-grid">
      <MetricCard label="สัปดาห์ล่าสุด" value={week?.week_id ?? "-"} />
      <MetricCard label="ระยะรวม" value={km(week?.total_distance_km)} />
      <MetricCard label="เวลารวม" value={minutes(week?.total_duration_min)} />
      <MetricCard label="จำนวนครั้ง" value={week?.run_count == null ? "-" : String(week.run_count)} />
      <div className="wide-card">
        <h2>Coach recommendation</h2>
        <p>{week?.coach_recommendation ?? "-"}</p>
        <span>{week?.readiness_issues ?? ""}</span>
      </div>
    </section>
  );
}

function Gear({ data }: { data: DashboardData }) {
  return (
    <section className="table-card">
      <h2>Gear mileage</h2>
      <table>
        <thead>
          <tr>
            <th>รองเท้า</th>
            <th>รวม</th>
            <th>เหลือ</th>
            <th>ใช้ไป</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {data.gear.map((shoe) => (
            <tr key={shoe.shoe_slug}>
              <td>{shoe.shoe_name ?? shoe.shoe_slug}</td>
              <td>{km(shoe.total_km)}</td>
              <td>{km(shoe.remaining_km)}</td>
              <td>{shoe.used_percent?.toFixed(1) ?? "-"}%</td>
              <td>{shoe.status ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Activities({ data }: { data: DashboardData }) {
  return (
    <section className="table-card">
      <h2>Run logs</h2>
      <table>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>ประเภท</th>
            <th>ระยะ</th>
            <th>Pace</th>
            <th>Z2</th>
            <th>รองเท้า</th>
          </tr>
        </thead>
        <tbody>
          {[...data.runs].reverse().map((run) => (
            <tr key={run.id}>
              <td>{run.run_date}</td>
              <td>{run.session_type ?? "-"}</td>
              <td>{km(run.distance_km)}</td>
              <td>{pace(run.pace_sec_per_km)}</td>
              <td>{run.z2_percent?.toFixed(1) ?? "-"}%</td>
              <td>{run.shoe_slug ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="wide-card">
      <h2>{title}</h2>
      {items.length ? items.map((item) => <p key={item}>{item}</p>) : <p>-</p>}
    </div>
  );
}

function App() {
  const route = useHashRoute();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
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
      return;
    }
    Promise.all([
      supabase.from("daily_readiness").select("*").order("log_date", { ascending: true }),
      supabase.from("run_logs").select("*").order("run_date", { ascending: true }),
      supabase.from("weekly_summaries").select("*").order("week_id", { ascending: true }),
      supabase.from("gear_mileage").select("*").order("shoe_slug", { ascending: true }),
      supabase.from("race_readiness").select("*").order("race_date", { ascending: false }).limit(1),
    ]).then(([daily, runs, weekly, gear, race]) => {
      setData({
        daily: (daily.data ?? []) as DailyReadiness[],
        runs: (runs.data ?? []) as RunLog[],
        weekly: (weekly.data ?? []) as WeeklySummary[],
        gear: (gear.data ?? []) as GearMileage[],
        race: ((race.data ?? [])[0] as RaceReadiness | undefined) ?? null,
      });
    });
  }, [session]);

  const page = useMemo(() => {
    if (route === "race") return <Race data={data} />;
    if (route === "zone2") return <Zone2 data={data} />;
    if (route === "weekly") return <Weekly data={data} />;
    if (route === "gear") return <Gear data={data} />;
    if (route === "activities") return <Activities data={data} />;
    return <Today data={data} />;
  }, [data, route]);

  if (loading) return <main className="login-shell">กำลังโหลด...</main>;
  if (!session) return <Login />;

  return (
    <Layout session={session} route={route} onLogout={() => supabase.auth.signOut()}>
      {page}
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
