import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  careerProfile,
  careerShootingTotals,
  rankCareerPeers,
} from "../src/lib/career-peers.ts";
import { alignPeerStages } from "../src/lib/peer-stages.ts";
import type { SeasonRow } from "../src/lib/types.ts";

function season(
  playerId: string,
  year: number,
  age: number,
  fields: Partial<SeasonRow> = {},
): SeasonRow {
  return {
    id: playerId + ":" + year,
    playerId,
    name: playerId,
    season: year,
    debutSeason: year,
    age,
    team: "TEST",
    position: "SF",
    games: 80,
    minutes: 1000,
    fga: 500,
    fta: null,
    points: null,
    threeAttempts: null,
    threeMade: null,
    shares: [0.4, 0.1, 0.05, 0.15, 0.3],
    fg: [0.6, 0.4, 0.4, 0.4, 0.3],
    dataFlags: [],
    ts: null,
    leagueTs: null,
    rts: null,
    ...fields,
  };
}
function pool(...groups: SeasonRow[][]) {
  return new Map(groups.map((g) => [g[0].playerId, g]));
}

test("career totals pool zone attempts, minutes and TS opportunities across seasons", () => {
  const a = season("A", 2020, 20, {
    fga: 20,
    threeAttempts: 8,
    threeMade: 2,
    shares: [0.6, 0, 0, 0, 0.4],
    fg: [0.5, null, null, null, 0.25],
    points: 28,
    minutes: 100,
    fta: 10,
    rts: -2,
  });
  const b = season("A", 2022, 22, {
    fga: 180,
    threeAttempts: 90,
    threeMade: 45,
    shares: [0.5, 0, 0, 0, 0.5],
    fg: [0.7, null, null, null, 0.5],
    points: 219,
    minutes: 400,
    fta: 20,
    rts: 5,
  });
  const career = careerShootingTotals([a, b], 2020);
  assert.equal(career.seasons, 2);
  assert.equal(career.lastSeason, 2022);
  assert.equal(career.shares[4], 98 / 200);
  assert.equal(career.fg[4], 47 / 98);
  assert.equal(career.fg[1], null);
  assert.ok(Math.abs(career.fg[0]! - (12 * 0.5 + 90 * 0.7) / 102) < 1e-10);
  assert.equal(career.fga36, (36 * 200) / 500);
  assert.equal(career.points36, (36 * 247) / 500);
  assert.ok(Math.abs(career.rts! - (-2 * 24.4 + 5 * 188.8) / 213.2) < 1e-10);

  const incomplete = {
    ...b,
    shares: [null, null, null, null, null] as SeasonRow["shares"],
  };
  const partial = careerShootingTotals([a, incomplete], 2020);
  assert.equal(partial.shotSeasons, 1);
  assert.equal(partial.fg[4], 47 / 98);
  assert.equal(partial.shares[4], 98 / 200);
  assert.equal(partial.shares[0], 12 / 200);
  assert.equal(partial.fg[0], 0.5);
  const noThrees = careerShootingTotals(
    [{ ...a, threeAttempts: 0, threeMade: 0 }],
    2020,
  );
  assert.equal(noThrees.shares[4], 0);
  assert.equal(noThrees.fg[4], null);
});

test("browsing career seasons keeps each player's actual debut, gaps and last observation", () => {
  const a2 = season("A", 2021, 22);
  const a4 = season("A", 2023, 24);
  const b1 = season("B", 1998, 20);
  const b2 = season("B", 1999, 21);
  const b5 = season("B", 2002, 24);
  const stages = alignPeerStages([a4, a2], 2020, [b1, b2, b5], 1998);
  assert.deepEqual(
    stages.map((s) => s.year),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    stages.map((s) => [s.target?.id, s.peer?.id]),
    [
      [undefined, b1.id],
      [a2.id, b2.id],
      [undefined, undefined],
      [a4.id, undefined],
      [undefined, b5.id],
    ],
  );
});

