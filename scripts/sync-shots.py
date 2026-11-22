#!/usr/bin/env python3
"""Import pinned NBA.com shot records into lazy player-season JSON files.

Requires Python 3.10+ and curl. No third-party packages or insecure TLS options.
The full source is cached so subsequent runs are offline and reproducible.
"""
from __future__ import annotations

import argparse
import collections
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import re
from pathlib import Path
import subprocess
import sys
import tarfile
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "69e63559bc17393312ad258c11f93d78be002079"
SOURCE_REPOSITORY = "https://github.com/DomSamangy/NBA_Shots_04_25"
SOURCE_BASE = f"https://raw.githubusercontent.com/DomSamangy/NBA_Shots_04_25/{SOURCE_COMMIT}"
CACHE = ROOT / "data/cache/shots"
OUTPUT = ROOT / "public/data/shots"
MANIFEST = ROOT / "data/shot-manifest.json"
DETAIL_COMMIT = "46488f0f8e1cab58fc1256511ea808166a443a15"
DETAIL_REPOSITORY = "https://github.com/shufinskiy/nba_data"
DETAIL_ARCHIVE = "shotdetail_2025.tar.xz"
DETAIL_URL = f"https://raw.githubusercontent.com/shufinskiy/nba_data/{DETAIL_COMMIT}/datasets/{DETAIL_ARCHIVE}"
YEARS = list(range(2004, 2027))
COLUMNS = ["x", "y", "made", "points", "distance", "teamId", "gameId", "date", "quarter", "secondsLeft", "zone", "side", "action"]
CORRECTED_SEASONS = {2020, 2021, 2022}
# Stable NBA franchise ids. Values are Basketball-Reference abbreviations (nba.json teams),
# not the NBA.com labels BKN / PHX / CHA. Season overrides keep historical names.
TEAM_ABBR = {
    1610612737: "ATL", 1610612738: "BOS", 1610612739: "CLE", 1610612740: "NOP",
    1610612741: "CHI", 1610612742: "DAL", 1610612743: "DEN", 1610612744: "GSW",
    1610612745: "HOU", 1610612746: "LAC", 1610612747: "LAL", 1610612748: "MIA",
    1610612749: "MIL", 1610612750: "MIN", 1610612751: "BRK", 1610612752: "NYK",
    1610612753: "ORL", 1610612754: "IND", 1610612755: "PHI", 1610612756: "PHO",
    1610612757: "POR", 1610612758: "SAC", 1610612759: "SAS", 1610612760: "OKC",
    1610612761: "TOR", 1610612762: "UTA", 1610612763: "MEM", 1610612764: "WAS",
    1610612765: "DET", 1610612766: "CHO",
}


def team_abbr(team_id: int, name: str, season: int) -> str:
    if team_id == 1610612751 and season <= 2012:
        return "NJN"
    if team_id == 1610612760 and season <= 2008:
        return "SEA"
    if team_id == 1610612740 and season <= 2013:
        return "NOK" if season in (2006, 2007) else "NOH"
    if team_id == 1610612766 and season <= 2014:
        return "CHA"
    return TEAM_ABBR.get(team_id, name)


def normalized_name(value: str) -> str:
    value = value.translate(str.maketrans({"ı": "i", "ł": "l", "Ł": "L", "ß": "ss"}))
    return "".join(c for c in unicodedata.normalize("NFKD", value).lower() if c.isascii() and c.isalnum())


def unsuffixed_name(value: str) -> str:
    return normalized_name(re.sub(r" (?:Jr\.?|Sr\.?|II|III|IV)$", "", value, flags=re.IGNORECASE))


def dependency_projection(dataset: dict, photos: dict) -> list[dict]:
    """Hash only the fields used here, excluding unrelated UI metadata changes."""
    identity_stats = {"players": sorted([[p["id"], p["name"]] for p in dataset["players"]]),
                      "rows": sorted([[r["playerId"], r["season"], r["fga"]] for r in dataset["rows"]])}
    return [{"file": "public/data/nba.json", "projection": "player_id_name_and_season_fga", "sha256": hash_bytes(json_bytes(identity_stats))},
            {"file": "src/lib/player-photos.json", "projection": "player_nba_id_map", "sha256": hash_bytes(json_bytes(dict(sorted(photos["players"].items()))))}]


