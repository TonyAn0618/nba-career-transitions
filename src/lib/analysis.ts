import type { SeasonRow } from "./types.ts";

export const ZONES = [
  "0–3 ft",
  "3–10 ft",
  "10–16 ft",
  "16 ft–3P",
  "3P",
] as const;
export const seasonLabel = (year: number) =>
  year - 1 + "–" + String(year).slice(-2);
export const percent = (n: number | null, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : (n * 100).toFixed(digits) + "%";
export const pp = (n: number | null) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : (n > 0 ? "+" : "") + n.toFixed(1) + " pp";
export const shortName = (name: string) =>
  name.split(" ").slice(1).join(" ") || name;
export const fga36 = (r: SeasonRow) =>
  r.fga != null && r.minutes != null && r.minutes > 0
    ? (r.fga * 36) / r.minutes
    : null;

export const PLAYER_COLORS = ["#2468bb", "#c05e27", "#087f77", "#8751b4"];
export const PLAYER_LETTERS = ["A", "B", "C", "D"];
