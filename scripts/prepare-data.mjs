import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const options = { cwd: fileURLToPath(root), stdio: "inherit" };

const expected = JSON.parse(
  readFileSync(new URL("data/source-manifest.json", root), "utf8"),
);
let currentSeasons = false;
try {
  const cached = JSON.parse(
    readFileSync(new URL("public/data/nba.json", root), "utf8"),
  );
  currentSeasons =
    cached.metadata?.lastSeason === expected.lastSeason &&
    cached.metadata?.sourceCommit === expected.sourceCommit;
} catch (error) {
  if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
}
if (
  !currentSeasons ||
  !existsSync(new URL("public/data/team-splits.json", root))
) {
  execFileSync(process.execPath, ["scripts/sync-data.mjs"], options);
}
if (!existsSync(new URL("public/data/shots/index.json", root))) {
  execFileSync("python3", ["scripts/sync-shots.py"], options);
}
