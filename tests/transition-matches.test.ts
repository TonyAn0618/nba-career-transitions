import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  matchTransitions,
  matchedFollowup,
  transitionProfile,
  transitionScore,
  type TransitionProfile,
} from "../src/lib/transition-matches.ts";
import {
  pointsPer36,
  scoutingReading,
  twinPerformance,
} from "../src/lib/twin-performance.ts";
import { pairedCareer, pairedFollowup } from "../src/lib/paired-career.ts";
import { detectCareerShifts } from "../src/lib/career-shifts.ts";
import {
  followupReading,
  largestChangeGap,
  sharedCounterpart,
  leagueComparison,
  thirdSeasonReference,
} from "../src/lib/comparison-takeaways.ts";
import { zoneChanges } from "../src/lib/transitions.ts";
import type { Dataset, SeasonRow } from "../src/lib/types.ts";
const data: Dataset = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
);
const careers = new Map<string, SeasonRow[]>();
for (const row of data.rows) {
  if (!careers.has(row.playerId)) careers.set(row.playerId, []);
  careers.get(row.playerId)!.push(row);
}
const edwards = careers.get("edwaran01")!;
const a = edwards.find((r) => r.season === 2024)!;
const b = edwards.find((r) => r.season === 2025)!;
function near(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    actual + " differs from " + expected,
  );
}
test("detects a concentrated multi-season shift and ranks disjoint career intervals", () => {
  const rows = [0.1, 0.25, 0.4, 0.4, 0.4, 0.2].map((three, i): SeasonRow => ({
    ...b,
    season: 2000 + i,
    shares: [1 - three, 0, 0, 0, three],
  }));
  const { examined, shifts } = detectCareerShifts([...rows].reverse());
  assert.equal(examined, 12);
  assert.deepEqual(
    shifts.map((s) => [s.first.season, s.last.season, s.score]),
    [
      [2000, 2002, 25],
      [2004, 2005, 20],
    ],
  );
  near(shifts[0].distance, 30);
  const gap = rows.filter((r) => r.season !== 2001);
  const invalid = rows.map((r) => (r.season === 2001 ? { ...r, fga: 199 } : r));
  for (const records of [gap, invalid]) {
    assert.deepEqual(
      detectCareerShifts(records).shifts.map((s) => s.first.season),
      [2004],
    );
  }
  assert.deepEqual(detectCareerShifts(rows.slice(2, 5)).shifts, []);
});
test("the highest Edwards detection opens the same real twin as the corresponding manual seasons", () => {
  const detected = detectCareerShifts(edwards);
  assert.equal(detected.examined, 12);
  const best = detected.shifts[0];
  assert.equal(best.first.id, a.id);
  assert.equal(best.last.id, b.id);
  assert.equal(best.driver, 4);
  assert.equal(
    matchTransitions(best.first, best.last, careers).matches[0].b.name,
    "Jordan Hamilton",
  );
});
test("signed changes score direction and magnitude, with a defined zero baseline", () => {
  const x: TransitionProfile = {
    start: [0.3, 0.2, 0.2, 0.1, 0.2],
    change: [-0.1, 0, 0, 0, 0.1],
    volume: [10, 20],
  };
  const flat = { ...x, change: [0, 0, 0, 0, 0] };
  near(transitionScore(x, x).score, 100);
  near(transitionScore(flat, flat).shift, 1);
  near(transitionScore(x, flat).shift, 0);
  near(transitionScore(x, { ...x, change: x.change.map((v) => -v) }).shift, 0);
  const half: TransitionProfile = {
    start: [0.4, 0.1, 0.2, 0.1, 0.2],
    change: x.change.map((v) => v / 2),
    volume: [20, 20],
  };
  const score = transitionScore(x, half);
  near(score.shift, 2 / 3);
  near(score.start, 0.9);
  near(score.volume, 0.75);
  near(score.score, 100 * ((0.6 * 2) / 3 + 0.25 * 0.9 + 0.15 * 0.75));
  near(score.score, transitionScore(half, x).score);
});
test("both endpoints require complete shares, age, qualifying attempts and valid playing time", () => {
  for (const patch of [
    { age: null },
    { fga: 199 },
    { minutes: 0 },
    { shares: [0.4, null, 0.1, 0.2, 0.3] },
    { shares: [0.4, 0.3, 0.2, 0.1, 0.1] },
  ] as Partial<SeasonRow>[]) {
    assert.equal(transitionProfile({ ...a, ...patch }, b), null);
    assert.equal(transitionProfile(a, { ...b, ...patch }), null);
  }
  const p = transitionProfile({ ...a, fga: 200 }, b)!;
  near(
    p.start.reduce((acc, n) => acc + n, 0),
    1,
  );
  near(
    p.change.reduce((acc, n) => acc + n, 0),
    0,
  );
});
test("only earlier age-matched pairs with the same interval enter, independently of follow-up", () => {
  const pool = new Map<string, SeasonRow[]>();
  const pair = (id: string, from: number, to: number, age = 23) => [
    { ...a, playerId: id, season: from },
    { ...b, playerId: id, season: to, age },
  ];
  pool.set("eligible", pair("eligible", 2019, 2020));
  pool.set("edwaran01", pair("edwaran01", 2019, 2020));
  pool.set("sameEnd", pair("sameEnd", 2024, 2025));
  pool.set("future", pair("future", 2025, 2026));
  pool.set("otherAge", pair("otherAge", 2019, 2020, 24));
  pool.set("otherSpan", pair("otherSpan", 2018, 2020));
  const before = matchTransitions(a, b, pool);
  assert.deepEqual(
    before.matches.map((m) => m.b.playerId),
    ["eligible"],
  );
  pool.get("eligible")!.push({
    ...b,
    playerId: "eligible",
    age: 24,
    season: 2021,
    shares: [0, 0, 0, 0, 1],
    rts: -99,
  });
  assert.deepEqual(matchTransitions(a, b, pool), before);
});
test("Edwards ranks real intervals and follow-up keeps missing years and the as-of boundary", () => {
  const found = matchTransitions(a, b, careers);
  assert.equal(found.count, 450);
  assert.deepEqual(
    found.matches.map((m) => [m.b.name, m.similarity.score.toFixed(1)]),
    [
      ["Jordan Hamilton", "86.5"],
      ["Michael Redd", "80.6"],
      ["Jumaine Jones", "78.9"],
    ],
  );
  const [hamilton, redd] = found.matches;
  const trajectory = (m: typeof redd) =>
    matchedFollowup(m.b, careers.get(m.b.playerId)!, b.season);
  assert.deepEqual(
    trajectory(redd).map((v) => v.row?.shares[4]),
    [0.428, 0.252, 0.207, 0.272],
  );
  assert.deepEqual(
    trajectory(hamilton).map((v) => v.row?.fga),
    [376, 35, 116, undefined],
  );
  const gap = matchedFollowup(
    redd.b,
    careers.get(redd.b.playerId)!.filter((r) => r.season !== redd.b.season + 1),
    redd.b.season + 2,
  );
  assert.deepEqual(
    gap.map((v) => [v.observable, v.row?.season]),
    [
      [true, 2003],
      [true, undefined],
      [true, 2005],
      [false, undefined],
    ],
  );
});

