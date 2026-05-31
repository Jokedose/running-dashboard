import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Footprints,
  Gauge,
  HeartPulse,
  LogOut,
  Moon,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
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

type LoadState = "idle" | "loading" | "ready" | "error";

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

const chartMargin = { top: 8, right: 8, bottom: 0, left: -16 };

function pace(value: number | null | undefined) {
  if (!value) return "-";
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

function paceMinutes(value: number | null | undefined) {
  return value ? Number((value / 60).toFixed(2)) : null;
}

function km(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(2)} km`;
}

function minutes(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value)} นาที`;
}

function percent(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

function latest<T>(rows: T[], dateKey: keyof T) {
  return [...rows].sort((a, b) => String(b[dateKey]).localeCompare(String(a[dateKey])))[0];
}

function average(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value: number | null | undefined, min = 0, max = 100) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

function shortDate(date: string | null | undefined) {
  return date ? date.slice(5) : "-";
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
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loginWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage("เข้าสู่ระบบไม่สำเร็จ ตรวจ email/password หรือเพิ่ม user ใน Supabase ก่อน");
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">10K</div>
        <h1>Running Dashboard</h1>
        <p>เข้าสู่ระบบด้วย email/password ของ Supabase user ที่ถูกเพิ่มไว้แล้วเท่านั้น</p>
        {!supabaseConfigured ? (
          <div className="notice">ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY</div>
        ) : (
          <form onSubmit={loginWithPassword}>
            <input
              type="email"
              placeholder="อีเมล Supabase"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
          </form>
        )}
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ComponentType<{ size?: number }>;
  tone?: "neutral" | "good" | "warn" | "hot";
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        {Icon && <Icon size={18} />}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function ProgressBar({ value, label }: { value: number | null | undefined; label?: string }) {
  const width = clamp(value);
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${width}%` }} />
      </div>
      {label && <span>{label}</span>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
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
  const title = navItems.find((item) => item.key === route)?.label ?? "Dashboard";
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
            <p>Private training dashboard</p>
            <h1>{title}</h1>
          </div>
          <span>{session.user.email ?? "Supabase user"}</span>
        </header>
        {children}
      </main>
    </div>
  );
}

function Today({ data }: { data: DashboardData }) {
  const today = latest(data.daily, "log_date");
  const lastRun = latest(data.runs, "run_date");
  const recentRuns = data.runs.slice(-8);
  const totalDistance = data.runs.reduce((sum, run) => sum + (run.distance_km ?? 0), 0);
  const avgZ2 = average(data.runs.map((run) => run.z2_percent));
  const chartRows = recentRuns.map((run) => ({
    date: shortDate(run.run_date),
    distance: run.distance_km ?? 0,
    z2: run.z2_percent ?? null,
  }));

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="Readiness" value={today?.readiness_status ?? "-"} detail={today?.log_date} icon={CheckCircle2} tone="good" />
        <MetricCard label="Recovery" value={today?.recovery_percent == null ? "-" : `${today.recovery_percent}%`} detail="COROS recovery" icon={HeartPulse} />
        <MetricCard label="Sleep" value={today?.sleep_minutes == null ? "-" : minutes(today.sleep_minutes)} detail={today?.sleep_score == null ? undefined : `score ${today.sleep_score}`} icon={Moon} />
        <MetricCard label="ระยะรวม" value={km(totalDistance)} detail={`เฉลี่ย Z2 ${percent(avgZ2)}`} icon={Activity} />
      </div>

      <div className="content-grid">
        <Panel title="แผนล่าสุด" subtitle="คำแนะนำจาก daily readiness" className="span-7">
          <div className="coach-card">
            <strong>{today?.planned_session ?? "-"}</strong>
            <p>{today?.recommendation ?? "-"}</p>
            <div className="chip-row">
              <span>รองเท้า: {today?.recommended_shoe ?? "-"}</span>
              <span>Load ratio: {today?.load_ratio?.toFixed(2) ?? "-"}</span>
              <span>RHR: {today?.resting_hr_bpm ?? "-"} bpm</span>
            </div>
          </div>
        </Panel>

        <Panel title="วิ่งล่าสุด" subtitle={lastRun?.run_date ?? "ยังไม่มี run log"} className="span-5">
          <div className="latest-run">
            <strong>{lastRun?.session_type ?? "-"}</strong>
            <div className="mini-metrics">
              <span>{km(lastRun?.distance_km)}</span>
              <span>{pace(lastRun?.pace_sec_per_km)}</span>
              <span>Z2 {percent(lastRun?.z2_percent)}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Progress snapshot" subtitle="ระยะและ Z2 จาก run logs ล่าสุด" className="span-12">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="distance" fill="#2a7f62" radius={[6, 6, 0, 0]} name="ระยะ km" />
              <Line yAxisId="right" dataKey="z2" stroke="#d63f5f" strokeWidth={2.5} dot={{ r: 3 }} name="Z2 %" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}

function Race({ data }: { data: DashboardData }) {
  const race = data.race;
  const daysLeft = race ? Math.ceil((new Date(race.race_date).getTime() - Date.now()) / 86400000) : null;
  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="Countdown" value={daysLeft == null ? "-" : `${daysLeft} วัน`} detail={race?.race_date} icon={Clock3} tone="hot" />
        <MetricCard label="Readiness" value={race?.readiness_score == null ? "-" : `${race.readiness_score}/100`} detail="race score" icon={Trophy} tone="good" />
        <MetricCard label="Long runs" value={race?.long_runs == null ? "-" : String(race.long_runs)} detail={`longest ${km(race?.longest_distance_km)}`} icon={Activity} />
        <MetricCard label="Quality logs" value={race?.quality_logs == null ? "-" : String(race.quality_logs)} detail={`fastest ${pace(race?.fastest_quality_pace_sec_per_km)}`} icon={Gauge} />
      </div>

      <div className="content-grid">
        <Panel title="Race decision" subtitle="แนวทางวันแข่ง" className="span-12">
          <div className="coach-card race-decision">
            <p>{race?.race_decision ?? "-"}</p>
          </div>
        </Panel>
        <ListPanel title="จุดแข็ง" items={race?.strengths ?? []} className="span-6 good-list" />
        <ListPanel title="ความเสี่ยง" items={race?.risks ?? []} className="span-6 warn-list" />
      </div>
    </section>
  );
}

function Zone2({ data }: { data: DashboardData }) {
  const rows = data.runs
    .filter((run) => run.z2_percent != null || run.pace_sec_per_km != null || run.drift_bpm != null)
    .slice(-20)
    .map((run) => ({
      date: shortDate(run.run_date),
      z2: run.z2_percent ?? null,
      pace: paceMinutes(run.pace_sec_per_km),
      drift: run.drift_bpm ?? null,
      decoupling: run.decoupling_percent ?? null,
    }));
  const latestRun = latest(data.runs, "run_date");
  const avgDrift = average(data.runs.map((run) => run.drift_bpm));

  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="เป้าหมายระยะยาว" value="7:00/km" detail="Zone 2 pace" icon={Gauge} tone="hot" />
        <MetricCard label="Z2 ล่าสุด" value={percent(latestRun?.z2_percent)} detail={latestRun?.run_date} icon={HeartPulse} />
        <MetricCard label="Pace ล่าสุด" value={pace(latestRun?.pace_sec_per_km)} detail={latestRun?.session_type ?? undefined} icon={Clock3} />
        <MetricCard label="Drift เฉลี่ย" value={avgDrift == null ? "-" : `${avgDrift.toFixed(1)} bpm`} detail="เป้าหมาย <= 5 bpm" icon={Activity} />
      </div>

      <div className="content-grid">
        <Panel title="Z2 stability" subtitle="Z2 %, drift และ decoupling" className="span-12">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line dataKey="z2" stroke="#2a7f62" strokeWidth={2.5} dot={{ r: 3 }} name="Z2 %" />
              <Line dataKey="drift" stroke="#d63f5f" strokeWidth={2} dot={false} name="Drift bpm" />
              <Line dataKey="decoupling" stroke="#695d46" strokeWidth={2} dot={false} name="Decoupling %" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Pace trend" subtitle="ค่า pace ยิ่งต่ำยิ่งเร็ว" className="span-12">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis reversed domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} min/km`, "Pace"]} />
              <Area dataKey="pace" stroke="#2a7f62" fill="#d8eee5" strokeWidth={2.5} name="Pace min/km" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}

