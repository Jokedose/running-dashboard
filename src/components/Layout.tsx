import type { Session } from "@supabase/supabase-js";
import { Box, Button, Typography } from "@mui/material";
import { CalendarRange, Ellipsis, Gauge, Home, LogOut, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
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
  const title = navItems.find((item) => item.key === route)?.label ?? "แดชบอร์ด";
  const [panel, setPanel] = useState<"more" | "profile" | null>(null);
  const email = session.user.email ?? "ผู้ใช้ Supabase";
  const profileInitial = email.trim().slice(0, 1).toUpperCase();
  const tabbarKeys = ["zone2", "race", "plan", "calendar"];
  const moreItems = navItems.filter((item) => !tabbarKeys.includes(item.key));
  const isMoreActive = !tabbarKeys.includes(route);
  const closePanel = () => setPanel(null);

  return (
    <Box className="app-shell">
      <Box component="aside">
        <Box className="app-title">
          <BrandLogo wide />
        </Box>
        <Box className="desktop-nav" component="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a className={route === item.key ? "active" : ""} href={`#/${item.key}`} key={item.key}>
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </Box>
        <Button className="logout" onClick={onLogout} startIcon={<LogOut size={18} />}>
          ออกจากระบบ
        </Button>
      </Box>

      <Box component="main">
        <Box component="header">
          <Box>
            <Typography component="p" variant="body2">
              แดชบอร์ดซ้อมวิ่งส่วนตัว
            </Typography>
            <Typography component="h1" variant="h4">
              {title}
            </Typography>
          </Box>
          <button className="profile-trigger" onClick={() => setPanel(panel === "profile" ? null : "profile")} type="button" aria-label="เปิดโปรไฟล์">
            <span className="profile-avatar" aria-hidden="true">{profileInitial}</span>
            <span className="profile-label">{email}</span>
          </button>
        </Box>
        {children}
      </Box>

      <Box className="mobile-tabbar" component="nav" aria-label="เมนูหลักมือถือ">
        <div className="tab-group left">
          <a className={route === "zone2" ? "active" : ""} href="#/zone2" onClick={closePanel}>
            <Gauge size={20} />
            <span>โซน 2</span>
          </a>
          <a className={route === "race" ? "active" : ""} href="#/race" onClick={closePanel}>
            <Trophy size={20} />
            <span>แข่ง</span>
          </a>
        </div>
        <a className={route === "plan" ? "active primary" : "primary"} href="#/plan" onClick={closePanel}>
          <Home size={24} />
          <span>หน้าหลัก</span>
        </a>
        <div className="tab-group right">
          <a className={route === "calendar" ? "active" : ""} href="#/calendar" onClick={closePanel}>
            <CalendarRange size={20} />
            <span>ปฏิทิน</span>
          </a>
          <button className={isMoreActive || panel === "more" ? "active" : ""} onClick={() => setPanel(panel === "more" ? null : "more")} type="button">
            <Ellipsis size={22} />
            <span>เพิ่มเติม</span>
          </button>
        </div>
      </Box>

      {panel && <button className="mobile-sheet-backdrop" aria-label="ปิดเมนู" onClick={closePanel} type="button" />}

      {panel === "more" && (
        <Box className="mobile-sheet" role="dialog" aria-label="หน้าเพิ่มเติม">
          <div className="sheet-head">
            <div>
              <span>เมนูเพิ่มเติม</span>
              <strong>เลือกหน้าที่ต้องการดู</strong>
            </div>
            <button className="sheet-icon-button" onClick={() => setPanel("profile")} type="button" aria-label="เปิดโปรไฟล์">
              <span className="profile-avatar small" aria-hidden="true">{profileInitial}</span>
            </button>
          </div>
          <div className="sheet-grid">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <a className={route === item.key ? "active" : ""} href={`#/${item.key}`} key={item.key} onClick={closePanel}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        </Box>
      )}

      {panel === "profile" && (
        <Box className="mobile-sheet profile-sheet" role="dialog" aria-label="โปรไฟล์">
          <div className="sheet-head">
            <div>
              <span>โปรไฟล์</span>
              <strong>ข้อมูลผู้ใช้</strong>
            </div>
            <button className="sheet-icon-button" onClick={() => setPanel("more")} type="button" aria-label="เปิดเมนูเพิ่มเติม">
              <Ellipsis size={18} />
            </button>
          </div>
          <div className="profile-card">
            <span className="profile-avatar large" aria-hidden="true">{profileInitial}</span>
            <div>
              <span>เข้าสู่ระบบด้วย</span>
              <strong>{email}</strong>
            </div>
          </div>
          <button className="sheet-logout" onClick={onLogout} type="button">
            <LogOut size={18} />
            ออกจากระบบ
          </button>
        </Box>
      )}
    </Box>
  );
}
