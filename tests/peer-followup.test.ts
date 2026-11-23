import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { peerFollowup } from "../src/lib/peer-followup.ts";
import { shotSelectionScenarios } from "../src/lib/peer-shot-advice.ts";
import type { SeasonRow } from "../src/lib/types.ts";

const { rows }: { rows: SeasonRow[] } = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
);
const russell = rows.filter(
  (r) => r.playerId === "russeda01" && r.season <= 2026,
);

test("Russell's pooled three-point share rises even as actual three-point attempts per game fall", () => {
  const { pre, post, years } = peerFollowup(russell, 2016, 8);
  assert.ok(pre && post);
  assert.equal(pre.shares[4], 3416 / 7433);
  assert.equal(post.shares[4], 1017 / 1950);
  assert.equal(pre.zonePerGame[4], 3416 / 495);
  assert.equal(post.zonePerGame[4], 1017 / 160);
  assert.equal(post.fg[4], 372 / 1017);
  assert.equal(pre.ts, 8767 / (2 * (7433 + 0.44 * 1518)));
  assert.equal(post.ts, 2365 / (2 * (1950 + 0.44 * 397)));
  assert.equal(post.ppg, 2365 / 160);
  assert.equal(post.mpg, 4459 / 160);
  assert.deepEqual(
    years.map((v) => v.year),
    [9, 10, 11],
  );
  assert.equal(years[2].stats!.fg[4], 33 / 112);
  assert.equal(years[2].stats!.zonePerGame[4], 112 / 26);
  assert.ok(years[2].stats!.ts! < pre.ts! && post.ts! > pre.ts!);
});

test("a missing career year stays empty and an unavailable split does not erase known threes", () => {
  const known = russell[0];
  const missing: SeasonRow = {
    ...known,
    season: 2019,
    shares: [null, null, null, null, null],
    games: null,
    rts: null,
  };
  const { pre, post, years } = peerFollowup([missing, known], 2016, 2);
  assert.equal(pre!.firstYear, 1);
  assert.equal(pre!.lastYear, 1);
  assert.equal(years[0].stats, null);
  assert.equal(post!.firstYear, 4);
  assert.equal(post!.seasons, 1);
  assert.deepEqual(post!.shares.slice(0, 4), [null, null, null, null]);
  assert.equal(post!.fg[4], known.threeMade! / known.threeAttempts!);
  assert.equal(
    post!.ts,
    known.points! / (2 * (known.fga! + 0.44 * known.fta!)),
  );
  assert.equal(post!.zonePerGame[4], null);
  assert.equal(post!.rts, null);
  const zero = {
    ...missing,
    fga: 0,
    threeAttempts: null,
    threeMade: null,
    games: 2,
    fta: 0,
    points: 0,
  };
  const zeros = peerFollowup([known, zero], 2016, 2).post!;
  assert.deepEqual(zeros.zonePerGame, [0, 0, 0, 0, 0]);
  assert.deepEqual(zeros.fg, [null, null, null, null, null]);
  assert.equal(zeros.ts, null);
  const noLater = peerFollowup([known], 2016, 1);
  assert.equal(noLater.post, null);
  assert.deepEqual(noLater.years, []);
});

const luka = rows.find((r) => r.id === "doncilu01:2026")!;
const lukaCareer = rows.filter((r) => r.playerId === luka.playerId);
test("the selected twin and the player's own paired workloads constrain the preferred route and its cadence", () => {
  const { pre, post } = peerFollowup(russell, 2016, 8);
  const model = shotSelectionScenarios(luka, lukaCareer, pre, post);
  const best = model.swaps[0];
  assert.equal(best.id, "3-1");
  assert.equal(best.tier, "trial");
  assert.ok(best.twin && best.clear);
  assert.ok(best.twinRoom >= 1 / best.every && best.ownRoom < 1 / best.every);
  assert.equal(best.every, 2);
  const expected =
    (luka.points! + 32 * (2 * 0.595 - 2 * 0.402)) /
    (2 * (luka.fga! + 0.44 * luka.fta!));
  assert.ok(Math.abs(best.projected! - expected) < 1e-12);
  assert.equal(model.baseline, luka.ts);
  assert.ok(
    model.swaps.every((s) => s.every >= 2 && 1 / s.every <= s.from.perGame!),
  );
  const personal = shotSelectionScenarios(luka, lukaCareer);
  assert.ok(personal.swaps[0].own && !personal.swaps[0].twin);
  assert.equal(shotSelectionScenarios(luka).swaps[0].tier, "scenario");
  assert.equal(
    shotSelectionScenarios(luka, [], pre, pre).swaps[0].tier,
    "scenario",
  );
  assert.deepEqual(
    shotSelectionScenarios(luka, [{ ...luka, season: 2027 }]),
    shotSelectionScenarios(luka),
  );
});
test("five zones remain visible with missing, sparse and pooled data; missing TS does not erase shot evidence", () => {
  const thin = {
    ...luka,
    fga: 20,
    threeAttempts: 8,
    threeMade: 3,
    fg: [null, null, null, null, 0.375] as SeasonRow["fg"],
  };
  const alone = shotSelectionScenarios(thin);
  assert.equal(alone.zones.length, 5);
  assert.equal(alone.swaps.length, 0);
  assert.equal(alone.zones[4].n, 8);
  const pooled = shotSelectionScenarios(thin, lukaCareer);
  assert.ok(pooled.zones[4].pooled && pooled.zones[4].n > 25);
  const missing = shotSelectionScenarios({ ...luka, fta: null }, lukaCareer);
  assert.equal(missing.baseline, null);
  assert.ok(
    missing.swaps.length && missing.swaps.every((s) => s.projected == null),
  );
  const noDistance = shotSelectionScenarios({
    ...luka,
    shares: [null, null, null, null, null],
  });
  assert.equal(noDistance.zones[0].attempts, null);
  assert.equal(noDistance.zones[4].attempts, 694);
  const close = shotSelectionScenarios(
    { ...luka, fg: [0.5, 0.5, 0.5, 0.5, 1 / 3], threeMade: 231 },
    lukaCareer,
  );
  assert.ok(close.swaps.every((s) => s.tier !== "trial"));
});
test("players with different opportunities receive different kinds of advice", () => {
  const curry = rows.find((r) => r.id === "curryst01:2026")!;
  const curryCareer = rows.filter((r) => r.playerId === curry.playerId);
  const williams = peerFollowup(
    rows.filter((r) => r.playerId === "willilo02"),
    2006,
    17,
  );
  const c = shotSelectionScenarios(
    curry,
    curryCareer,
    williams.pre,
    williams.post,
  );
  assert.equal(c.focus?.index, 4);
  const harden = rows.find((r) => r.id === "hardeja01:2026")!;
  const h = shotSelectionScenarios(
    harden,
    rows.filter((r) => r.playerId === harden.playerId),
    williams.pre,
    williams.post,
  );
  assert.equal(h.swaps[0].id, "3-4");
  assert.equal(h.swaps[0].tier, "trial");
  assert.equal(h.swaps[0].every, 8);
});