test("takeaways follow the selected twin and quantify the largest signed difference", () => {
  const [hamilton, redd] = matchTransitions(a, b, careers).matches;
  const english = (en: string) => en;
  const reading = (peer: typeof hamilton) =>
    followupReading(
      peer.a.shares[4]!,
      4,
      matchedFollowup(peer.b, careers.get(peer.b.playerId)!, b.season),
      english,
    );
  assert.deepEqual(
    largestChangeGap(zoneChanges(a, b), zoneChanges(hamilton.a, hamilton.b)),
    { band: 3, gap: 4.6 },
  );
  assert.equal(
    sharedCounterpart(
      zoneChanges(a, b),
      zoneChanges(hamilton.a, hamilton.b),
      4,
    ),
    0,
  );
  assert.equal(
    sharedCounterpart(
      zoneChanges(a, b),
      zoneChanges(hamilton.a, hamilton.b),
      3,
    ),
    null,
  );
  assert.deepEqual(
    largestChangeGap(zoneChanges(a, b), zoneChanges(redd.a, redd.b)),
    { band: 4, gap: 5.9 },
  );
  assert.equal(largestChangeGap([1, null, -2], [1, 10, -2]), undefined);
  assert.match(
    reading(hamilton),
    /year 2.*38\.8%.*down from the end, still above the start.*116 total attempts.*No year 3 record/,
  );
  assert.match(reading(redd), /year 3.*27\.2%.*below the pre-shift share/);
  assert.match(
    followupReading(
      a.shares[4]!,
      4,
      matchedFollowup(b, edwards, b.season),
      english,
    ),
    /outside coverage/,
  );
});

