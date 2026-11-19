import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const options = { cwd: fileURLToPath(root), stdio: "inherit" };

if (!existsSync(new URL("public/data/nba.json", root))) {
  execFileSync(process.execPath, ["scripts/sync-data.mjs"], options);
}
if (!existsSync(new URL("public/data/shots/index.json", root))) {
  execFileSync("python3", ["scripts/sync-shots.py"], options);
}
