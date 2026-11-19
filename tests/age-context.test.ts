import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  buildCohort,
  cohortFlows,
  type SplitIndex,
} from "../src/lib/age-context.ts";
import type { Dataset, SeasonRow } from "../src/lib/types.ts";

const dataset = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
) as Dataset;
const traded = JSON.parse(
  readFileSync(
    new URL("../public/data/team-splits.json", import.meta.url),
    "utf8",
  ),
) as SplitIndex;

test("multi-team comparisons preserve team-specific denominators, shares and FG%", () => {
  const teams = traded["doncilu01:2025"];
  assert.deepEqual(
    teams.map((stint) => [stint.team, stint.fga, stint.shares[4], stint.fg[4]]),
    [
      ["DAL", 466, 0.455, 0.354],
      ["LAL", 559, 0.481, 0.379],
    ],
  );
  const ids = new Set(
    dataset.rows.filter((r) => (r.teams?.length ?? 0) > 1).map((r) => r.id),
  );
  assert.deepEqual(new Set(Object.keys(traded)), ids);
  const rows = new Map(dataset.rows.map((row) => [row.id, row]));
  for (const [id, stints] of Object.entries(traded)) {
    const player = rows.get(id)!;
    assert.deepEqual(
      stints.map((s) => s.team),
      player.teams,
    );
    assert.equal(
      stints.reduce((sum, s) => sum + (s.fga ?? 0), 0),
      player.fga,
    );
  }
});

const example = dataset.rows.find((r) => r.id === "doncilu01:2025")!;
const row = (
  age: number,
  season: number,
  values: Partial<SeasonRow> = {},
): SeasonRow => ({
  ...example,
  age,
  season,
  playerId: "p",
  position: "C",
  fga: 500,
  minutes: 800,
  rts: 1,
  shares: [0.5, 0.1, 0.1, 0.1, 0.2],
  ...values,
});

test("cohort includes an observed entry and distinguishes pending from absent records", () => {
  const players = buildCohort(
    [
      row(23, 2025, { playerId: "young" }),
      row(23, 2008, { playerId: "older" }),
      row(35, 2014, { playerId: "no-entry" }),
      row(22, 2010, { playerId: "low-volume", fga: 70, minutes: 399 }),
      row(23, 2025, {
        playerId: "missing",
        shares: [null, 0.1, 0.2, 0.3, 0.4],
      }),
      row(27, 2024, { playerId: "still-pending" }),
      row(23, 2020, { playerId: "still-pending" }),
    ],
    2025,
  );
  assert.equal(players.length, 3);
  assert.deepEqual(
    players.map((p) => p.stages.map((s) => s.state)),
    [
      ["rim", "censored", "censored"],
      ["rim", "unobserved", "unobserved"],
      ["rim", "rim", "censored"],
    ],
  );
});

test("stage measures weight observed seasons by attempts and transitions count players once", () => {
  const group = buildCohort(
    [
      row(23, 2008, { shares: [0.1, 0.05, 0.1, 0.05, 0.7], fga: 900, rts: 5 }),
      row(22, 2007, { fga: 100, rts: -5, position: "PG" }),
      row(25, 2010, { shares: [0.1, 0.1, 0.4, 0.28, 0.12], rts: 3 }),
      row(31, 2016, { shares: [0.3, 0.1, 0.12, 0.08, 0.4], rts: 0 }),
    ],
    2026,
  );
  assert.equal(group[0].position, "guard");
  assert.deepEqual(
    group[0].stages.map((s) => s.state),
    ["three", "mid", "mixed"],
  );
  const flows = cohortFlows(group, "guard");
  assert.equal(flows.total, 1);
  assert.equal(flows.flows[0][0].delta, -1);
  assert.equal(cohortFlows(group, "center").total, 0);
  for (const counts of flows.counts)
    assert.equal(
      [...counts.values()].reduce((a, b) => a + b),
      1,
    );
});
