/** Node 24: node scripts/backtest-age-peers.mjs [--check] */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { adequateSeason, cohortOutlook } from "../src/lib/age-peers.ts";

import { careerProfile, rankCareerPeers } from "../src/lib/career-peers.ts";

const firstQuery = 2015,
  lastQuery = 2020,
  horizons = [1, 3, 5];
const lastOutcome = lastQuery + Math.max(...horizons);
const data = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
);
assert.ok(
  data.metadata.lastSeason >= lastOutcome,
  "Snapshot ends within the evaluation window.",
);
const output = new URL("../src/lib/age-peer-backtest.json", import.meta.url);
const careers = new Map();
for (const row of data.rows.filter((row) => row.season <= lastOutcome)) {
  if (!careers.has(row.playerId)) careers.set(row.playerId, []);
  careers.get(row.playerId).push(row);
}

// Select each player once, using only information available at the first qualifying query.
const queries = [];
for (const career of careers.values()) {
  const first = career
    .sort((a, b) => a.season - b.season)
    .find(
      (row) =>
        firstQuery <= row.season &&
        row.season <= lastQuery &&
        row.age >= 20 &&
        row.age <= 26 &&
        row.minutes >= 1000 &&
        Number.isFinite(row.rts) &&
        careerProfile(row, career),
    );
  if (first) queries.push(first);
}
const totals = horizons.map((years) => ({
  years,
  scored: 0,
  noQualifyingOutcome: 0,
  insufficientPeersWithOutcome: 0,
  peerError: 0,
  persistenceError: 0,
  hits: 0,
}));
for (let asOf = firstQuery; asOf <= lastQuery; asOf++) {
  // Physically remove every post-query observation before ranking or forecasting.
  const known = new Map(
    [...careers].map(([id, rows]) => [
      id,
      rows.filter((row) => row.season <= asOf),
    ]),
  );
  for (const anchor of queries.filter((row) => row.season === asOf)) {
    const { matches } = rankCareerPeers(anchor, known);
    const predictions = cohortOutlook(matches, known, anchor);
    for (const metric of totals) {
      const { years } = metric;
      const observed = careers
        .get(anchor.playerId)
        .find(
          (row) =>
            row.season === asOf + years &&
            row.age === anchor.age + years &&
            adequateSeason(row) &&
            Number.isFinite(row.rts),
        );
      if (!observed) {
        metric.noQualifyingOutcome++;
        continue;
      }
      const { prediction, scenario } = predictions[years];
      if (prediction == null || !scenario) {
        metric.insufficientPeersWithOutcome++;
        continue;
      }
      metric.scored++;
      metric.peerError += Math.abs(prediction - observed.rts);
      metric.persistenceError += Math.abs(anchor.rts - observed.rts);
      if (scenario[0] <= observed.rts && observed.rts <= scenario[1])
        metric.hits++;
    }
  }
}
const round = (n) => Number(n.toFixed(3));
const report = {
  sourceCommit: data.metadata.sourceCommit,
  firstQuery,
  lastQuery,
  lastOutcome,
  minAge: 20,
  maxAge: 26,
  minAnchorMinutes: 1000,
  minPairedPeers: 3,
  uniqueQueries: queries.length,
  horizons: totals.map(
    ({
      years,
      scored,
      noQualifyingOutcome,
      insufficientPeersWithOutcome,
      peerError,
      persistenceError,
      hits,
    }) => {
      assert.ok(scored > 0);
      assert.equal(
        scored + noQualifyingOutcome + insufficientPeersWithOutcome,
        queries.length,
      );
      return {
        years,
        scored,
        noQualifyingOutcome,
        insufficientPeersWithOutcome,
        peerMae: round(peerError / scored),
        persistenceMae: round(persistenceError / scored),
        intervalHits: hits,
        coveragePct: round((100 * hits) / scored),
      };
    },
  ),
};
if (process.argv.includes("--check"))
  assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), report);
else writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
