import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  peerFollowup,
  summarizeFollowupPeriod,
  type FollowupPeriod,
} from "../src/lib/peer-followup.ts";
import { peerShotAdvice } from "../src/lib/peer-shot-advice.ts";
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

test("the Luka–Russell recommendation distinguishes a higher three-point share from adding attempts", () => {
  const luka = rows.find(
    (r) => r.playerId === "doncilu01" && r.season === 2026,
  )!;
  const target = summarizeFollowupPeriod([luka], 2019);
  const { pre, post, years } = peerFollowup(russell, 2016, 8);
  assert.ok(target && pre && post);
  const forZone = (zone: number, name: string) =>
    peerShotAdvice(
      target,
      pre,
      post,
      years.at(-1)!.stats,
      zone,
      name,
      luka.name,
      russell[0].name,
      (_, zh) => zh,
    );
  const threes = forZone(4, "三分");
  assert.equal((threes.scenario! - threes.observed!).toFixed(2), "1.03");
  assert.match(threes.action, /Dončić.*三分.*暂缓每场多投约 1 次/);
  assert.match(
    threes.reason,
    /Russell.*占比上升.*场均三分出手却减少.*每36分钟得分下降/,
  );
  const longTwos = forZone(3, "长两分");
  assert.match(longTwos.action, /长两分/);
  assert.match(longTwos.reason, /每两场还不到一投/);
});

test("a small trial requires compatible volume, scoring, efficiency, and follow-up evidence", () => {
  const { pre, post } = peerFollowup(russell, 2016, 8);
  assert.ok(pre && post);
  const aligned = {
    ...post,
    zonePerGame: post.zonePerGame.map((n, i) =>
      i === 4 ? pre.zonePerGame[i]! + 1 : n,
    ),
    rts: pre.rts! + 2,
    points36: pre.points36! + 1,
  };
  const advice = (period: FollowupPeriod, last: FollowupPeriod | null) =>
    peerShotAdvice(
      pre,
      pre,
      period,
      last,
      4,
      "Three-pointers",
      "Test Player",
      "Test Peer",
      (en) => en,
    );
  assert.match(advice(aligned, aligned).action, /Try a small/);
  assert.match(
    advice(aligned, { ...aligned, rts: pre.rts! - 1 }).reason,
    /final season/,
  );
  assert.match(
    advice({ ...aligned, points36: pre.points36! - 1 }, aligned).reason,
    /smaller scoring role/,
  );
  assert.match(
    advice({ ...aligned, seasons: 1 }, aligned).reason,
    /at least two/,
  );
  assert.match(
    advice({ ...aligned, zoneAttempts: [0, 0, 0, 0, 24] }, aligned).action,
    /Keep/,
  );
  assert.match(
    advice({ ...aligned, rts: null }, aligned).reason,
    /recorded zone volume/,
  );
  const fewer = {
    ...aligned,
    zonePerGame: [0, 0, 0, 0, 2],
    shares: [0, 0, 0, 0, 0.18],
  };
  assert.match(advice(fewer, fewer).action, /fewer/);
});
