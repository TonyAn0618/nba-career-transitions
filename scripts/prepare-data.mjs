import { createHash } from "node:crypto";
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
    cached.metadata?.sourceCommit === expected.sourceCommit &&
    cached.rows?.length === expected.rowCount &&
    cached.rows.every(
      (row) => Object.hasOwn(row, "debutSeason") && Object.hasOwn(row, "fgm"),
    );
} catch (error) {
  if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
}
if (
  !currentSeasons ||
  !existsSync(new URL("public/data/team-splits.json", root))
) {
  execFileSync(process.execPath, ["scripts/sync-data.mjs"], options);
}
const shotManifest = JSON.parse(
  readFileSync(new URL("data/shot-manifest.json", root), "utf8"),
);
const shotIndex = new URL(shotManifest.index.file, root);
if (
  !existsSync(shotIndex) ||
  createHash("sha256").update(readFileSync(shotIndex)).digest("hex") !==
    shotManifest.index.sha256
) {
  execFileSync("python3", ["scripts/sync-shots.py"], options);
}
