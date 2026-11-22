import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { peerFollowup } from "../src/lib/peer-followup.ts";
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