def canonical_coordinates(season: int, raw_x: float, raw_y: float) -> tuple[float, float]:
    """Return source-observed coordinates in feet; never infer a shot location.

    2020-22 source files applied a second x flip/scale and y scale/offset.
    Inverting that transform restores ALL rows' reported distance and side.
    """
    if season == 2026:
        return round(-raw_x / 10, 2), round(5.25 + raw_y / 10, 2)
    if season in CORRECTED_SEASONS:
        return round(-10 * raw_x, 2), round(10 * (raw_y - 5.25), 2)
    return round(raw_x, 2), round(raw_y, 2)


def coverage(recorded: int, expected: int | None) -> dict:
    """ratio = recorded / expected. Null stays null for an unknown or zero denominator.

    Status is unchanged: unverified only when expected is missing; otherwise
    complete / partial / excess compare the two counts, including 0 == 0.
    ratioUnavailableReason is omitted whenever the ratio is a real number.
    """
    status = "unverified" if expected is None else "complete" if recorded == expected else "partial" if recorded < expected else "excess"
    if expected is None:
        ratio, reason = None, "unknown_expected"
    elif expected == 0:
        ratio, reason = None, "zero_denominator"
    else:
        ratio, reason = round(recorded / expected, 6), None
    payload = {"recordedAttempts": recorded, "expectedAttempts": expected, "ratio": ratio, "status": status}
    if reason is not None:
        payload["ratioUnavailableReason"] = reason
    return payload


def hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode()


