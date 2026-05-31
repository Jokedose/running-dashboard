export function pace(value: number | null | undefined) {
  if (!value) return "-";
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

export function paceMinutes(value: number | null | undefined) {
  return value ? Number((value / 60).toFixed(2)) : null;
}

export function km(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(2)} km`;
}

export function minutes(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value)} นาที`;
}

export function percent(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

export function shortDate(date: string | null | undefined) {
  return date ? date.slice(5) : "-";
}
