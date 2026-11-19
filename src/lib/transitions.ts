import type { SeasonRow } from "./types.ts";

export const TRANSITION_CASES = [
  {
    player: "edwaran01",
    en: "Threes pass half of all shots",
    zh: "三分占比过半",
  },
  {
    player: "lopezbr01",
    en: "A center adds the three",
    zh: "中锋开发三分",
  },
  {
    player: "derozde01",
    en: "From long twos to threes",
    zh: "减少长两分，增投三分",
  },
  {
    player: "westbru01",
    en: "Fewer attempts at the rim",
    zh: "篮下出手占比回落",
  },
  {
    player: "howardw01",
    en: "More shots from 3–10 ft",
    zh: "增投 3–10 英尺短两分",
  },
] as const;

export function completeProfile(row: SeasonRow) {
  return (
    row.shares.every((share) => share != null && share >= 0 && share <= 1) &&
    Math.abs(
      row.shares.reduce<number>((sum, share) => sum + (share ?? 0), 0) - 1,
    ) <= 0.005
  );
}

export function zoneChanges(a: SeasonRow, b: SeasonRow) {
  return a.shares.map((start, i) => {
    const end = b.shares[i];
    return start == null || end == null ? null : (end - start) * 100;
  });
}
