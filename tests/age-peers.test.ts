import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COHORT_SIZE,
  cohortOutlook,
  peerPath,
  profile,
  rankAgePeers,
} from "../src/lib/age-peers.ts";
import type { Dataset, SeasonRow } from "../src/lib/types.ts";

const { rows }: Dataset = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
);
const careers = new Map<string, SeasonRow[]>();
for (const r of rows) {
  const group = careers.get(r.playerId);
  if (group) group.push(r);
  else careers.set(r.playerId, [r]);
}
const anchor = careers.get("edwaran01")!.find((r) => r.season === 2025)!;

test("same-age scores use only earlier baseline measurements, irrespective of follow-up availability", () => {
  const result = rankAgePeers(anchor, careers);
  const baselinesOnly = new Map(
    [...careers].map(([id, group]) => [
      id,
      group.filter((r) => r.season < anchor.season && r.age === anchor.age),
    ]),
  );
  assert.deepEqual(result, rankAgePeers(anchor, baselinesOnly));
  assert.ok(result.matches.length > 10);
  assert.ok(
    result.matches.every(
      (m) =>
        Math.abs(m.score) <= 1 &&
        m.baseline.season < anchor.season &&
        m.baseline.age === anchor.age &&
        m.baseline.playerId !== anchor.playerId,
    ),
  );
  const peer = result.matches.find((m) => m.baseline.playerId === "halibty01")!;
  assert.equal(peer.baseline.season, 2024);
  const path = peerPath(peer.baseline, careers, anchor.season);
  assert.equal(path[1]?.season, 2025);
  assert.equal(path[2], null);
});

test("profile checks volume, composition and observed free throws", () => {
  for (const patch of [
    { age: null },
    { fga: 0 },
    { minutes: 0 },
    { fga: 199, minutes: 499 },
    { fta: null },
    { shares: [null, 0, 0, 0, 1] },
  ]) {
    assert.equal(profile({ ...anchor, ...patch } as SeasonRow), null);
  }
  assert.ok(profile({ ...anchor, fga: 200, minutes: 499, fta: 0 }));
  assert.ok(profile({ ...anchor, fga: 199, minutes: 500, fta: 0 }));
});

test("degenerate reference pool yields no numerical similarity", () => {
  const baseline = { ...anchor, playerId: "a", season: 2000 };
  const pool = new Map([
    ["a", [baseline]],
    ["b", [{ ...baseline, playerId: "b" }]],
  ]);
  assert.deepEqual(rankAgePeers(anchor, pool), {
    hasProfile: true,
    eligible: 2,
    matches: [],
  });
});

test("scenario range uses paired changes from the top ranked players and excludes missing samples", () => {
  const matches = Array.from({ length: COHORT_SIZE + 1 }, (_, i) => ({
    baseline: { ...anchor, playerId: String(i), season: 2000, rts: i },
    score: 1 - i / 100,
  }));
  const pool = new Map(
    matches.map((m, i) => [
      String(i),
      [
        m.baseline,
        {
          ...m.baseline,
          age: anchor.age! + 1,
          season: 2001,
          rts: i < 3 ? i * 2 : null,
        },
        {
          ...m.baseline,
          age: anchor.age! + 3,
          season: 2003,
          rts: i === 0 || i === COHORT_SIZE ? 99 : null,
        },
      ],
    ]),
  );
  const horizon = cohortOutlook(matches, pool, { ...anchor, rts: 5 });
  assert.deepEqual(horizon[1], {
    count: 3,
    median: 2,
    pairedCount: 3,
    prediction: 6,
    scenario: [5.5, 6.5],
  });
  assert.deepEqual(horizon[2], {
    count: 0,
    median: null,
    pairedCount: 0,
    prediction: null,
    scenario: null,
  });
  assert.deepEqual(horizon[3], {
    count: 1,
    median: 99,
    pairedCount: 1,
    prediction: null,
    scenario: null,
  });
});
