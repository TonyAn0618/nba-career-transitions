import { MIN_HISTORY_FGA, MIN_ZONE_FGA } from "./career-peers.ts";
import {
  summarizeFollowupPeriod,
  type FollowupPeriod,
} from "./peer-followup.ts";
import type { SeasonRow, Translate } from "./types.ts";

function zoneValue(index: number, fg: number, attempts: number) {
  const value = index === 4 ? 3 : 2;
  const z = 1.96;
  const adjustment = (z * z) / attempts;
  const center = fg + adjustment / 2;
  const margin = z * Math.sqrt((fg * (1 - fg) + adjustment / 4) / attempts);
  return {
    points: value * fg,
    low: (value * (center - margin)) / (1 + adjustment),
    high: (value * (center + margin)) / (1 + adjustment),
  };
}

// For a change in shot mix, both shares must move and the fewer/more attempts
// must coexist in the same comparison. Express observed rates at the target's minutes.
function volumeRoom(
  a: FollowupPeriod | null,
  b: FollowupPeriod | null,
  from: number,
  to: number,
  mpg: number,
) {
  if (
    !a?.mpg ||
    !b?.mpg ||
    !a.games ||
    !b.games ||
    (a.fgaPerGame ?? 0) * a.games < MIN_HISTORY_FGA ||
    (b.fgaPerGame ?? 0) * b.games < MIN_HISTORY_FGA
  )
    return 0;
  const af = a.zonePerGame[from],
    bf = b.zonePerGame[from],
    at = a.zonePerGame[to],
    bt = b.zonePerGame[to];
  const afs = a.shares[from],
    bfs = b.shares[from],
    ats = a.shares[to],
    bts = b.shares[to];
  if (
    af == null ||
    bf == null ||
    at == null ||
    bt == null ||
    afs == null ||
    bfs == null ||
    ats == null ||
    bts == null ||
    bfs >= afs ||
    bts <= ats
  )
    return 0;
  return Math.max(
    0,
    Math.min(af / a.mpg - bf / b.mpg, bt / b.mpg - at / a.mpg) * mpg,
  );
}

export function shotSelectionScenarios(
  row: SeasonRow,
  career: readonly SeasonRow[] = [],
  pre: FollowupPeriod | null = null,
  post: FollowupPeriod | null = null,
) {
  const current = summarizeFollowupPeriod([row], row.season)!;
  const past = career
    .filter(
      (r) =>
        r.playerId === row.playerId &&
        r.season < row.season &&
        r.season >= row.season - 3,
    )
    .map((r) => ({
      season: r.season,
      stats: summarizeFollowupPeriod([r], r.season)!,
    }));
  const zones = current.fg.map((fg, index) => {
    const attempts = current.zoneAttempts[index],
      perGame = current.zonePerGame[index];
    let recentN = 0,
      recentMakes = 0,
      pastN = 0,
      pastMakes = 0;
    for (const { season, stats } of past) {
      const count = stats.zoneAttempts[index],
        rate = stats.fg[index];
      if (count == null || count <= 0 || rate == null) continue;
      pastN += count;
      pastMakes += count * rate;
      if (season >= row.season - 2) {
        recentN += count;
        recentMakes += count * rate;
      }
    }
    const latestN = fg != null ? (attempts ?? 0) : 0;
    const pooled = latestN < MIN_ZONE_FGA && recentN > 0;
    const n = latestN + (pooled ? recentN : 0);
    const rate =
      n > 0 ? (latestN * (fg ?? 0) + (pooled ? recentMakes : 0)) / n : null;
    const value =
      rate != null && n >= MIN_ZONE_FGA ? zoneValue(index, rate, n) : null;
    const pastFG = pastN >= MIN_ZONE_FGA ? pastMakes / pastN : null;
    const gap =
      pastFG != null && fg != null && latestN >= MIN_ZONE_FGA && perGame != null
        ? (pastFG - fg) * perGame * (index === 4 ? 3 : 2)
        : 0;
    return {
      index,
      attempts,
      perGame,
      n,
      rate,
      pooled,
      value,
      pastFG,
      fg,
      gap,
    };
  });
  const denominator =
    row.games &&
    row.fga != null &&
    row.fga > 0 &&
    row.fta != null &&
    row.fta >= 0 &&
    row.points != null
      ? (2 * (row.fga + 0.44 * row.fta)) / row.games
      : null;
  const swaps = zones.flatMap((from) =>
    zones.flatMap((to) => {
      if (
        !from.value ||
        !to.value ||
        !from.perGame ||
        to.perGame == null ||
        from.index === to.index
      )
        return [];
      const edge = to.value.points - from.value.points;
      if (edge <= 0) return [];
      let ownRoom = 0,
        ownSeason: number | null = null;
      for (const { season, stats } of past) {
        const room = volumeRoom(
          current,
          stats,
          from.index,
          to.index,
          current.mpg ?? 0,
        );
        if (room > ownRoom) {
          ownRoom = room;
          ownSeason = season;
        }
      }
      const twinRoom = volumeRoom(
        pre,
        post,
        from.index,
        to.index,
        current.mpg ?? 0,
      );
      const own = ownRoom >= 0.1,
        twin = twinRoom >= 0.1;
      const feasible = own || twin;
      const clear = to.value.low > from.value.high;
      // Present an attainable whole-game cadence, always rounded down in volume.
      const room = Math.min(
        0.5,
        from.perGame,
        twin ? twinRoom : own ? ownRoom : 0.5,
      );
      const every = Math.ceil(1 / room);
      const gain = denominator ? edge / every / denominator : null;
      const tier =
        feasible && clear && every <= 10
          ? "trial"
          : feasible
            ? "review"
            : "scenario";
      return [
        {
          id: from.index + "-" + to.index,
          from,
          to,
          edge,
          clear,
          own: own && ownRoom >= 1 / every,
          ownSeason,
          twin: twin && twinRoom >= 1 / every,
          ownRoom,
          twinRoom,
          every,
          gain,
          projected:
            gain != null && current.ts != null ? current.ts + gain : null,
          tier,
        },
      ];
    }),
  );
  // Prioritize a feasible trial. Within that tier, prefer directions observed
  // in the selected twin, then the largest gain at the supported volume.
  const priority = (tier: string) =>
    tier === "trial" ? 0 : tier === "review" ? 1 : 2;
  swaps.sort(
    (a, b) =>
      priority(a.tier) - priority(b.tier) ||
      Number(b.twin) - Number(a.twin) ||
      b.edge / b.every - a.edge / a.every ||
      a.id.localeCompare(b.id),
  );
  const focus =
    [...zones].filter((z) => z.gap > 0).sort((a, b) => b.gap - a.gap)[0] ??
    null;
  const lead =
    [...zones]
      .filter((z) => (z.attempts ?? 0) > 0)
      .sort((a, b) => b.attempts! - a.attempts!)[0] ?? null;
  return { baseline: current.ts, zones, swaps, focus, lead };
}

export function zoneNames(t: Translate) {
  return [
    t("At rim", "篮下"),
    t("Short two", "近两分"),
    t("Mid-range", "中距离"),
    t("Long two", "长两分"),
    t("Three-pointers", "三分"),
  ];
}
