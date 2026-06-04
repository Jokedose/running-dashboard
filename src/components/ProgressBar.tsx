import { LinearProgress, Typography } from "@mui/material";
import { clamp } from "../utils/data";

export function ProgressBar({ value, label }: { value: number | null | undefined; label?: string }) {
  const width = clamp(value);
  return (
    <div className="progress-wrap">
      <LinearProgress
        className="progress-track"
        variant="determinate"
        value={width}
        sx={{ height: 10, borderRadius: 1 }}
      />
      {label && (
        <Typography component="span" variant="caption">
          {label}
        </Typography>
      )}
    </div>
  );
}
