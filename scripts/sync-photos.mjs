import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { TRANSITION_CASES } from "../src/lib/transitions.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const commit = "ec190700dab27498b3f75ecac8f932e3a3ee1606";
const identityUrl = `https://raw.githubusercontent.com/swar/nba_api/${commit}/src/nba_api/stats/library/data.py`;
const imageBase = "https://cdn.nba.com/headshots/nba/latest/260x190/";
const referenceImageBase =
  "https://www.basketball-reference.com/req/202106291/images/headshots/";
const archiveOverrides = {
  gatlich01:
    "https://cskabasket.com/upload/resize_cache/32a/705_705_2/51-gatling-750.jpg",
};
// The NBA serves this generic silhouette as a successful PNG response.
const placeholderHash =
  "b3ebe78bfd1cecb8880e51e6a48c9093c5cfb7065f981826d12fb4c01a1b0965";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Only spelling-neutral transformations. In particular, keep Jr., Sr., II,
// III, and other suffixes: removing them can silently select the wrong person.
export const normalizeFullName = (name) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

export function matchIdentities(players, identities) {
  const nbaByName = new Map(),
    localByName = new Map();
  for (const entry of identities) {
    const key = normalizeFullName(entry.name);
    nbaByName.set(key, [...(nbaByName.get(key) ?? []), entry]);
  }
  for (const entry of players) {
    const key = normalizeFullName(entry.name);
    localByName.set(key, [...(localByName.get(key) ?? []), entry]);
  }
  const matched = {},
    unresolved = [];
  for (const player of players) {
    const key = normalizeFullName(player.name),
      candidates = nbaByName.get(key) ?? [];
    if (candidates.length !== 1 || localByName.get(key).length !== 1) {
      unresolved.push({
        playerId: player.id,
        name: player.name,
        reason: candidates.length === 0 ? "unmatched" : "ambiguous",
        candidates: candidates.map(({ id, name }) => ({ id, name })),
      });
      continue;
    }
    matched[player.id] = candidates[0].id;
  }
  return { matched, unresolved };
}

function parseIdentities(source) {
  // Parse the literal NBA list as data; never execute the downloaded Python.
  const literal = source.match(/^players = (\[[\s\S]*?\n\])/m)?.[1];
  if (!literal)
    throw new Error("NBA identity source has an unexpected format.");
  const rows = JSON.parse(
    literal
      .replace(/\bFalse\b/g, "false")
      .replace(/\bTrue\b/g, "true")
      .replace(/,(\s*\])/g, "$1"),
  );
  if (
    rows.length < 4000 ||
    rows.some(
      (r) => !Number.isInteger(r[0]) || r[0] <= 0 || typeof r[3] !== "string",
    )
  ) {
    throw new Error("NBA identity source failed its schema check.");
  }
  return rows.map((row) => ({ id: row[0], name: row[3] }));
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function isHeadshot(bytes) {
  return (
    bytes.length > 1000 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.readUInt32BE(16) === 260 &&
    bytes.readUInt32BE(20) === 190
  );
}

async function readPortrait(file, url, isValid) {
  if (!process.argv.includes("--refresh")) {
    try {
      const cached = await readFile(file);
      if (isValid(cached)) return cached;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const bytes = await download(url);
  if (!isValid(bytes)) throw new Error(`Invalid portrait from ${url}`);
  return bytes;
}

async function sync() {
  const dataset = JSON.parse(
    await readFile(resolve(root, "public/data/nba.json"), "utf8"),
  );
  const source = await download(identityUrl),
    identities = parseIdentities(source.toString("utf8"));
  const { matched, unresolved } = matchIdentities(dataset.players, identities);
  const portraitDir = resolve(root, "public/players");
  await mkdir(portraitDir, { recursive: true });
  const previous = JSON.parse(
    await readFile(resolve(root, "src/lib/player-photos.json"), "utf8"),
  );
  const selected = new Set([
    ...TRANSITION_CASES.map((entry) => entry.player),
    ...previous.bundled,
    ...(previous.archived ?? []),
    ...previous.unavailable,
    ...(await readdir(portraitDir))
      .filter((file) => /\.(?:png|jpg)$/.test(file))
      .map((file) => file.slice(0, -4)),
  ]);
  const bundled = [],
    archived = [],
    unavailable = [],
    images = [],
    failures = [];
  const refresh = process.argv.includes("--refresh");
  const knownArchives = new Set(previous.archived);
  const knownSilhouettes = new Set(previous.unavailable);
  for (const playerId of selected) {
    const nbaId = matched[playerId];
    try {
      let url = `${imageBase}${nbaId}.png`;
      let file = `public/players/${playerId}.png`;
      let bytes;
      if (!refresh && knownSilhouettes.has(playerId)) {
        unavailable.push(playerId);
      } else if (nbaId && (refresh || !knownArchives.has(playerId))) {
        try {
          bytes = await readPortrait(resolve(root, file), url, isHeadshot);
        } catch {
          // The same player's archive can still supply a photo if the NBA request fails.
        }
        if (bytes && sha256(bytes) === placeholderHash) {
          unavailable.push(playerId);
          await rm(resolve(root, file), { force: true });
          bytes = null;
        }
      }
      if (bytes) {
        bundled.push(playerId);
      } else {
        url =
          archiveOverrides[playerId] ?? `${referenceImageBase}${playerId}.jpg`;
        file = `public/players/${playerId}.jpg`;
        bytes = await readPortrait(
          resolve(root, file),
          url,
          (b) =>
            b.length > 1000 &&
            b.readUInt16BE(0) === 0xffd8 &&
            b.readUInt16BE(b.length - 2) === 0xffd9,
        );
        archived.push(playerId);
      }
      await writeFile(resolve(root, file), bytes);
      images.push({
        playerId,
        nbaId,
        name: dataset.players.find((p) => p.id === playerId).name,
        file,
        url,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    } catch (error) {
      failures.push({ playerId, nbaId, message: String(error.message) });
    }
  }
  const mapping = {
    players: matched,
    bundled: bundled.sort(),
    archived: archived.sort(),
    archiveOverrides,
    unavailable: unavailable.sort(),
  };
  await writeFile(
    resolve(root, "src/lib/player-photos.json"),
    JSON.stringify(mapping, null, 2) + "\n",
  );
  const manifest = {
    generatedAt: new Date().toISOString(),
    identitySource: {
      repository: "swar/nba_api",
      commit,
      url: identityUrl,
      sha256: sha256(source),
      rows: identities.length,
      documentation: `https://github.com/swar/nba_api/blob/${commit}/docs/nba_api/stats/static/players.md`,
    },
    photos: {
      providers: ["NBA", "Basketball-Reference", "CSKA Moscow"],
      urlTemplate: `${imageBase}{nbaId}.png`,
      referenceUrlTemplate: `${referenceImageBase}{playerId}.jpg`,
      note: "A player's photograph can come from a different season than the one shown.",
    },
    datasetSourceCommit: dataset.metadata.sourceCommit,
    coverage: {
      players: dataset.players.length,
      matched: Object.keys(matched).length,
      ambiguous: unresolved.filter((p) => p.reason === "ambiguous").length,
      unmatched: unresolved.filter((p) => p.reason === "unmatched").length,
      bundled: images.length,
      bundledArchiveJpegs: archived.length,
      knownPlaceholderPhotos: unavailable.length,
      bundledBytes: images.reduce((sum, entry) => sum + entry.bytes, 0),
    },
    images,
    unavailable,
    unresolved,
    failures,
  };
  await writeFile(
    resolve(root, "data/photo-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(JSON.stringify({ ...manifest.coverage, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await sync();