test("the named twin determines both endpoint changes and persistence in the recommendation", () => {
  const [hamilton, redd, jones] = matchTransitions(a, b, careers).matches;
  const assess = (peer: typeof hamilton) =>
    twinPerformance(
      peer.a,
      peer.b,
      matchedFollowup(peer.b, careers.get(peer.b.playerId)!, b.season),
    );
  const h = assess(hamilton),
    r = assess(redd),
    j = assess(jones);
  assert.deepEqual(
    [
      h.efficiencyChange,
      h.scoringChange,
      h.efficiencyPersistence,
      h.scoringPersistence,
    ],
    [1.1, -4.6, "unknown", "unknown"],
  );
  assert.deepEqual(
    h.later.map((row) => [row.fga, row.efficiencyHeld, row.scoringHeld]),
    [
      [35, null, null],
      [116, null, null],
      [null, null, null],
    ],
  );
  assert.equal(h.later[0].rate?.toFixed(1), "11.2");
  assert.deepEqual(
    [
      r.efficiencyChange,
      r.scoringChange,
      r.efficiencyPersistence,
      r.scoringPersistence,
    ],
    [0.9, -0.2, "interrupted", "interrupted"],
  );
  assert.deepEqual(
    [
      j.efficiencyChange,
      j.scoringChange,
      j.efficiencyPersistence,
      j.scoringPersistence,
    ],
    [2.5, 1.5, "interrupted", "partial"],
  );
  const read = (peer: typeof hamilton, performance: typeof h, band = 4) =>
    scoutingReading(
      [a, b],
      [peer.a, peer.b],
      [b.name, peer.b.name],
      band,
      band === 4 ? "三分" : "长两分",
      performance,
      (_en, zh) => zh,
    );
  assert.match(
    read(hamilton, h).result,
    /Hamilton.*真实命中率提高.*单位时间得分下降.*仍不清楚/,
  );
  assert.match(read(hamilton, h).action, /Edwards.*同步提高.*守住得分产量/);
  assert.match(read(redd, r).result, /Redd.*都未能持续/);
  assert.notEqual(read(redd, r).action, read(hamilton, h).action);
  assert.match(read(hamilton, h, 3).action, /没有共同.*自己的比赛/);
  for (const sentence of Object.values(read(hamilton, h))) {
    assert.equal(sentence.split("。").length, 2);
    assert.doesNotMatch(sentence, /[0-9%]|样本/);
  }
});

test("persistence uses the pre-shift baseline separately for each metric and every eligible year", () => {
  const start = { ...a, points: 100, minutes: 360, rts: 2 };
  const end = { ...b, points: 150, minutes: 360, rts: 4 };
  const rows = [1, 2, 3].map((offset) => ({
    ...end,
    season: end.season + offset,
    points: 130,
    rts: 3,
    fga: 200,
  }));
  const review = (history: SeasonRow[], limit = end.season + 3) =>
    twinPerformance(start, end, matchedFollowup(end, history, limit));
  const held = review(rows);
  assert.deepEqual(
    [held.efficiencyPersistence, held.scoringPersistence],
    ["sustained", "sustained"],
  );
  const partial = review([
    { ...rows[0], fga: 199 },
    { ...rows[1], minutes: 0, rts: 0 },
    rows[2],
  ]);
  assert.deepEqual(
    partial.later.map((r) => [r.efficiencyHeld, r.scoringHeld]),
    [
      [null, null],
      [false, null],
      [true, true],
    ],
  );
  assert.deepEqual(
    [partial.efficiencyPersistence, partial.scoringPersistence],
    ["interrupted", "partial"],
  );
  const incomplete = review(
    [{ ...rows[0], points: 0, rts: null }, rows[2]],
    end.season + 2,
  );
  assert.deepEqual(
    incomplete.later.map((r) => [
      r.observable,
      r.efficiencyHeld,
      r.scoringHeld,
    ]),
    [
      [true, null, false],
      [true, null, null],
      [false, null, null],
    ],
  );
  assert.equal(incomplete.later[2].rts, null);
  const unavailable = twinPerformance(
    { ...start, rts: null, minutes: null },
    end,
    matchedFollowup(end, rows, end.season + 3),
  );
  assert.deepEqual(
    [
      unavailable.efficiencyChange,
      unavailable.scoringChange,
      unavailable.scoringPersistence,
    ],
    [null, null, "unknown"],
  );
  assert.equal(pointsPer36({ ...start, points: 0 }), 0);
  assert.equal(pointsPer36({ ...start, minutes: 0 }), null);
  const flat = twinPerformance(
    { ...start, rts: end.rts },
    end,
    matchedFollowup(end, [{ ...rows[0], rts: end.rts + 0.02 }], end.season + 1),
  );
  assert.equal(flat.efficiencyChange, 0);
  assert.equal(flat.later[0].efficiencyHeld, true);
});

