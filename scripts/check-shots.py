#!/usr/bin/env python3
"""Validate every generated shot, lazy-file hash, coverage value and source archive.

Run from any directory: python3 scripts/check-shots.py
The source archive cache is checked when present. --require-cache makes it mandatory.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/data/shots"
COLUMNS = ["x", "y", "made", "points", "distance", "teamId", "gameId", "date", "quarter", "secondsLeft", "zone", "side", "action"]


def read_verified(path: Path, sha256: str, bytes_expected: int | None = None):
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == sha256, f"Hash mismatch: {path}"
    if bytes_expected is not None:
        assert len(raw) == bytes_expected, f"Size mismatch: {path}"
    return raw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-cache", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "data/shot-manifest.json").read_text())
    index = json.loads(read_verified(ROOT / manifest["index"]["file"], manifest["index"]["sha256"], manifest["index"]["bytes"]))
    assert index["metadata"]["schemaVersion"] == 1
    assert index["columns"] == COLUMNS
    assert index["metadata"]["coordinateSystem"]["hoop"] == [0, 5.25]
    assert index["metadata"]["coordinateSystem"]["correctedSourceSeasons"] == [2020, 2021, 2022]
    season_totals = Counter()
    season_makes = Counter()
    season_threes = Counter()
    players = set()
    coverage_counts = Counter()
    out_of_view = 0
    current = json.loads((ROOT / "public/data/nba.json").read_text())
    season_stats = {(r["playerId"], r["season"]): r for r in current["rows"]}
    for dependency in manifest["inputDependencies"]:
        if dependency["projection"] == "player_id_name_and_season_fga":
            projected = {"players": sorted([[p["id"], p["name"]] for p in current["players"]]),
                         "rows": sorted([[r["playerId"], r["season"], r["fga"]] for r in current["rows"]])}
        else:
            photos = json.loads((ROOT / dependency["file"]).read_text())
            projected = dict(sorted(photos["players"].items()))
        raw = (json.dumps(projected, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode()
        assert hashlib.sha256(raw).hexdigest() == dependency["sha256"], f"Dependency identity/FGA changed: {dependency['file']}"
    for key, entry in index["playerSeasons"].items():
        assert key == f"{entry['nbaId']}:{entry['season']}"
        assert entry["file"] == f"{entry['season']}/{entry['nbaId']}.json"
        file = json.loads(read_verified(OUTPUT / entry["file"], entry["sha256"], entry["bytes"]))
        assert file["columns"] == COLUMNS
        assert len(file["shots"]) == entry["attempts"]
        assert file["nbaId"] == entry["nbaId"] and file["season"] == entry["season"]
        assert file["playerId"] == entry["playerId"]
        assert file["coverage"] == entry["coverage"]
        team_counts, team_made = Counter(), Counter()
        made = 0
        for shot in file["shots"]:
            assert len(shot) == 13, (key, "Wrong tuple length")
            x, y, make, points, distance, team_id, game_id, date, quarter, seconds, zone, side, action = shot
            assert all(isinstance(n, (int, float)) and math.isfinite(n) for n in (x, y, distance))
            assert -25 <= x <= 25 and 0 <= y <= 94, (key, "Out-of-court source coordinate")
            assert abs(math.hypot(x, y - 5.25) - distance) <= 1.05, (key, "Coordinate units/radial distance")
            if zone == "Left Corner 3":
                assert x > 0, (key, "Left/right orientation")
            if zone == "Right Corner 3":
                assert x < 0, (key, "Left/right orientation")
            assert make in (0, 1) and points in (2, 3)
            assert game_id.startswith("002") and len(game_id) == 10
            assert date == file["games"][game_id]["date"]
            assert quarter >= 1 and 0 <= seconds <= (720 if quarter <= 4 else 300)
            assert isinstance(zone, str) and isinstance(side, str) and isinstance(action, str)
            team_counts[team_id] += 1
            team_made[team_id] += make
            made += make
            out_of_view += y > 47
            season_threes[entry["season"]] += points == 3
        assert made == entry["made"]
        if key == "1629029:2026":
            # Basketball-Reference Player Totals, 2025–26: one season with independently verified event-level totals.
            triples = [shot for shot in file["shots"] if shot[3] == 3]
            assert entry["playerId"] == "doncilu01"
            assert len(file["games"]) == 64
            assert (len(file["shots"]), made, len(triples), sum(shot[2] for shot in triples)) == (1457, 693, 694, 254)
        assert dict(team_counts) == {t["id"]: t["attempts"] for t in entry["teams"]}
        assert dict(team_made) == {t["id"]: t["made"] for t in entry["teams"]}
        assert file["teams"] == entry["teams"]
        cov = entry["coverage"]
        assert cov["recordedAttempts"] == entry["attempts"]
        expected_row = season_stats.get((entry["playerId"], entry["season"]))
        expected = expected_row["fga"] if expected_row else None
        assert expected == cov["expectedAttempts"], (key, "Season FGA reference changed")
        expected_status = "unverified" if expected is None else "complete" if entry["attempts"] == expected else "partial" if entry["attempts"] < expected else "excess"
        assert cov["status"] == expected_status
        # Unknown expected and a known zero denominator are different nulls.
        # Older files may omit ratioUnavailableReason; a present value must match.
        if expected is None:
            assert cov["ratio"] is None
            assert cov.get("ratioUnavailableReason", "unknown_expected") == "unknown_expected"
        elif expected == 0:
            assert cov["ratio"] is None
            assert cov.get("ratioUnavailableReason", "zero_denominator") == "zero_denominator"
        else:
            assert cov["ratio"] == round(entry["attempts"] / expected, 6)
            assert "ratioUnavailableReason" not in cov
        coverage_counts[expected_status] += 1
        players.add(entry["nbaId"])
        season_totals[entry["season"]] += entry["attempts"]
        season_makes[entry["season"]] += made
    assert "1629029:2026" in index["playerSeasons"], "Missing Luka Dončić 2025–26 court"
    assert len(players) == index["metadata"]["playerCount"]
    assert len(index["playerSeasons"]) == index["metadata"]["playerSeasonCount"]
    assert sum(season_totals.values()) == index["metadata"]["totalShots"]
    assert dict(coverage_counts) == index["metadata"]["coverageStatuses"]
    assert out_of_view == index["metadata"]["outsideHalfCourt"]
    assert len(list(OUTPUT.glob("[0-9][0-9][0-9][0-9]/*.json"))) == len(index["playerSeasons"]), "Unexpected stale player-season files"
    for source in manifest["sources"]:
        assert season_totals[source["season"]] == source["rows"]
        assert source["quality"]["distanceVerified"] == source["rows"]
        assert source["quality"]["outsideFullCourt"] == 0
        cache = ROOT / "data/cache/shots" / source["file"]
        if cache.exists() or args.require_cache:
            read_verified(cache, source["sha256"], source["bytes"])
    for baseline in index["league"]:
        year = baseline["season"]
        assert baseline["scope"] == "recorded_shots_only"
        assert baseline["attempts"] == season_totals[year]
        assert baseline["made"] == season_makes[year]
        assert baseline["threeAttempts"] == season_threes[year]
        assert math.isclose(baseline["fg"], baseline["made"] / baseline["attempts"])
        assert math.isclose(baseline["threeShare"], baseline["threeAttempts"] / baseline["attempts"])
    print(f"Verified {sum(season_totals.values()):,} real shots in {len(index['playerSeasons']):,} lazy files, {len(players):,} players, {len(season_totals)} seasons.")
    print(f"Every coordinate, outcome, regular-season game ID, file hash, team count and coverage value passed. {out_of_view:,} backcourt shots remain in the data.")
    print(f"Coverage categories: {dict(coverage_counts)}")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, FileNotFoundError, ValueError) as exc:
        print(f"Shot validation failed: {exc}", file=sys.stderr)
        sys.exit(1)
