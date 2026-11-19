import type { SeasonRow, Shares } from "./types.ts";
import { completeProfile } from "./transitions.ts";

export const styles = ["rim", "inside", "mid", "three", "mixed"] as const;
export type ShotStyle = (typeof styles)[number];
export const states = [...styles, "unobserved", "censored"] as const;
export type StageState = (typeof states)[number];
export type PositionGroup = "all" | "guard" | "forward" | "center";
export type TeamSplit = {
  team: string;
  games: number | null;
  fga: number | null;
  ts: number | null;
  shares: Shares;
  fg: Shares;
};
export type SplitIndex = Record<string, TeamSplit[]>;

type Stage = { state: StageState; rts: number | null };
export type CohortPlayer = {
  position: string;
  stages: [Stage, Stage, Stage];
};
export type Flow = {
  from: StageState;
  to: StageState;
  count: number;
  rtsPairs: number;
  delta: number | null;
};

function shootingStyle(shares: number[]): ShotStyle {
  const groups: { key: "inside" | "mid" | "three"; share: number }[] = [
    { key: "inside", share: shares[0] + shares[1] },
    { key: "mid", share: shares[2] + shares[3] },
    { key: "three", share: shares[4] },
  ];
  groups.sort((a, b) => b.share - a.share);
  if (groups[0].share - groups[1].share < 0.05 - 1e-9) return "mixed";
  if (groups[0].key === "inside" && shares[0] >= 0.5) return "rim";
  return groups[0].key;
}

function observedStage(rows: SeasonRow[]): Stage {
  const pooled = [0, 0, 0, 0, 0];
  let attempts = 0,
    rtsWeight = 0,
    rtsSum = 0;
  for (const row of rows) {
    const fga = row.fga!;
    attempts += fga;
    row.shares.forEach((share, i) => {
      pooled[i] += share! * fga;
    });
    if (row.rts !== null) {
      rtsWeight += fga;
      rtsSum += fga * row.rts;
    }
  }
  return {
    state: shootingStyle(pooled.map((sum) => sum / attempts)),
    rts: rtsWeight ? rtsSum / rtsWeight : null,
  };
}

const qualifying = (r: SeasonRow) =>
  r.age !== null &&
  r.fga !== null &&
  r.fga > 0 &&
  (r.fga >= 200 || (r.minutes ?? 0) >= 500) &&
  completeProfile(r);

export function buildCohort(
  rows: SeasonRow[],
  lastSeason: number,
): CohortPlayer[] {
  const groups = new Map<string, SeasonRow[]>();
  for (const row of rows) {
    if (!qualifying(row) || row.season > lastSeason) continue;
    const group = groups.get(row.playerId);
    if (group) group.push(row);
    else groups.set(row.playerId, [row]);
  }
  const players: CohortPlayer[] = [];
  for (const group of groups.values()) {
    const entries = group.filter((r) => r.age! >= 20 && r.age! <= 23);
    if (!entries.length) continue;
    const entry = entries.reduce((a, b) => (a.season < b.season ? a : b));
    const groupPosition = entry.position.startsWith("C")
      ? "center"
      : /^(SG|PG)/.test(entry.position)
        ? "guard"
        : /^(SF|PF)/.test(entry.position)
          ? "forward"
          : "other";
    const cutoffAge = entry.age! + lastSeason - entry.season;
    // Ages 25–28 can still yield a first qualifying season up through 28.
    // Age 31+ is open-ended. Once reached, no observation is a statement
    // about this snapshot only, never a declaration of retirement.
    function laterStage(min: number, max: number, completeAt: number): Stage {
      const observed = group.filter((r) => r.age! >= min && r.age! <= max);
      return observed.length
        ? observedStage(observed)
        : {
            state: cutoffAge < completeAt ? "censored" : "unobserved",
            rts: null,
          };
    }
    players.push({
      position: groupPosition,
      stages: [
        observedStage(entries),
        laterStage(25, 28, 28),
        laterStage(31, Infinity, 31),
      ],
    });
  }
  return players;
}

export function cohortFlows(cohort: CohortPlayer[], filter: PositionGroup) {
  const people =
    filter === "all" ? cohort : cohort.filter((p) => p.position === filter);
  const counts = [
    new Map<StageState, number>(),
    new Map<StageState, number>(),
    new Map<StageState, number>(),
  ];
  const transitions = [new Map<string, Flow>(), new Map<string, Flow>()];
  for (const player of people) {
    player.stages.forEach((stage, i) => {
      counts[i].set(stage.state, (counts[i].get(stage.state) ?? 0) + 1);
      if (i === 2) return;
      const later = player.stages[i + 1],
        key = stage.state + "/" + later.state;
      const edge = transitions[i].get(key) ?? {
        from: stage.state,
        to: later.state,
        count: 0,
        rtsPairs: 0,
        delta: null,
      };
      edge.count++;
      if (stage.rts !== null && later.rts !== null) {
        edge.delta = (edge.delta ?? 0) + later.rts - stage.rts;
        edge.rtsPairs++;
      }
      transitions[i].set(key, edge);
    });
  }
  const flows = transitions.map((group) =>
    [...group.values()].map((edge) => ({
      ...edge,
      delta: edge.rtsPairs ? edge.delta! / edge.rtsPairs : null,
    })),
  );
  return { total: people.length, counts, flows };
}