test("a gap or a missing zone cannot become an observed zero or a year-three conclusion", () => {
  const low = {
    ...b,
    season: b.season + 1,
    shares: [0, 0, 0, 1, 0] as SeasonRow["shares"],
  };
  const missing = {
    ...low,
    season: b.season + 3,
    shares: [0, 0, 0, null, null] as SeasonRow["shares"],
  };
  const records = matchedFollowup(b, [b, low, missing], missing.season);
  const english = (en: string) => en;
  assert.match(
    followupReading(0.8, 4, records, english),
    /year 1.*0\.0%, below the end-of-window share.*No zone share for year 3/,
  );
  assert.match(
    followupReading(
      0.8,
      4,
      matchedFollowup(b, [b, missing], missing.season),
      english,
    ),
    /No follow-up share recorded/,
  );
});

test("year-three reference counts one eligible outcome per ranked player with enough attempts", () => {
  const matches = matchTransitions(a, b, careers).matches;
  const review = (asOf: number, direction: number) =>
    thirdSeasonReference(matches, careers, asOf, 4, direction);
  const reference = review(b.season, 1);
  assert.deepEqual(
    reference.cases.map((c) => c.rts?.toFixed(1)),
    [undefined, "3.8", "-2.9"],
  );
  assert.equal(
    leagueComparison(reference.cases[1].rts!, (en) => en),
    "3.8 pp above the league average",
  );
  assert.deepEqual([reference.eligible, reference.retained], [2, 1]);
  assert.deepEqual(
    reference.cases.map((c) => c.outcome),
    ["absent", "not-retained", "retained"],
  );
  assert.equal(review(2002, 1).eligible, 0);
  assert.equal(review(b.season, -1).eligible, 0);
  assert.equal(review(b.season, 0).eligible, 0);
  const jones = matches[2];
  const rows = careers
    .get(jones.b.playerId)!
    .map((r) => (r.season === jones.b.season + 3 ? { ...r, fga: 199 } : r));
  const limited = thirdSeasonReference(
    [jones],
    new Map([[jones.b.playerId, rows]]),
    b.season,
    4,
    1,
  );
  assert.equal(limited.cases[0].outcome, "sample");
  assert.equal(limited.eligible, 0);
});

test("career charts include both full histories while the follow-up table keeps its historical cutoff", () => {
  const primary = [2022, 2024, 2025].map((season) => ({ ...b, season }));
  const peer = [2021, 2022, 2024, 2025].map((season) => ({ ...a, season }));
  const axis = pairedCareer(primary, peer, 2024, 2022);
  assert.deepEqual(
    axis.map((v) => [v.offset, ...v.rows.map((r) => r?.season)]),
    [
      [-2, 2022, undefined],
      [-1, undefined, 2021],
      [0, 2024, 2022],
      [1, 2025, undefined],
      [2, undefined, 2024],
      [3, undefined, 2025],
    ],
  );
  assert.deepEqual(axis[0].years, [2022, null]);
  assert.deepEqual(axis[1].years, [2023, 2021]);
  assert.deepEqual(axis[3].years, [2025, 2023]);
  assert.deepEqual(axis[5].years, [null, 2025]);
  assert.deepEqual(
    pairedCareer(primary.slice(0, 2), peer.slice(0, 2), 2024, 2022).map(
      (c) => c.offset,
    ),
    [-2, -1, 0],
  );
  const stages = pairedFollowup(primary[1], primary, peer[1], peer, 2025);
  assert.deepEqual(
    stages.map((pair) =>
      pair.map((r) => [r.year, r.observable, r.row?.season]),
    ),
    [
      [
        [2024, true, 2024],
        [2022, true, 2022],
      ],
      [
        [2025, true, 2025],
        [2023, true, undefined],
      ],
      [
        [2026, false, undefined],
        [2024, true, 2024],
      ],
      [
        [2027, false, undefined],
        [2025, false, undefined],
      ],
    ],
  );
});
