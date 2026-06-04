import type { Session } from "@supabase/supabase-js";
import { Box, Button, Typography } from "@mui/material";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
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
  const title = navItems.find((item) => item.key === route)?.label ?? "Dashboard";

  return (
    <Box className="app-shell">
      <Box component="aside">
        <Box className="app-title">
          <BrandLogo compact />
          <Typography component="strong">วิ่ง</Typography>
        </Box>
        <Box component="nav">
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
          <Typography component="span" variant="body2">
            {session.user.email ?? "ผู้ใช้ Supabase"}
          </Typography>
        </Box>
        {children}
      </Box>
    </Box>
  );
}
