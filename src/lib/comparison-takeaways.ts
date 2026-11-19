import { percent } from "./analysis.ts";
import {
  MIN_MATCH_FGA,
  matchedFollowup,
  type HistoricalTransition,
} from "./transition-matches.ts";
import type { SeasonRow, Translate } from "./types.ts";

type FollowupOutcome =
  | "direction"
  | "outside"
  | "absent"
  | "missing"
  | "sample"
  | "retained"
  | "not-retained";

export function thirdSeasonReference(
  matches: HistoricalTransition[],
  careers: ReadonlyMap<string, SeasonRow[]>,
  asOf: number,
  band: number,
  anchorChange: number,
) {
  const direction = Math.sign(anchorChange);
  const cases = matches.map(({ a, b }) => {
    const start = a.shares[band]!;
    const end = b.shares[band]!;
    const { row, observable, year } = matchedFollowup(
      b,
      careers.get(b.playerId) ?? [],
      asOf,
    )[3];
    const share = row?.shares[band] ?? null;
    const fga = row?.fga ?? null;
    function outcome(): FollowupOutcome {
      if (!direction || Math.sign(end - start) !== direction)
        return "direction";
      if (!observable) return "outside";
      if (!row) return "absent";
      if (share == null || fga == null) return "missing";
      if (fga < MIN_MATCH_FGA) return "sample";
      return Math.sign(share - start) === direction
        ? "retained"
        : "not-retained";
    }
    return {
      playerId: b.playerId,
      name: b.name,
      start,
      end,
      year,
      share,
      fga,
      rts: row?.rts ?? null,
      outcome: outcome(),
    };
  });
  const retained = cases.filter((c) => c.outcome === "retained").length;
  const eligible =
    retained + cases.filter((c) => c.outcome === "not-retained").length;
  return { cases, eligible, retained, direction };
}

export function leagueComparison(rts: number, t: Translate) {
  const amount = Math.abs(rts).toFixed(1);
  if (amount === "0.0")
    return t("level with the league average", "与联盟均值持平");
  return rts > 0
    ? t(
        `${amount} pp above the league average`,
        `高于联盟均值 ${amount} 个百分点`,
      )
    : t(
        `${amount} pp below the league average`,
        `低于联盟均值 ${amount} 个百分点`,
      );
}

export function largestChangeGap(
  primary: (number | null)[],
  peer: (number | null)[],
) {
  let largest: { band: number; gap: number } | undefined;
  primary.forEach((value, band) => {
    const other = peer[band];
    if (value == null || other == null) return;
    const gap = Math.round(Math.abs(value - other) * 10) / 10;
    if (gap > (largest?.gap ?? 0)) largest = { band, gap };
  });
  return largest;
}

// Among the zones moving the other way, choose the largest change shared by both players.
export function sharedCounterpart(
  primary: (number | null)[],
  peer: (number | null)[],
  band: number,
) {
  const direction = Math.sign(primary[band] ?? 0);
  if (!direction || direction !== Math.sign(peer[band] ?? 0)) return null;
  let counterpart: number | null = null;
  let largest = 0;
  for (const [i, value] of primary.entries()) {
    const shared = Math.min(
      -direction * (value ?? 0),
      -direction * (peer[i] ?? 0),
    );
    if (shared > largest) {
      largest = shared;
      counterpart = i;
    }
  }
  return counterpart;
}

export function followupReading(
  start: number,
  band: number,
  records: ReturnType<typeof matchedFollowup>,
  t: Translate,
) {
  const end = records[0]?.row?.shares[band];
  const later = records.slice(1);
  const latest = later
    .filter((r) => r.observable && r.row?.shares[band] != null)
    .at(-1);
  const share = latest?.row?.shares[band];
  if (!latest || share == null || end == null) {
    return later.some((r) => r.observable)
      ? t(
          "No follow-up share recorded within coverage.",
          "观察期内没有可用的后续占比。",
        )
      : t(
          "All three seasons are outside coverage.",
          "后三季均超出数据观察期。",
        );
  }

  // Read the latest available season against both endpoints, without assuming a continuous trend.
  const shift = Math.sign(end - start);
  let comparison: string;
  if (share === end) {
    comparison = t("level with the end of the window", "与转型结束季持平");
  } else if (share === start) {
    comparison = t("back at the starting share", "回到转型前的水平");
  } else if (shift && Math.sign(share - start) !== shift) {
    comparison =
      shift > 0
        ? t("below the pre-shift share", "已低于转型前")
        : t("above the pre-shift share", "已高于转型前");
  } else if (shift && Math.sign(share - end) !== shift) {
    comparison =
      shift > 0
        ? t(
            "down from the end, still above the start",
            "较结束季回落，仍高于转型前",
          )
        : t(
            "up from the end, still below the start",
            "较结束季回升，仍低于转型前",
          );
  } else {
    comparison =
      share > end
        ? t("above the end-of-window share", "高于转型结束季")
        : t("below the end-of-window share", "低于转型结束季");
  }
  const fga = latest.row!.fga;
  const sample =
    fga != null && fga < MIN_MATCH_FGA
      ? t(` (only ${fga} total attempts)`, `（当季仅 ${fga} 次出手）`)
      : "";
  let reading = t(
    `In year ${latest.offset} the share was ${percent(share)}, ${comparison}${sample}.`,
    `第 ${latest.offset} 季为 ${percent(share)}，${comparison}${sample}。`,
  );
  const third = later.at(-1);
  if (third && latest.offset < third.offset) {
    if (!third.observable)
      reading += t(" Year 3 is outside coverage.", "第 3 季超出观察期。");
    else if (!third.row) reading += t(" No year 3 record.", "第 3 季无记录。");
    else reading += t(" No zone share for year 3.", "第 3 季缺少该区占比。");
  }
  return reading;
}
