import { clamp } from "../utils/data";

export function ProgressBar({ value, label }: { value: number | null | undefined; label?: string }) {
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
