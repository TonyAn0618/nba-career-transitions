import type { SeasonRow } from "./types.ts";

export type Metric = "share" | "fg";
export type RingLayout = "rings" | "dial" | "both";

export const tealScale = [
  [45, 75, 75],
  [61, 128, 124],
  [99, 175, 161],
  [157, 210, 186],
  [225, 237, 202],
];

export function colorAt(value: number) {
  const position = Math.max(0, Math.min(1, value)) * (tealScale.length - 1);
  const stop = Math.min(Math.floor(position), tealScale.length - 2);
  const rgb = tealScale[stop].map((channel, i) =>
    Math.round(
      channel + (tealScale[stop + 1][i] - channel) * (position - stop),
    ),
  );
  return `rgb(${rgb.join(",")})`;
}

export function valueAt(
  row: SeasonRow | undefined,
  metric: Metric,
  zone: number,
) {
  if (!row || row.fga === 0) return null;
  if (metric === "fg" && row.shares[zone] === 0) return null;
  const value = (metric === "share" ? row.shares : row.fg)[zone];
  return value != null && value >= 0 && value <= 1 ? value : null;
}

export function estimatedZoneAttempts(row: SeasonRow, i: number) {
  const share = row.shares[i];
  if (row.fga === 0) return 0;
  return row.fga == null || share == null ? null : Math.round(row.fga * share);
}

export function hasSmallZoneSample(row: SeasonRow, i: number) {
  const attempts = estimatedZoneAttempts(row, i);
  return attempts != null && attempts < 25 && valueAt(row, "fg", i) != null;
}
