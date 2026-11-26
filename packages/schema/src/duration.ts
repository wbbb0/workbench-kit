import type { DurationTimescale } from "./types.js";

export interface DurationUnit {
  timescale: DurationTimescale;
  label: string;
  scale: number;
}

export const DURATION_UNITS: readonly DurationUnit[] = [
  { timescale: "ms", label: "毫秒", scale: 1 },
  { timescale: "s", label: "秒", scale: 1000 },
  { timescale: "min", label: "分钟", scale: 60000 },
  { timescale: "h", label: "小时", scale: 3600000 },
  { timescale: "d", label: "天", scale: 86400000 },
];

export const DURATION_SCALES: Readonly<Record<DurationTimescale, number>> = {
  ms: 1,
  s: 1000,
  min: 60000,
  h: 3600000,
  d: 86400000,
};

export function formatDurationValue(
  ms: number,
  preferred?: DurationTimescale,
): string {
  if (!Number.isFinite(ms)) return "";
  const unit =
    (preferred && DURATION_UNITS.find((entry) => entry.timescale === preferred)) ??
    DURATION_UNITS[0]!;
  const value = ms / unit.scale;
  const formatted = Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(3)));
  return `${formatted}${unit.label}`;
}
