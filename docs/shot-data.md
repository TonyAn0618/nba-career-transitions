# Real shot-location data

The shot charts use **4,450,789 recorded NBA regular-season field-goal attempts**, covering **2003–04 through 2024–25**, **2,265 NBA player IDs** and **10,872 player-seasons**. These are observed shot coordinates and outcomes, not random points, estimates from distance bands, or generated examples. This is a fixed historical snapshot; it contains no 2025–26 or 2026–27 results.

The season-level analysis dataset remains separate: it covers 1996–97 through 2025–26 and more historical players. A player can therefore have season statistics without a shot-location file. Missing coordinate data must remain visibly unavailable.

## Source and provenance

- Original statistics provider: **NBA.com**.
- Public compilation: [Dominic Samangy's NBA Shot Location Data](https://github.com/DomSamangy/NBA_Shots_04_25/tree/69e63559bc17393312ad258c11f93d78be002079).
- Pinned source commit: `69e63559bc17393312ad258c11f93d78be002079`.
- Files: 22 annual archives named `NBA_2004_Shots.csv.zip` through `NBA_2025_Shots.csv.zip`.
- The compiler's [data dictionary](https://github.com/DomSamangy/NBA_Shots_04_25/blob/69e63559bc17393312ad258c11f93d78be002079/README.md) describes shot outcomes, locations, teams and game context. The [plotting tutorial](https://github.com/DomSamangy/NBA_Shots_04_25/blob/69e63559bc17393312ad258c11f93d78be002079/NBA_Shots_Tutorial.Rmd) specifies the court frame.
- `data/shot-manifest.json` records archive and uncompressed CSV SHA-256 hashes, row counts, coordinate transforms, quality checks and the generated index hash.
- Player identity starts with the NBA IDs used by the existing photo manifest. Where that mapping is absent, only a unique normalized exact name with the same season is accepted; a separate explicit rule handles common suffix differences such as `Kevin Knox II` / `Kevin Knox`. No fuzzy name match is accepted. Ambiguous and alternate-name identities remain unlinked.

The public repository is an independent compilation of NBA.com data; the application should credit both. A public download is not a claim of ownership or a grant of an additional data/image license.

## Rebuild and verify

Requires Python 3.10+, curl, and the existing season dataset. TLS verification remains enabled.

```sh
npm run data
python3 scripts/sync-shots.py
python3 tests/shot-data.test.py
python3 scripts/check-shots.py --require-cache
```

The first import downloads approximately 82 MB of ZIP archives. The generated JSON corpus is approximately 488 MB; the browser loads the index and only the selected player-seasons. Raw ZIPs stay in `data/cache/shots/`; all generated player files stay in `public/data/shots/`. They should be ignored by Git and reproduced from the pinned sources. After the first download:

```sh
python3 scripts/sync-shots.py --offline
```

The importer preserves the initial retrieval timestamp and checks cached source hashes against the manifest. The manifest's dependency fingerprints include only the player identity and season FGA fields actually used by this pipeline, so unrelated UI metadata changes do not invalidate it.

## Frontend schema

`/data/shots/index.json` contains:

- `metadata`: source, coverage years, total counts and coordinate frame.
- `playerSeasons`: entries keyed by `${nbaId}:${season}`, with NBA/Basketball-Reference identity, season, team membership, attempts, makes, coverage, relative file path, SHA-256 hash and file size.
- `players`: unique NBA player IDs and first/last covered seasons.
- `league`: yearly totals and rates for **recorded shots only**. These are not interchangeable with the complete-season league baseline used elsewhere in the application.
- `columns`: the ordered tuple fields below.

`/data/shots/2016/201939.json`, for example, contains Stephen Curry's observed 2015–16 shots. It includes identity, team splits, game context, coverage, coordinate provenance and a `shots` array. Every row has these 13 columns:

| Index | Field         | Type / meaning                               |
| ----- | ------------- | -------------------------------------------- |
| 0     | `x`           | Feet, centered horizontally on the basket    |
| 1     | `y`           | Feet from the baseline                       |
| 2     | `made`        | `1` made; `0` missed                         |
| 3     | `points`      | `2` or `3`, the attempt's shot type          |
| 4     | `distance`    | Source-reported integer feet from the basket |
| 5     | `teamId`      | NBA team ID for this attempt                 |
| 6     | `gameId`      | Source NBA game ID, padded to 10 characters  |
| 7     | `date`        | `YYYY-MM-DD`                                 |
| 8     | `quarter`     | Period number; values above 4 are overtime   |
| 9     | `secondsLeft` | Seconds remaining in the period              |
| 10    | `zone`        | Source basic zone, e.g. `Left Corner 3`      |
| 11    | `side`        | Source court-side abbreviation               |
| 12    | `action`      | Source action description                    |

A player's `teams` array contains every team represented in that season's shot records, including traded players. `teams[].abbr` is the Basketball-Reference abbreviation for that same stable NBA `teamId` and season, matching the season dataset's `teams` directory. Relocated franchises are not merged. Boundaries, using the season-ending year: New Jersey `NJN` through 2012 and Brooklyn `BRK` from 2013; Charlotte `CHA` for 2005–2014 and `CHO` from 2015; Phoenix `PHO`; New Orleans `NOH`, except `NOK` in 2006 and 2007, then `NOP` from 2014; Seattle `SEA` through 2008 and Oklahoma City `OKC` from 2009. The `games` object supplies the source file's home/away abbreviations and date. Shot rows are sorted by date, game, quarter and descending clock. Source rows with otherwise identical fields remain present because the source does not include event IDs.

## Coordinate audit

The canonical frame is measured in **feet**, with the basket at **(0, 5.25)**. The baseline is `y = 0`, sidelines are `x = ±25`, half court is `y = 47`, and the far baseline is `y = 94`. Negative x is viewer-left in the source tutorial; source player-side labels reverse this perspective, so a `Left Corner 3` has positive x. Label court zones consistently with the source; do not infer player-side labels from viewer-left/right.

The README's generic `(0, 50)` coordinate description does not match the actual CSV values. The tutorial and every recorded radial distance confirm the frame above. **Do not divide the canonical output coordinates by 10 or add another basket offset.**

The 2019–20, 2020–21 and 2021–22 source files have a second coordinate transform already applied. Using those raw values directly would falsely cluster nearly all shots near the basket. The importer explicitly reverses that transformation:

| Source season end years | Output x      | Output y              |
| ----------------------- | ------------- | --------------------- |
| 2004–2019, 2023–2025    | `LOC_X`       | `LOC_Y`               |
| 2020–2022               | `-10 × LOC_X` | `10 × (LOC_Y − 5.25)` |

This correction is an inference verified against the data: **all 595,821 affected shots**, and all shots in the other 19 seasons, satisfy `abs(hypot(x, y − 5.25) − SHOT_DISTANCE) ≤ 1.05 ft`. The tolerance accounts for the source's integer distance. Every corner three also has the expected sign. For example, Curry's recorded 2020-03-05 three-point attempt with raw `(-1, 8.135)` and reported distance 25 ft becomes `(10, 28.85)`; its geometric distance is approximately 25.63 ft. Only floating-point representation noise is rounded to two decimals. No shot is moved to a convenient zone, jittered, or synthesized.

All **9,393** shots beyond the half-court view remain in the data. A half-court plot must show an out-of-view count; a full-court option can display them. All recorded coordinates lie within the full 50 × 94 ft court after the documented corrections.

## Coverage and limitations

Coverage compares each NBA player-season's recorded shot count to independently compiled Basketball-Reference season FGA. It does **not** silently fill missing attempts, discard excess attempts, or force rates to agree across sources.

| Status       | Player-seasons | Meaning                                        |
| ------------ | -------------: | ---------------------------------------------- |
| `complete`   |         10,439 | Recorded count equals the matched season FGA   |
| `partial`    |            385 | Fewer recorded shots than season FGA           |
| `excess`     |              5 | Recorded count exceeds season FGA              |
| `unverified` |             43 | No safe season-stat identity join is available |

`complete` means count agreement, not proof that every coordinate is perfectly located. `coverage.ratio` is `recordedAttempts / expectedAttempts`, rounded to 6 decimal places, and may exceed 1. The ratio stays null in two distinct cases, and it is never stored as 0, 1, or infinity for either of them:

| `expectedAttempts`                | `ratio`               | `ratioUnavailableReason` | `status`                                                                                             |
| --------------------------------- | --------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `null` (no safe season-stat join) | `null`                | `unknown_expected`       | `unverified`                                                                                         |
| `0` (known zero denominator)      | `null`                | `zero_denominator`       | existing count comparison: `complete` when recorded is also 0, otherwise `excess`                    |
| positive                          | `recorded / expected` | omitted                  | `partial` when recorded is lower (including recorded 0), `complete` when equal, `excess` when higher |

`ratioUnavailableReason` is optional and is written only for those two nulls. Files generated before the field existed remain valid: a missing reason does not turn a null ratio into a percentage. Re-import shot products to record the reason. For example:

| Player-season          | Recorded shots | Season FGA | Coverage |
| ---------------------- | -------------: | ---------: | -------: |
| Stephen Curry, 2015–16 |          1,596 |      1,598 |   99.87% |
| C.J. Miles, 2014–15    |            827 |        827 |     100% |
| Nikola Jokić, 2024–25  |          1,364 |      1,364 |     100% |

Curry's recorded 2015–16 points contain 401 made threes in 884 attempts; his full-season totals are slightly different. Shot-map statistics must be labeled as calculations from the recorded attempts, not displayed as replacements for complete-season statistics.

Additional audited limitations:

- There are **202 identical output tuples** after player identity is included. The source lacks event IDs, and legitimate repeated tip attempts can share the same clock and location. These records are counted and preserved rather than guessed away.
- In 2020–21, source game ID `0022000000` is reused for five games across ten distinct teams. Counting `(game ID, date, home team, away team)` gives the correct 1,080 distinct game contexts; counting only game IDs gives 1,076. Original IDs are retained. No player in the current source participates in two of these colliding contexts, so each player file's game lookup remains unambiguous. Cross-player game matching should include date and matchup rather than game ID alone.
- There are five player-season cases with one more recorded attempt than the independent season total. These stay flagged as `excess`.
- Location data describes attempts and makes. It does not contain defender position, lineup context, shot quality or tracking-derived expected points. Avoid claims about defensive pressure or causal player impact.
- Sparse cells and zones can produce unstable percentages. Show attempts beside accuracy and provide a minimum-attempt control for comparisons.

The validation script checks every generated tuple, its geometry, corner orientation, regular-season game ID, game date, clock, team counts, coverage and SHA-256 file hash. When `ratioUnavailableReason` is present it must match the unknown-expected or zero-denominator case; older files that omit it still pass. Boundary tests cover the coordinate correction, zero versus missing coverage, conservative identity joins, and franchise turn years. Those cases do not read downloaded files. The 2016 abbreviation reconciliation against Basketball-Reference runs only when `NBA_SHOT_RECONCILE_2016=1`; without that setting it is skipped, and with the setting a missing `public/data/nba.json` or `data/cache/shots/NBA_2016_Shots.csv.zip` fails the test.
