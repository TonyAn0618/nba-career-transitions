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

// Identify the historical comparison's main shift before inspecting zone accuracy.
function historicalRoute(
  before: FollowupPeriod | null,
  after: FollowupPeriod | null,
  targetMinutes: number,
) {
  if (
    !before?.mpg ||
    !after?.mpg ||
    !before.games ||
    !after.games ||
    (before.fgaPerGame ?? 0) * before.games < MIN_HISTORY_FGA ||
    (after.fgaPerGame ?? 0) * after.games < MIN_HISTORY_FGA
  )
    return null;
  const changes = before.shares.map((a, i) => {
    const b = after.shares[i],
      beforeCount = before.zonePerGame[i],
      afterCount = after.zonePerGame[i];
    if (a == null || b == null || beforeCount == null || afterCount == null)
      return null;
    return {
      index: i,
      share: b - a,
      rate: afterCount / after.mpg! - beforeCount / before.mpg!,
    };
  });
  if (changes.some((c) => c == null)) return null;
  const ordered = changes
    .flatMap((c) => (c ? [c] : []))
    .sort((a, b) => a.share - b.share);
  const from = ordered[0],
    to = ordered[ordered.length - 1];
  if (from.share >= 0 || to.share <= 0 || from.rate >= 0 || to.rate <= 0)
    return null;
  const room = Math.min(-from.rate, to.rate) * targetMinutes;
  const efficiency =
    before.rts != null && after.rts != null ? after.rts - before.rts : null;
  const scoring =
    before.points36 != null && after.points36 != null
      ? after.points36 - before.points36
      : null;
  return {
    id: from.index + "-" + to.index,
    from: from.index,
    to: to.index,
    room,
    efficiency,
    scoring,
    supported:
      efficiency != null && efficiency > 0 && scoring != null && scoring >= 0,
  };
}

export function shotSelectionScenarios(
  row: SeasonRow,
  career: readonly SeasonRow[] = [],
  pre: FollowupPeriod | null = null,
  post: FollowupPeriod | null = null,
) {
  const current = summarizeFollowupPeriod([row], row.season)!;
  const pastRows = career.filter(
    (r) =>
      r.playerId === row.playerId &&
      r.season < row.season &&
      r.season >= row.season - 3,
  );
  const past = pastRows.map((r) => ({
    season: r.season,
    stats: summarizeFollowupPeriod([r], r.season)!,
  }));
  const prior = summarizeFollowupPeriod(pastRows, row.season - 3);
  const personalRoute = historicalRoute(current, prior, current.mpg ?? 0);
  const twinRoute = historicalRoute(pre, post, current.mpg ?? 0);
  const zones = current.fg.map((fg, index) => {
    const attempts = current.zoneAttempts[index],
      perGame = current.zonePerGame[index];
    let recentN = 0,
      recentMakes = 0,
      pastN = 0,
      pastMakes = 0,
      pastSeasons = 0;
    for (const { season, stats } of past) {
      const count = stats.zoneAttempts[index],
        rate = stats.fg[index];
      if (count == null || count <= 0 || rate == null) continue;
      pastN += count;
      pastMakes += count * rate;
      pastSeasons++;
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
      pastSeasons,
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
      const id = from.index + "-" + to.index;
      const ownRoom = personalRoute?.id === id ? personalRoute.room : 0;
      const twinRoom = twinRoute?.id === id ? twinRoute.room : 0;
      const own = ownRoom >= 0.1 && !!personalRoute?.supported;
      const twin = twinRoom >= 0.1 && !!twinRoute?.supported;
      const feasible = own || twin;
      // A Wilson-based lower bound for the difference in points/attempt. Comparing
      // two separate intervals for non-overlap double-counts their uncertainty.
      const clear =
        edge >
        Math.hypot(
          to.value.points - to.value.low,
          from.value.high - from.value.points,
        );
      const repeated =
        !from.pooled &&
        !to.pooled &&
        from.pastFG != null &&
        to.pastFG != null &&
        (to.index === 4 ? 3 : 2) * to.pastFG >
          (from.index === 4 ? 3 : 2) * from.pastFG;
      // Present an attainable whole-game cadence, always rounded down in volume.
      const room = Math.min(
        0.5,
        from.perGame,
        twin ? twinRoom : own ? ownRoom : 0.5,
      );
      const every = Math.ceil(1 / room);
      const gain = denominator ? edge / every / denominator : null;
      const tier =
        feasible && (clear || repeated) && every <= 10
          ? "trial"
          : feasible
            ? "review"
            : "scenario";
      return [
        {
          id,
          from,
          to,
          edge,
          clear,
          repeated,
          own: own && ownRoom >= 1 / every,
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
  // Revalue the change in shooting percentage at today's shot volume, holding
  // the mix fixed. A positive gap denotes a decline; a negative gap a gain.
  const lift =
    [...zones].filter((z) => z.gap < 0).sort((a, b) => a.gap - b.gap)[0] ??
    null;
  const focus =
    [...zones].filter((z) => z.gap > 0).sort((a, b) => b.gap - a.gap)[0] ??
    null;
  const lead =
    [...zones]
      .filter((z) => (z.attempts ?? 0) > 0)
      .sort((a, b) => b.attempts! - a.attempts!)[0] ?? null;
  const strength = lift && -lift.gap > (focus?.gap ?? 0) ? lift : null;
  const personalZone = strength ?? focus;
  // Reprice only this zone at its prior accuracy, using this season's TS denominator.
  const tsAtPastAccuracy =
    personalZone && current.ts != null && denominator
      ? current.ts + personalZone.gap / denominator
      : null;
  return {
    baseline: current.ts,
    tsAtPastAccuracy,
    zones,
    swaps,
    focus,
    strength,
    lead,
    personalRoute,
    twinRoute,
  };
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
