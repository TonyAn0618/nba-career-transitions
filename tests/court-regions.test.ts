import assert from "node:assert/strict";
import { test } from "node:test";
import {
  courtRegionId,
  courtRegionStats,
  courtRegions,
} from "../src/lib/court-regions.ts";
import type { Shot } from "../src/lib/shots.ts";

function shot(x: number, y: number, points: 2 | 3, made: 0 | 1 = 0): Shot {
  return [
    x,
    y,
    made,
    points,
    Math.floor(Math.hypot(x, y - 5.25)),
    1,
    "0020000000",
    "2020-01-01",
    1,
    600,
    "",
    "",
    "",
  ];
}

test("fourteen frontcourt labels and the backcourt label fall inside their own regions", () => {
  assert.equal(new Set(courtRegions.map((r) => r.id)).size, 15);
  for (const region of courtRegions) {
    const three = region.id.startsWith("three-") || region.id === "backcourt";
    assert.equal(
      courtRegionId(shot(...region.label, three ? 3 : 2)),
      region.id,
    );
    assert.doesNotMatch(region.path, /Infinity|NaN|undefined/);
  }
});

test("radial boundaries, shallow corners, and the halfcourt line have a single owner", () => {
  assert.equal(courtRegionId(shot(0, 13.74, 2)), "rim");
  assert.equal(courtRegionId(shot(0, 13.75, 2)), "near-center");
  assert.equal(courtRegionId(shot(0, 21.25, 2)), "mid-center");
  assert.equal(courtRegionId(shot(-23, 7.2, 3)), "three-left-corner");
  assert.equal(courtRegionId(shot(-23, 7.21, 3)), "three-left-wing");
  assert.equal(courtRegionId(shot(0, 47, 3)), "three-top");
  assert.equal(courtRegionId(shot(0, 47.01, 3)), "backcourt");
  // Two Russell shots in 2022–23 are officially threes just inside the drawn line.
  assert.equal(courtRegionId(shot(-21.9, 7.85, 3)), "three-left-wing");
  assert.equal(courtRegionId(shot(-21.7, 14.65, 3)), "three-left-wing");
});

test("regional totals conserve all attempts, including backcourt, and distinguish zero from unavailable", () => {
  const shots = [
    shot(0, 6, 2, 1),
    shot(0, 6.2, 2),
    shot(23, 2, 3),
    shot(0, 52, 3, 1),
  ];
  const stats = courtRegionStats(shots);
  assert.deepEqual(stats.get("rim"), {
    attempts: 2,
    made: 1,
    share: 0.5,
    fg: 0.5,
  });
  assert.deepEqual(stats.get("three-right-corner"), {
    attempts: 1,
    made: 0,
    share: 0.25,
    fg: 0,
  });
  assert.deepEqual(stats.get("near-center"), {
    attempts: 0,
    made: 0,
    share: 0,
    fg: null,
  });
  assert.deepEqual(stats.get("backcourt"), {
    attempts: 1,
    made: 1,
    share: 0.25,
    fg: 1,
  });
  const total = [...stats.values()].reduce(
    (sum, r) => [sum[0] + r.attempts, sum[1] + r.made, sum[2] + (r.share ?? 0)],
    [0, 0, 0],
  );
  assert.deepEqual(total, [4, 2, 1]);
  assert.deepEqual(courtRegionStats([]).get("rim"), {
    attempts: 0,
    made: 0,
    share: null,
    fg: null,
  });
});
