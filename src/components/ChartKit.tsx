import type { ReactNode } from "react";
import { Tooltip } from "recharts";

export const chartColors = {
  ink: "#172026",
  muted: "#657176",
  grid: "#e2e8e3",
  primary: "#2a7f62",
  primarySoft: "#d8eee5",
  accent: "#cf244f",
  blue: "#0b73e0",
  blueSoft: "#d8e9fb",
  amber: "#c98913",
  brown: "#695d46",
} as const;

export const chartMargin = { top: 14, right: 14, bottom: 0, left: -12 };

export const chartAxis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: chartColors.muted, fontSize: 12 },
};

export const chartGrid = {
  stroke: chartColors.grid,
  strokeDasharray: "4 6",
  vertical: false,
};

export function ChartGradientDefs() {
  return (
    <defs>
      <linearGradient id="primaryBar" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.92} />
        <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.46} />
      </linearGradient>
      <linearGradient id="sleepBar" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={chartColors.blue} stopOpacity={0.56} />
        <stop offset="100%" stopColor={chartColors.blueSoft} stopOpacity={0.82} />
      </linearGradient>
      <linearGradient id="paceArea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.34} />
        <stop offset="88%" stopColor={chartColors.primarySoft} stopOpacity={0.08} />
      </linearGradient>
    </defs>
  );
}

type ChartTooltipEntry = {
  color?: string;
  dataKey?: string | number;
  name?: ReactNode;
  value?: ReactNode;
};

type ChartTooltipContentProps = {
  active?: boolean;
  label?: ReactNode;
  payload?: ChartTooltipEntry[];
};

function ChartTooltipContent({ active, payload, label }: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label && <strong>{label}</strong>}
      {payload
        .filter((entry) => entry.value != null)
        .map((entry) => (
          <span key={`${entry.name}-${entry.dataKey}`}>
            <i style={{ background: entry.color ?? chartColors.muted }} />
            {entry.name}: {formatTooltipValue(entry.value)}
          </span>
        ))}
    </div>
  );
}

function formatTooltipValue(value: ReactNode) {
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(1);
  return value;
}

type ChartTooltipProps = React.ComponentProps<typeof Tooltip>;

export function ChartTooltip(props: Omit<ChartTooltipProps, "content">) {
  return <Tooltip cursor={{ stroke: chartColors.grid, strokeWidth: 1 }} content={<ChartTooltipContent />} {...props} />;
}
