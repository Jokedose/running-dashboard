import type { ReactNode } from "react";
import { Paper, Typography } from "@mui/material";

export function Panel({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Paper component="section" className={`panel ${className}`} variant="outlined">
      <div className="panel-head">
        <div>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          {subtitle && <Typography variant="body2">{subtitle}</Typography>}
        </div>
        {action}
      </div>
      {children}
    </Paper>
  );
}

export function ListPanel({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <ul className="clean-list">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>-</li>}
      </ul>
    </Panel>
  );
}