test("matching uses the whole prefix, preserves career-year order and ignores future results", () => {
  const rim = { shares: [0.8, 0, 0, 0, 0.2] } as Partial<SeasonRow>;
  const arc = { shares: [0.2, 0, 0, 0, 0.8] } as Partial<SeasonRow>;
  const a = [
    season("A", 2021, 23, rim),
    season("A", 2022, 24, { ...arc, debutSeason: 2021 }),
    season("A", 2023, 25, { debutSeason: 2021 }),
  ];
  const same = [
    season("same", 2001, 19, rim),
    season("same", 2002, 20, { ...arc, debutSeason: 2001 }),
    season("same", 2003, 21, { debutSeason: 2001 }),
  ];
  const reversed = [
    season("rev", 2001, 23, arc),
    season("rev", 2002, 24, { ...rim, debutSeason: 2001 }),
    season("rev", 2003, 25, { debutSeason: 2001 }),
  ];
  const result = rankCareerPeers(a[2], pool(a, same, reversed));
  assert.equal(result.matches[0].baseline.playerId, "same");
  assert.equal(result.matches[0].score, 100);
  assert.equal(result.matches[0].alignedYears, 3);
  assert.deepEqual(
    result.matches[0].history.shares,
    result.matches[1].history.shares,
  );
  assert.ok(result.matches[1].components.mix < 100);
  assert.deepEqual(
    result,
    rankCareerPeers(
      a[2],
      pool(
        [...a, season("A", 2024, 26, { ...rim, debutSeason: 2021 })],
        [...same, season("same", 2004, 22, { ...arc, debutSeason: 2001 })],
        reversed,
      ),
    ),
  );
});

test("match primary position and years since NBA debut; exclude contemporary and unknown debuts", () => {
  const a = [
    season("A", 2022, 24, { position: "PF" }),
    season("A", 2023, 25, { position: "SF-PF", debutSeason: 2022 }),
  ];
  const sf = [
    season("sf", 2002, 23, { position: "SG" }),
    season("sf", 2003, 24, { position: "SF/PF", debutSeason: 2002 }),
  ];
  const pg = season("Apoint", 2023, 25, { position: "PG" });
  const sg = season("Bshooting", 2003, 25, { position: "SG" });
  const result = rankCareerPeers(
    a[1],
    pool(
      a,
      sf,
      [season("pf", 2010, 25, { debutSeason: 2009, position: "PF/SF" })],
      [season("different-stage", 2010, 25, { debutSeason: 2007 })],
      [
        season("concurrent", 2022, 25, { debutSeason: 2022 }),
        season("concurrent", 2023, 26, { debutSeason: 2022 }),
      ],
      [season("future", 2024, 25, { debutSeason: 2023 })],
      [season("unknown-debut", 2003, 25, { debutSeason: null })],
      [season("unknown", 2007, 25, { position: "NA", debutSeason: 2006 })],
    ),
  );
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].history.seasons, 2);
  assert.equal(result.matches[0].history.position, "SF");
  assert.ok(result.matches[0].score >= 99.99);
  assert.deepEqual(rankCareerPeers(pg, pool([pg], [sg])).matches, []);
});

