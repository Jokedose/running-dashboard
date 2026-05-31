import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { NavItem } from "../types";

export function Layout({
  session,
  route,
  navItems,
  onLogout,
  children,
}: {
  session: Session;
  route: string;
  navItems: NavItem[];
  onLogout: () => void;
  children: ReactNode;
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