def write_json(path: Path, value: object) -> tuple[str, int]:
    payload = json_bytes(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return hash_bytes(payload), len(payload)


def download(year: int, previous: dict, offline: bool) -> Path:
    path = CACHE / (DETAIL_ARCHIVE if year == 2026 else f"NBA_{year}_Shots.csv.zip")
    expected = previous.get(path.name, {}).get("sha256")
    if path.exists():
        if expected and hash_bytes(path.read_bytes()) != expected:
            raise ValueError(f"Cached archive hash changed: {path}. Remove only that cache file to fetch the pinned source again.")
        return path
    if offline:
        raise FileNotFoundError(f"Missing offline cache: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".part")
    url = DETAIL_URL if year == 2026 else f"{SOURCE_BASE}/{path.name}"
    subprocess.run(["curl", "--fail", "--location", "--silent", "--show-error", "--retry", "3",
                    "--connect-timeout", "20", "--max-time", "180", url, "--output", str(temp)], check=True)
    if expected and hash_bytes(temp.read_bytes()) != expected:
        raise ValueError(f"Pinned source hash mismatch: {path.name}")
    temp.replace(path)
    return path


def make_identity_map(dataset: dict, photos: dict):
    by_id = {p["id"]: p for p in dataset["players"]}
    reverse = collections.defaultdict(list)
    for bref_id, nba_id in photos["players"].items():
        if bref_id in by_id:
            reverse[int(nba_id)].append(bref_id)
    exact = collections.defaultdict(list)
    unsuffixed = collections.defaultdict(list)
    for p in dataset["players"]:
        exact[normalized_name(p["name"])].append(p["id"])
        unsuffixed[unsuffixed_name(p["name"])].append(p["id"])
    seasons = {(r["playerId"], r["season"]): r for r in dataset["rows"]}

    def resolve(nba_id: int, name: str, year: int):
        candidates = [pid for pid in reverse.get(nba_id, []) if (pid, year) in seasons]
        if len(candidates) == 1:
            return candidates[0], "verified_nba_id"
        candidates = [pid for pid in exact.get(normalized_name(name), []) if (pid, year) in seasons]
        if len(candidates) == 1:
            return candidates[0], "unique_exact_name_and_season"
        candidates = [pid for pid in unsuffixed.get(unsuffixed_name(name), []) if (pid, year) in seasons]
        if len(candidates) == 1:
            return candidates[0], "unique_unsuffixed_name_and_season"
        return None, "unmatched"

    return resolve, seasons


def source_transform(year: int) -> dict:
    if year == 2026:
        return {"x": "-LOC_X / 10", "y": "5.25 + LOC_Y / 10"}
    return {"x": "-10 * LOC_X", "y": "10 * (LOC_Y - 5.25)"} if year in CORRECTED_SEASONS else {"x": "LOC_X", "y": "LOC_Y"}


def shotchart_rows(reader):
    """Adapt NBA ShotChartDetail rows to the historical compilation's column names."""
    for row in reader:
        if row["SHOT_ATTEMPTED_FLAG"] != "1" or row["SHOT_MADE_FLAG"] not in {"0", "1"}:
            raise ValueError("Unexpected ShotChartDetail attempt/outcome flag")
        if not row["GAME_ID"].zfill(10).startswith("00225"):
            raise ValueError(f"Unexpected 2025–26 regular-season game ID: {row['GAME_ID']}")
        side = re.search(r"\(([A-Z]+)\)$", row["SHOT_ZONE_AREA"])
        if not side:
            raise ValueError(f"Unrecognized ShotChartDetail zone area: {row['SHOT_ZONE_AREA']}")
        yield {**row, "SEASON_1": 2026, "SHOT_MADE": "true" if row["SHOT_MADE_FLAG"] == "1" else "false",
               "QUARTER": row["PERIOD"], "MINS_LEFT": row["MINUTES_REMAINING"], "SECS_LEFT": row["SECONDS_REMAINING"],
               "BASIC_ZONE": row["SHOT_ZONE_BASIC"], "ZONE_ABB": side[1],
               "HOME_TEAM": row["HTM"], "AWAY_TEAM": row["VTM"]}


def import_year(year: int, archive_path: Path, resolve, season_rows: dict):
    if year == 2026:
        member = "shotdetail_2025.csv"
        with tarfile.open(archive_path, "r:xz") as archive:
            raw = archive.extractfile(member).read()
    else:
        with zipfile.ZipFile(archive_path) as archive:
            member = next(n for n in archive.namelist() if n.endswith(".csv") and not n.startswith("__MACOSX/"))
            raw = archive.read(member)
    csv_reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    required = {"PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "TEAM_NAME", "LOC_X", "LOC_Y", "SHOT_DISTANCE",
                "SHOT_TYPE", "GAME_DATE", "GAME_ID", "ACTION_TYPE"}
    if year == 2026:
        required |= {"SHOT_ATTEMPTED_FLAG", "SHOT_MADE_FLAG", "PERIOD", "MINUTES_REMAINING", "SECONDS_REMAINING",
                     "SHOT_ZONE_BASIC", "SHOT_ZONE_AREA", "HTM", "VTM"}
    else:
        required |= {"SEASON_1", "SHOT_MADE", "QUARTER", "MINS_LEFT", "SECS_LEFT", "BASIC_ZONE", "ZONE_ABB",
                     "HOME_TEAM", "AWAY_TEAM"}
    missing = required - set(csv_reader.fieldnames or [])
    if missing:
        raise ValueError(f"Required source columns missing in {year}: {missing}")
    reader = shotchart_rows(csv_reader) if year == 2026 else csv_reader
    date_format = "%Y%m%d" if year == 2026 else "%m-%d-%Y"
    groups = {}
    games = {}
    game_id_contexts = collections.defaultdict(set)
    totals = {"attempts": 0, "made": 0, "threeAttempts": 0, "threeMade": 0}
    zones = collections.defaultdict(lambda: {"attempts": 0, "made": 0})
    checks = {"distanceVerified": 0, "cornerSideVerified": 0, "outsideHalfCourt": 0,
              "outsideFullCourt": 0, "exactDuplicateRows": 0, "invalidRows": 0}
    seen = set()
    coordinate_range = {"minX": math.inf, "maxX": -math.inf, "minY": math.inf, "maxY": -math.inf}
    for source_row_number, r in enumerate(reader, 2):
        nba_id, team_id = int(r["PLAYER_ID"]), int(r["TEAM_ID"])
        if int(r["SEASON_1"]) != year:
            raise ValueError(f"Season mismatch at {year}:{source_row_number}")
        game_id = r["GAME_ID"].zfill(10)
        if not game_id.startswith("002"):
            raise ValueError(f"Non-regular-season game {game_id} in {year}")
        x, y = canonical_coordinates(year, float(r["LOC_X"]), float(r["LOC_Y"]))
        distance = int(r["SHOT_DISTANCE"])
        if not (math.isfinite(x) and math.isfinite(y)):
            raise ValueError(f"Nonfinite coordinates at {year}:{source_row_number}")
        if abs(math.hypot(x, y - 5.25) - distance) > 1.05:
            raise ValueError(f"Coordinate/distance mismatch at {year}:{source_row_number}: {(x, y, distance)}")
        checks["distanceVerified"] += 1
        if r["BASIC_ZONE"] in ("Left Corner 3", "Right Corner 3"):
            if (r["BASIC_ZONE"] == "Left Corner 3") != (x > 0):
                raise ValueError(f"Coordinate/side mismatch at {year}:{source_row_number}")
            checks["cornerSideVerified"] += 1
        checks["outsideHalfCourt"] += not (-25 <= x <= 25 and 0 <= y <= 47)
        checks["outsideFullCourt"] += not (-25 <= x <= 25 and 0 <= y <= 94)
        coordinate_range["minX"] = min(coordinate_range["minX"], x)
        coordinate_range["maxX"] = max(coordinate_range["maxX"], x)
        coordinate_range["minY"] = min(coordinate_range["minY"], y)
        coordinate_range["maxY"] = max(coordinate_range["maxY"], y)
        made_raw = r["SHOT_MADE"].lower()
        if made_raw not in ("true", "false"):
            raise ValueError(f"Invalid SHOT_MADE at {year}:{source_row_number}")
        made = int(made_raw == "true")
        if r["SHOT_TYPE"] not in ("2PT Field Goal", "3PT Field Goal"):
            raise ValueError(f"Invalid SHOT_TYPE at {year}:{source_row_number}")
        points = int(r["SHOT_TYPE"][0])
        date = datetime.strptime(r["GAME_DATE"], date_format).strftime("%Y-%m-%d")
        quarter = int(r["QUARTER"])
        seconds = int(r["MINS_LEFT"]) * 60 + int(r["SECS_LEFT"])
        if quarter < 1 or not 0 <= seconds <= (720 if quarter <= 4 else 300):
            raise ValueError(f"Invalid game clock at {year}:{source_row_number}")
        shot = [x, y, made, points, distance, team_id, game_id, date, quarter, seconds, r["BASIC_ZONE"], r["ZONE_ABB"], r["ACTION_TYPE"]]
        fingerprint = (nba_id, *shot)
        checks["exactDuplicateRows"] += fingerprint in seen
        seen.add(fingerprint)
        if nba_id not in groups:
            bref_id, identity_method = resolve(nba_id, r["PLAYER_NAME"], year)
            groups[nba_id] = {"schemaVersion": 1, "season": year, "nbaId": nba_id,
                              "playerId": bref_id, "name": r["PLAYER_NAME"], "position": r.get("POSITION", ""),
                              "identityMethod": identity_method, "columns": COLUMNS, "shots": [], "teams": {}, "games": {}}
        p = groups[nba_id]
        p["shots"].append(shot)
        team = p["teams"].setdefault(team_id, {"id": team_id, "name": r["TEAM_NAME"],
                                              "abbr": team_abbr(team_id, r["TEAM_NAME"], year), "attempts": 0, "made": 0})
        team["attempts"] += 1
        team["made"] += made
        game = {"date": date, "home": r["HOME_TEAM"], "away": r["AWAY_TEAM"]}
        if game_id in p["games"] and p["games"][game_id] != game:
            raise ValueError(f"Ambiguous source game ID for one player: {year}/{nba_id}/{game_id}")
        p["games"][game_id] = game
        game_key = (game_id, date, r["HOME_TEAM"], r["AWAY_TEAM"])
        games[game_key] = game
        game_id_contexts[game_id].add((date, r["HOME_TEAM"], r["AWAY_TEAM"]))
        totals["attempts"] += 1
        totals["made"] += made
        totals["threeAttempts"] += points == 3
        totals["threeMade"] += made if points == 3 else 0
        zones[r["BASIC_ZONE"]]["attempts"] += 1
        zones[r["BASIC_ZONE"]]["made"] += made
    player_seasons = {}
    identity_counts = collections.Counter()
    status_counts = collections.Counter()
    missing_fga = 0
    for nba_id in sorted(groups):
        p = groups[nba_id]
        p["shots"].sort(key=lambda s: (s[7], s[6], s[8], -s[9]))
        p["teams"] = sorted(p["teams"].values(), key=lambda t: (-t["attempts"], t["id"]))
        season_row = season_rows.get((p["playerId"], year))
        expected = int(season_row["fga"]) if season_row and season_row["fga"] is not None else None
        p["coverage"] = coverage(len(p["shots"]), expected)
        if expected is not None:
            missing_fga += max(0, expected - len(p["shots"]))
        p["coordinateSystem"] = {"units": "feet", "hoop": [0, 5.25], "baselineY": 0,
                                 "sourceTransform": source_transform(year)}
        file = f"{year}/{nba_id}.json"
        digest, byte_count = write_json(OUTPUT / file, p)
        entry = {"nbaId": nba_id, "playerId": p["playerId"], "name": p["name"], "season": year,
                 "position": p["position"], "identityMethod": p["identityMethod"],
                 "attempts": len(p["shots"]), "made": sum(s[2] for s in p["shots"]),
                 "teams": p["teams"], "file": file, "sha256": digest, "bytes": byte_count, "coverage": p["coverage"]}
        player_seasons[f"{nba_id}:{year}"] = entry
        identity_counts[p["identityMethod"]] += 1
        status_counts[p["coverage"]["status"]] += 1
    totals.update({"season": year, "threeShare": totals["threeAttempts"] / totals["attempts"],
                   "fg": totals["made"] / totals["attempts"],
                   "threeFg": totals["threeMade"] / totals["threeAttempts"],
                   "scope": "recorded_shots_only", "zones": dict(zones)})
    source = {"season": year, "file": archive_path.name, "url": DETAIL_URL if year == 2026 else f"{SOURCE_BASE}/{archive_path.name}",
              "bytes": archive_path.stat().st_size, "sha256": hash_bytes(archive_path.read_bytes()),
              "csvFile": member, "csvBytes": len(raw), "csvSha256": hash_bytes(raw),
              "rows": totals["attempts"], "players": len(groups), "games": len(games), "distinctGameIds": len(game_id_contexts),
              "coordinateTransform": source_transform(year), "coordinateRangeFeet": coordinate_range,
              "quality": {**checks, "reusedGameIds": [{"gameId": k, "contexts": [{"date": c[0], "home": c[1], "away": c[2]} for c in sorted(v)]} for k, v in game_id_contexts.items() if len(v) > 1], "coverageStatuses": dict(status_counts),
                          "missingAgainstMatchedSeasonFga": missing_fga, "identityMethods": dict(identity_counts)}}
    print(f"{year}: {source['rows']:,} shots, {source['players']} players, {source['games']} games; all coordinates verified", flush=True)
    return player_seasons, source, totals


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Require the pinned archives in data/cache/shots; never access the network")
    args = parser.parse_args()
    if not (ROOT / "public/data/nba.json").exists():
        raise FileNotFoundError("Run npm run data first to create public/data/nba.json for cross-source identity and FGA checks.")
    dataset = json.loads((ROOT / "public/data/nba.json").read_text())
    photos = json.loads((ROOT / "src/lib/player-photos.json").read_text())
    previous_manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    previous = {s["file"]: s for s in previous_manifest.get("sources", [])}
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        archives = list(executor.map(lambda y: download(y, previous, args.offline), YEARS))
    resolve, season_rows = make_identity_map(dataset, photos)
    entries, sources, league = {}, [], []
    for year, archive in zip(YEARS, archives):
        imported, source, baseline = import_year(year, archive, resolve, season_rows)
        entries.update(imported)
        sources.append(source)
        league.append(baseline)
    players = {}
    unmatched = []
    for key, p in entries.items():
        item = players.setdefault(p["nbaId"], {"nbaId": p["nbaId"], "playerId": p["playerId"], "name": p["name"], "firstSeason": p["season"], "lastSeason": p["season"]})
        item["lastSeason"] = p["season"]
        if item["playerId"] is None and p["playerId"] is not None:
            item["playerId"] = p["playerId"]
        if p["playerId"] is None:
            unmatched.append({"key": key, "name": p["name"]})
    retrieved_at = previous_manifest.get("retrievedAt") if previous_manifest.get("detailSourceCommit") == DETAIL_COMMIT else None
    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()
    metadata = {"schemaVersion": 1, "sourceCommit": SOURCE_COMMIT, "source": "NBA.com shot records compiled by Dominic Samangy (2003–25) and shufinskiy (2025–26)",
                "sourceRepository": SOURCE_REPOSITORY, "detailSourceRepository": DETAIL_REPOSITORY, "detailSourceCommit": DETAIL_COMMIT, "retrievedAt": retrieved_at,
                "seasonType": "NBA regular season", "firstSeason": YEARS[0], "lastSeason": YEARS[-1],
                "totalShots": sum(s["rows"] for s in sources), "playerCount": len(players),
                "playerSeasonCount": len(entries), "seasonCount": len(YEARS),
                "coordinateSystem": {"units": "feet", "hoop": [0, 5.25], "baselineY": 0, "halfCourt": [-25, 25, 0, 47], "fullCourt": [-25, 25, 0, 94],
                                     "xDirection": "Source tutorial orientation: negative x is viewer-left, positive x is viewer-right; shooter-side labels reverse this.",
                                     "correctedSourceSeasons": sorted(CORRECTED_SEASONS)},
                "coverageStatuses": dict(collections.Counter(p["coverage"]["status"] for p in entries.values())),
                "unmatchedPlayerSeasons": len(unmatched),
                "exactDuplicateRows": sum(s["quality"]["exactDuplicateRows"] for s in sources),
                "outsideHalfCourt": sum(s["quality"]["outsideHalfCourt"] for s in sources)}
    index = {"metadata": metadata, "columns": COLUMNS, "playerSeasons": entries, "players": list(players.values()), "league": league}
    index_hash, index_bytes = write_json(OUTPUT / "index.json", index)
    manifest = {**metadata, "sources": sources,
                "inputDependencies": dependency_projection(dataset, photos),
                "index": {"file": "public/data/shots/index.json", "sha256": index_hash, "bytes": index_bytes},
                "unmatched": unmatched,
                "policy": {"noSyntheticLocations": True, "noDeduplication": "Identical output records are preserved and counted.",
                           "missingSeasonTotals": "Coverage compares recorded shots with independently compiled Basketball-Reference season FGA; differences remain visible.",
                           "noCurrentSeasonClaim": "This is a fixed historical snapshot through 2025-26, not a live NBA feed."}}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Total: {metadata['totalShots']:,} shots / {metadata['playerCount']:,} players / {metadata['playerSeasonCount']:,} player-seasons")
    print(f"Index: {index_bytes:,} bytes. Coverage: {metadata['coverageStatuses']}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"Shot import failed: {exc}", file=sys.stderr)
        sys.exit(1)