test("pool shot counts for career mix/accuracy and independently pool minutes for volume", () => {
  const rows = [
    season("P", 2003, 22, {
      fga: 100,
      minutes: 100,
      shares: [0.8, 0, 0, 0, 0.2],
      fg: [0.5, null, null, null, null],
    }),
    season("P", 2004, 23, {
      debutSeason: 2003,
      fga: 300,
      minutes: 900,
      shares: [0.4, 0, 0, 0, 0.6],
      fg: [0.25, null, null, null, 0],
    }),
    season("P", 2005, 24, {
      debutSeason: 2003,
      fga: 50,
      minutes: 500,
      shares: [null, 0, 0, 0, 1],
      fg: [null, null, null, null, 1],
    }),
  ];
  const history = careerProfile(rows[2], [...rows].reverse())!;
  assert.equal(history.seasons, 3);
  assert.equal(history.shotSeasons, 2);
  assert.equal(history.firstAge, 22);
  assert.equal(history.lastAge, 24);
  assert.equal(history.attempts, 400);
  assert.deepEqual(history.shares, [0.5, 0, 0, 0, 0.5]);
  assert.deepEqual(history.fg, [0.35, null, null, null, 0]);
  assert.deepEqual(history.fgAttempts, [200, 0, 0, 0, 180]);
  assert.equal(history.fga36, (36 * 450) / 1500);
});

test("small or unknown zone FG does not act as a zero; component scores have interpretable units", () => {
  const a = season("A", 2025, 25, {
    fga: 500,
    shares: [0.99, 0.01, 0, 0, 0],
    fg: [0.75, 1, null, null, null],
  });
  const b = season("B", 2021, 25, {
    fga: 250,
    shares: [0.99, 0.01, 0, 0, 0],
    fg: [0.5, 0, null, null, null],
  });
  const { components, score } = rankCareerPeers(a, pool([a], [b])).matches[0];
  assert.deepEqual(components, { mix: 100, accuracy: 75, volume: 50 });
  assert.equal(score, 75);
  const absent = { ...b, fg: [null, 0, null, null, null] } as SeasonRow;
  assert.deepEqual(rankCareerPeers(a, pool([a], [absent])).matches, []);
  assert.equal(careerProfile({ ...a, fga: 0 }, [{ ...a, fga: 0 }]), null);
});

test("missing career years and the start of shooting coverage do not renumber NBA seasons", () => {
  const a = [
    season("A", 2005, 23),
    season("A", 2007, 25, { debutSeason: 2005 }),
  ];
  // B debuted before the shot archive; his 1996–97 record is already year three.
  const b = [season("B", 1997, 27, { debutSeason: 1995 })];
  const noThirdYear = [
    season("missed", 2000, 21),
    season("missed", 2001, 22, { debutSeason: 2000 }),
    season("missed", 2003, 24, { debutSeason: 2000 }),
  ];
  const result = rankCareerPeers(a[1], pool(a, b, noThirdYear));
  assert.equal(result.target?.careerYear, 3);
  assert.deepEqual(
    result.matches.map((m) => [
      m.baseline.playerId,
      m.history.debutSeason,
      m.history.careerYear,
      m.alignedYears,
    ]),
    [["B", 1995, 3, 1]],
  );
  const noDebut = { ...a[1], debutSeason: undefined };
  assert.deepEqual(rankCareerPeers(noDebut, pool(a, b)), {
    target: null,
    matches: [],
  });
});

test("Doncic never matches Trae Young or any player who entered the NBA the same season or later", () => {
  const { rows }: { rows: SeasonRow[] } = JSON.parse(
    readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
  );
  const careers = new Map<string, SeasonRow[]>();
  for (const row of rows) {
    const group = careers.get(row.playerId);
    if (group) group.push(row);
    else careers.set(row.playerId, [row]);
  }
  const luka = careers.get("doncilu01")!;
  const trae = careers.get("youngtr01")!;
  assert.equal(luka[0].debutSeason, 2019);
  assert.equal(trae[0].debutSeason, 2019);
  for (const row of luka) {
    const { target, matches } = rankCareerPeers(row, careers);
    assert.ok(target);
    assert.ok(matches.length);
    assert.ok(matches.some((m) => m.baseline.age !== row.age));
    assert.ok(
      matches.every(
        (m) =>
          m.baseline.playerId !== "youngtr01" &&
          m.history.debutSeason < target.debutSeason &&
          m.history.careerYear === target.careerYear &&
          m.baseline.season < row.season,
      ),
    );
  }
});