function Weekly({ data }: { data: DashboardData }) {
  const week = latest(data.weekly, "week_id");
  return (
    <section className="page-stack">
      <div className="metric-grid">
        <MetricCard label="สัปดาห์ล่าสุด" value={week?.week_id ?? "-"} icon={CalendarDays} />
        <MetricCard label="ระยะรวม" value={km(week?.total_distance_km)} icon={Activity} />
        <MetricCard label="เวลารวม" value={minutes(week?.total_duration_min)} icon={Clock3} />
        <MetricCard label="จำนวนครั้ง" value={week?.run_count == null ? "-" : String(week.run_count)} detail={`long ${week?.long_run_count ?? 0} · quality ${week?.quality_count ?? 0}`} icon={CheckCircle2} />
      </div>
      <div className="content-grid">
        <Panel title="Coach recommendation" subtitle="คำแนะนำปรับแผน" className="span-8">
          <div className="coach-card">
            {(week?.coach_recommendation ?? "-").split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Panel>
        <Panel title="Readiness issues" subtitle="ธงเตือนประจำสัปดาห์" className="span-4">
          <div className="issue-card">
            <AlertTriangle size={22} />
            <p>{week?.readiness_issues || "ไม่พบ readiness issue เพิ่มเติม"}</p>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Gear({ data }: { data: DashboardData }) {
  return (
    <section className="page-stack">
      <div className="shoe-grid">
        {data.gear.map((shoe) => (
          <div className="shoe-card" key={shoe.shoe_slug}>
            <div>
              <h2>{shoe.shoe_name ?? shoe.shoe_slug}</h2>
              <p>{shoe.shoe_slug}</p>
            </div>
            <strong>{km(shoe.total_km)}</strong>
            <ProgressBar value={shoe.used_percent} label={`ใช้ไป ${percent(shoe.used_percent)} · เหลือ ${km(shoe.remaining_km)}`} />
            <span className="shoe-status">{shoe.status ?? "ใช้งาน"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Activities({ data }: { data: DashboardData }) {
  return (
    <section className="table-panel">
      <div className="panel-head">
        <div>
          <h2>Run logs</h2>
          <p>รายการวิ่งล่าสุด เรียงจากใหม่ไปเก่า</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ประเภท</th>
              <th>ระยะ</th>
              <th>Pace</th>
              <th>HR</th>
              <th>Z2</th>
              <th>Drift</th>
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
                <td>{run.avg_hr_bpm?.toFixed(1) ?? "-"} bpm</td>
                <td>{percent(run.z2_percent)}</td>
                <td>{run.drift_bpm?.toFixed(1) ?? "-"} bpm</td>
                <td>{run.shoe_slug ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ListPanel({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <ul className="clean-list">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>-</li>}
      </ul>
    </Panel>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <ShieldCheck size={26} />
      <strong>ยังไม่มีข้อมูล dashboard</strong>
      <p>sync Supabase จาก repo private ก่อน แล้วกลับมา refresh หน้านี้</p>
    </div>
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

  const hasData = data.daily.length || data.runs.length || data.weekly.length || data.gear.length || data.race;
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
  if (loadState === "error") return <main className="login-shell">อ่านข้อมูลจาก Supabase ไม่สำเร็จ ตรวจ RLS และ table grants</main>;

  return (
    <Layout session={session} route={route} onLogout={() => supabase.auth.signOut()}>
      {page}
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
