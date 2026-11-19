"""Boundary tests for source coordinate correction, identity joins and coverage.

Deterministic cases never read downloaded files. The 2016 cached-data
reconciliation is opt-in: set NBA_SHOT_RECONCILE_2016=1. Without that
setting the case is skipped. With the setting, a missing artifact fails.
"""
import csv
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
import sys
import zipfile

RECONCILE_2016 = "NBA_SHOT_RECONCILE_2016"

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("sync_shots", Path(__file__).resolve().parents[1] / "scripts/sync-shots.py")
shots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shots)


class SourceShotTests(unittest.TestCase):
    def test_source_feet_are_not_scaled_again(self):
        # Actual 2016 Mike Scott 3-pointer; source right-side label has negative x.
        self.assertEqual(shots.canonical_coordinates(2016, -23.2, 16.85), (-23.2, 16.85))

    def test_documented_double_transform_is_reversed(self):
        # Actual Curry 2020-03-05 shot: source x=-1,y=8.135, distance=25ft.
        self.assertEqual(shots.canonical_coordinates(2020, -1, 8.135), (10.0, 28.85))
        # Inverse is applied ONLY to the three affected source season files.
        self.assertEqual(shots.canonical_coordinates(2021, 1.43, 8.165), (-14.3, 29.15))
        self.assertEqual(shots.canonical_coordinates(2022, -1.65, 8.275), (16.5, 30.25))
        self.assertEqual(shots.canonical_coordinates(2023, -1, 8.135), (-1.0, 8.13))

    def test_missing_attempts_and_unknown_coverage_are_not_hidden(self):
        partial = shots.coverage(1596, 1598)
        self.assertEqual(partial["status"], "partial")
        self.assertEqual(partial["ratio"], round(1596 / 1598, 6))
        self.assertLess(partial["ratio"], 1)
        self.assertNotIn("ratioUnavailableReason", partial)
        complete = shots.coverage(634, 634)
        self.assertEqual(complete["status"], "complete")
        self.assertEqual(complete["ratio"], 1)
        self.assertNotIn("ratioUnavailableReason", complete)
        excess = shots.coverage(10, 9)
        self.assertEqual(excess["status"], "excess")
        self.assertGreater(excess["ratio"], 1)
        self.assertEqual(excess["ratio"], round(10 / 9, 6))
        self.assertNotIn("ratioUnavailableReason", excess)
        # (recorded, expected) -> status, and why the ratio stays null.
        null_cases = {
            (0, 0): ("complete", "zero_denominator"),
            (4, 0): ("excess", "zero_denominator"),
            (0, None): ("unverified", "unknown_expected"),
            (4, None): ("unverified", "unknown_expected"),
        }
        for (recorded, expected), (status, reason) in null_cases.items():
            cov = shots.coverage(recorded, expected)
            self.assertIsNone(cov["ratio"], (recorded, expected))
            self.assertEqual(cov["status"], status, (recorded, expected))
            self.assertEqual(cov["expectedAttempts"], expected)
            self.assertEqual(cov["ratioUnavailableReason"], reason)
        zero_on_positive = shots.coverage(0, 5)
        self.assertEqual(zero_on_positive["status"], "partial")
        self.assertEqual(zero_on_positive["ratio"], 0)
        self.assertEqual(zero_on_positive["expectedAttempts"], 5)
        self.assertNotIn("ratioUnavailableReason", zero_on_positive)

    def test_exact_name_needs_season_disambiguation(self):
        data = {"players": [{"id": "first", "name": "John Smith"}, {"id": "second", "name": "John Smith"}],
                "rows": [{"playerId": "first", "season": 2010}, {"playerId": "second", "season": 2025}]}
        resolve, _ = shots.make_identity_map(data, {"players": {}})
        self.assertEqual(resolve(100, "John Smith", 2010), ("first", "unique_exact_name_and_season"))
        self.assertEqual(resolve(200, "John Smith", 2025), ("second", "unique_exact_name_and_season"))
        self.assertEqual(resolve(100, "Jon Smith", 2010), (None, "unmatched"))
        data["rows"].append({"playerId": "second", "season": 2010})
        resolve, _ = shots.make_identity_map(data, {"players": {}})
        self.assertEqual(resolve(100, "John Smith", 2010), (None, "unmatched"))

    def test_suffixes_and_diacritics_keep_identity_without_fuzzy_names(self):
        data = {"players": [{"id": "knox", "name": "Kevin Knox"}, {"id": "asik", "name": "Ömer Aşık"}],
                "rows": [{"playerId": "knox", "season": 2025}, {"playerId": "asik", "season": 2018}]}
        resolve, _ = shots.make_identity_map(data, {"players": {}})
        self.assertEqual(resolve(1, "Kevin Knox II", 2025), ("knox", "unique_unsuffixed_name_and_season"))
        self.assertEqual(resolve(2, "Omer Asik", 2018), ("asik", "unique_exact_name_and_season"))
        self.assertEqual(resolve(1, "Kevin Knox II", 2018), (None, "unmatched"))

    def test_relocations_preserve_historical_team_label(self):
        self.assertEqual(shots.team_abbr(1610612760, "Seattle SuperSonics", 2008), "SEA")
        self.assertEqual(shots.team_abbr(1610612760, "Oklahoma City Thunder", 2009), "OKC")
        self.assertEqual(shots.team_abbr(1610612751, "New Jersey Nets", 2012), "NJN")
        self.assertEqual(shots.team_abbr(1610612751, "Brooklyn Nets", 2013), "BRK")
        self.assertEqual(shots.team_abbr(1610612740, "New Orleans Hornets", 2005), "NOH")
        self.assertEqual(shots.team_abbr(1610612740, "New Orleans/Oklahoma City Hornets", 2006), "NOK")
        self.assertEqual(shots.team_abbr(1610612740, "New Orleans/Oklahoma City Hornets", 2007), "NOK")
        self.assertEqual(shots.team_abbr(1610612740, "New Orleans Hornets", 2008), "NOH")
        self.assertEqual(shots.team_abbr(1610612740, "New Orleans Hornets", 2013), "NOH")
        self.assertEqual(shots.team_abbr(1610612740, "New Orleans Pelicans", 2014), "NOP")

    def test_basketball_reference_abbreviations_at_turn_years(self):
        nets, suns, bobcats = 1610612751, 1610612756, 1610612766
        self.assertEqual(shots.team_abbr(nets, "New Jersey Nets", 2012), "NJN")
        self.assertEqual(shots.team_abbr(nets, "Brooklyn Nets", 2013), "BRK")
        self.assertEqual(shots.team_abbr(nets, "Brooklyn Nets", 2025), "BRK")
        for season in (2004, 2016, 2025):
            self.assertEqual(shots.team_abbr(suns, "Phoenix Suns", season), "PHO")
        self.assertEqual(shots.team_abbr(bobcats, "Charlotte Bobcats", 2005), "CHA")
        self.assertEqual(shots.team_abbr(bobcats, "Charlotte Bobcats", 2014), "CHA")
        self.assertEqual(shots.team_abbr(bobcats, "Charlotte Hornets", 2015), "CHO")
        self.assertEqual(shots.team_abbr(bobcats, "Charlotte Hornets", 2016), "CHO")
        # Franchise ids stay put: Brooklyn is not New Orleans, Charlotte is not either.
        self.assertNotEqual(nets, 1610612740)
        self.assertNotEqual(bobcats, 1610612740)
        self.assertEqual(len(shots.TEAM_ABBR), 30)

    def test_2016_shot_abbreviations_reconcile_with_basketball_reference(self):
        if os.environ.get(RECONCILE_2016) != "1":
            self.skipTest(
                "SKIP 2016 cached-data reconciliation (opt-in). "
                "Set NBA_SHOT_RECONCILE_2016=1 to run it. "
                "Default tests do not read public/data/nba.json or data/cache/shots/NBA_2016_Shots.csv.zip."
            )
        root = Path(__file__).resolve().parents[1]
        required = {
            "public/data/nba.json": root / "public/data/nba.json",
            "data/cache/shots/NBA_2016_Shots.csv.zip": root / "data/cache/shots/NBA_2016_Shots.csv.zip",
        }
        missing = [label for label, path in required.items() if not path.is_file()]
        if missing:
            self.fail(
                "NBA_SHOT_RECONCILE_2016=1 but required local artifacts are missing: "
                + ", ".join(missing)
                + ". These files are gitignored and are not downloaded by the default tests."
            )
        nba_path = required["public/data/nba.json"]
        zip_path = required["data/cache/shots/NBA_2016_Shots.csv.zip"]
        nba = json.loads(nba_path.read_text())
        bref = {t["name"]: t["abbr"] for t in nba["teams"] if t["season"] == 2016}
        self.assertEqual(len(bref), 30)
        self.assertEqual(bref["Brooklyn Nets"], "BRK")
        self.assertEqual(bref["Phoenix Suns"], "PHO")
        self.assertEqual(bref["Charlotte Hornets"], "CHO")
        self.assertEqual(bref["New Orleans Pelicans"], "NOP")
        self.assertEqual(bref["Oklahoma City Thunder"], "OKC")
        with zipfile.ZipFile(zip_path) as archive:
            member = next(n for n in archive.namelist() if n.endswith(".csv") and not n.startswith("__MACOSX/"))
            raw = archive.read(member)
        seen = {}
        for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
            if int(row["SEASON_1"]) != 2016:
                continue
            seen[int(row["TEAM_ID"])] = row["TEAM_NAME"]
        self.assertEqual(set(seen), set(shots.TEAM_ABBR))
        produced = {team_id: shots.team_abbr(team_id, name, 2016) for team_id, name in seen.items()}
        self.assertEqual(produced[1610612751], "BRK")
        self.assertEqual(produced[1610612756], "PHO")
        self.assertEqual(produced[1610612766], "CHO")
        self.assertEqual(produced[1610612740], "NOP")
        self.assertEqual(produced[1610612760], "OKC")
        self.assertNotIn("BKN", produced.values())
        self.assertNotIn("PHX", produced.values())
        self.assertNotIn("CHA", produced.values())

        def compact(value: str) -> str:
            token = "".join(ch for ch in value.casefold() if ch.isalnum())
            return {"laclippers": "losangelesclippers"}.get(token, token)

        bref_by_name = {compact(name): abbr for name, abbr in bref.items()}
        for team_id, name in seen.items():
            self.assertEqual(produced[team_id], bref_by_name[compact(name)], (team_id, name))
        self.assertEqual(set(produced.values()), set(bref.values()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
