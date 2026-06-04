import type { ComponentType } from "react";
import { Card, Stack, Typography } from "@mui/material";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ComponentType<{ size?: number }>;
  tone?: "neutral" | "good" | "warn" | "hot";
}) {
  return (
    <Card className={`metric-card ${tone}`} variant="outlined">
      <div className="metric-top">
        <Typography component="span" variant="body2">
          {label}
        </Typography>
        {Icon && <Icon size={18} />}
      </div>
      <Stack spacing={0.5}>
        <Typography component="strong" variant="h5">
          {value}
        </Typography>
        {detail && (
          <Typography component="small" variant="caption">
            {detail}
          </Typography>
        )}
      </Stack>
    </Card>
  );
}
