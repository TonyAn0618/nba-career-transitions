import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { courtRegionId, courtRegions } from "../src/lib/court-regions.ts";

const root = new URL("../", import.meta.url);
const shotDir = new URL("public/data/shots/", root);
const output = new URL("src/lib/league-court-regions.json", root);
const manifest = JSON.parse(
  readFileSync(new URL("data/shot-manifest.json", root), "utf8"),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const indexBytes = readFileSync(new URL("index.json", shotDir));
const sourceIndexSha256 = sha256(indexBytes);
assert.equal(
  sourceIndexSha256,
  manifest.index.sha256,
  "Run npm run prepare:data to refresh the shot index.",
);
const index = JSON.parse(indexBytes);
const seasons = Object.fromEntries(
  index.league.map(({ season }) => [
    season,
    Object.fromEntries(courtRegions.map(({ id }) => [id, [0, 0]])),
  ]),
);

for (const { season, file, sha256: expectedHash } of Object.values(
  index.playerSeasons,
)) {
  const bytes = readFileSync(new URL(file, shotDir));
  assert.equal(
    sha256(bytes),
    expectedHash,
    `Shot file differs from the pinned index: ${file}`,
  );
  const regionCounts = seasons[season];
  for (const shot of JSON.parse(bytes).shots) {
    const counts = regionCounts[courtRegionId(shot)];
    counts[0] += shot[2];
    counts[1]++;
  }
}

for (const { season, made, attempts } of index.league) {
  const counts = Object.values(seasons[season]);
  assert.equal(
    counts.reduce((sum, [m]) => sum + m, 0),
    made,
    `League makes for ${season}`,
  );
  assert.equal(
    counts.reduce((sum, [, a]) => sum + a, 0),
    attempts,
    `League attempts for ${season}`,
  );
}

const result = { sourceIndexSha256, seasons };
if (process.argv.includes("--check")) {
  assert.deepEqual(
    result,
    JSON.parse(readFileSync(output, "utf8")),
    "Regenerate with npm run data:court-regions.",
  );
} else {
  writeFileSync(
    output,
    await format(JSON.stringify(result), { parser: "json" }),
  );
}
console.log(
  `Verified ${index.metadata.totalShots.toLocaleString("en-US")} shots across ${index.league.length} seasons and ${courtRegions.length} court regions.`,
);
