import type { ComponentType } from "react";
import { Card, Stack, Typography } from "@mui/material";

/**
 * MetricCard — อัปเดต v2
 * เพิ่ม: icon chip พื้นสีตาม tone, trend pill, ตัวเลขใหญ่ขึ้น (24px/750),
 * และ hover ยกตัวเบา ๆ ผ่าน CSS class `metric-card--interactive`
 */
export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  trend,
  trendTone = "good",
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ComponentType<{ size?: number }>;
  tone?: "neutral" | "good" | "warn" | "hot";
  /** ข้อความ trend เช่น "↑ 3 ms" หรือ "คงที่" */
  trend?: string;
  /** สีของ trend pill — default "good" */
  trendTone?: "good" | "warn" | "hot" | "neutral";
}) {
  return (
    <Card className={`metric-card metric-card--interactive ${tone}`} variant="outlined">
      <div className="metric-top">
        <Typography component="span" variant="body2">
          {label}
        </Typography>
        {Icon && (
          <span className={`metric-icon-chip ${tone}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      <Stack spacing={0.5}>
        <Typography component="strong" className="metric-value">
          {value}
        </Typography>
        <div className="metric-bottom">
          {trend && (
            <span className={`metric-trend ${trendTone}`}>{trend}</span>
          )}
          {detail && (
            <Typography component="small" variant="caption">
              {detail}
            </Typography>
          )}
        </div>
      </Stack>
    </Card>
  );
}
