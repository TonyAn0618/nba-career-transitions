import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  matchStyles,
  pathObservation,
  pathEvidence,
  evidenceGroups,
  eligibleStyle,
  pathValue,
  styleSimilarity,
} from "../src/lib/style-paths.ts";
import type { SeasonRow, Dataset } from "../src/lib/types.ts";
const data: Dataset = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
);
const template = data.rows.find(
  (r) => r.playerId === "curryst01" && r.season === 2022,
)!;
const row = (
  playerId: string,
  season: number,
  extra: Partial<SeasonRow> = {},
): SeasonRow => ({
  ...template,
  playerId,
  id: `${playerId}:${season}`,
  season,
  ...extra,
});

test("baseline matches do not use later shooting changes, outcomes, or follow-up availability", () => {
  const anchor = row("target", 2022),
    same = row("peer", 2010);
  const first = matchStyles(anchor, new Map([["peer", [same]]]));
  const later = row("peer", 2011, {
    age: 34,
    shares: [0, 0, 0, 0, 1],
    rts: 99,
    points: 9999,
  });
  assert.deepEqual(
    matchStyles(anchor, new Map([["peer", [same, later]]])),
    first,
  );
  assert.equal(first.matches[0].similarity.score, 100);
});
test("baseline eligibility, earlier date, age, and optional role filters are enforced", () => {
  const anchor = row("target", 2022);
  const careers = new Map([
    ["target", [anchor]],
    ["future", [row("future", 2023)]],
    ["same-year", [row("same-year", 2022)]],
    ["young", [row("young", 2009, { age: 31 })]],
    ["neighbor", [row("neighbor", 2008, { age: 32 })]],
    ["small", [row("small", 2010, { fga: 199 })]],
    ["null", [row("null", 2010, { shares: [null, 0, 0, 0, 1] })]],
    ["center", [row("center", 2010, { position: "C" })]],
  ]);
  assert.deepEqual(
    matchStyles(anchor, careers).matches.map((m) => m.baseline.playerId),
    ["center"],
  );
  assert.deepEqual(
    matchStyles(anchor, careers, {
      sameRole: true,
      ageTolerance: 1,
    }).matches.map((m) => m.baseline.playerId),
    ["neighbor"],
  );
  assert.equal(eligibleStyle(row("bad", 2010, { minutes: 0 })), false);
});
test("one baseline per historical player, deterministic ranking, rounded shares normalized", () => {
  const anchor = row("target", 2022);
  const a = row("a", 2010),
    b = row("a", 2011);
  const result = matchStyles(
    anchor,
    new Map([
      ["a", [a, b]],
      ["b", [row("b", 2009)]],
    ]),
  );
  assert.equal(result.count, 2);
  assert.equal(result.matches[0].baseline.id, "a:2011");
  const score = styleSimilarity(anchor, {
    ...anchor,
    shares: anchor.shares.map((v) => v! * 1.001) as SeasonRow["shares"],
  });
  assert.ok(Math.abs(score.score - 100) < 1e-10);
});
test("reference cutoff prevents future target data and future historical information from leaking", () => {
  const anchor = row("target", 2022),
    later = row("target", 2023);
  assert.equal(
    pathObservation(anchor, [anchor, later], 1, 2022).status,
    "outside",
  );
  assert.equal(
    pathObservation(anchor, [anchor, later], 1, 2022).row,
    undefined,
  );
  assert.equal(
    pathObservation(row("peer", 2021), [row("peer", 2023)], 2, 2022).status,
    "outside",
  );
});
test("gaps, zero shares, and low attempts remain distinct and only eligible cases enter summaries", () => {
  const anchor = row("target", 2022);
  const a = row("a", 2010, { shares: [0.2, 0.2, 0.2, 0.2, 0.2] });
  const b = row("b", 2010, { shares: a.shares });
  const c = row("c", 2010, { shares: a.shares });
  const careers = new Map([
    ["a", [a, row("a", 2011, { shares: [0.3, 0.3, 0.2, 0.2, 0], rts: null })]],
    ["b", [b, row("b", 2011, { fga: 20, shares: [0, 0, 0, 0, 1] })]],
    ["c", [c]],
  ]);
  const matches = [a, b, c].map((baseline) => ({
    baseline,
    similarity: styleSimilarity(anchor, baseline),
  }));
  const evidence = pathEvidence(anchor, matches, careers, 1, 4);
  assert.equal(evidence[0].share, -20);
  assert.equal(evidence[1].observation.status, "sample");
  assert.equal(evidence[2].observation.status, "missing");
  const down = evidenceGroups(evidence).find((g) => g.direction === "down")!;
  assert.equal(down.count, 1);
  assert.equal(down.rtsN, 0);
  assert.equal(down.rts, null);
  assert.equal(pathValue(undefined, "share", 4), null);
});
test("real Curry reference retains eight unique baseline matches with visible follow-up gaps", () => {
  const careers = new Map<string, SeasonRow[]>();
  for (const r of data.rows)
    careers.set(r.playerId, [...(careers.get(r.playerId) ?? []), r]);
  const result = matchStyles(template, careers);
  assert.equal(result.matches.length, 8);
  assert.equal(new Set(result.matches.map((m) => m.baseline.playerId)).size, 8);
  for (const m of result.matches) {
    assert.equal(m.baseline.age, template.age);
    assert.ok(m.baseline.season < template.season);
  }
});
