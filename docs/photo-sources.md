# Player photographs

Player portraits identify the individual. The photograph and jersey can come from a different season than the one shown on the chart.

## Identity mapping

Basketball-Reference IDs in `public/data/nba.json` are joined to NBA IDs using the public [`nba_api` static player list](https://github.com/swar/nba_api/blob/ec190700dab27498b3f75ecac8f932e3a3ee1606/src/nba_api/stats/library/data.py), pinned to commit `ec190700dab27498b3f75ecac8f932e3a3ee1606`. The package documents its [player identity lookup](https://github.com/swar/nba_api/blob/ec190700dab27498b3f75ecac8f932e3a3ee1606/docs/nba_api/stats/static/players.md).

Matching uses the complete name, with only case, accents, whitespace, and punctuation normalized. Suffixes such as Jr. and III remain significant. A normalized name must be unique in both datasets. There is no fuzzy matching, surname-only matching, or inferred identity for ambiguous players. When an NBA identity is missing or ambiguous, Basketball-Reference can still supply a portrait keyed by the dataset’s player ID.

Examples cross-checked against NBA player pages:

| Basketball-Reference ID | Player                | NBA identity                                                      |
| ----------------------- | --------------------- | ----------------------------------------------------------------- |
| `curryst01`             | Stephen Curry         | [201939](https://www.nba.com/player/201939/stephen-curry)         |
| `thornma01`             | Marcus Thornton       | [201977](https://www.nba.com/stats/player/201977/career)          |
| `milescj01`             | C.J. Miles / CJ Miles | [101139](https://www.nba.com/stats/player/101139/career)          |
| `antetgi01`             | Giannis Antetokounmpo | [203507](https://www.nba.com/player/203507/giannis-antetokounmpo) |
| `jokicni01`             | Nikola Jokić          | [203999](https://www.nba.com/player/203999/nikola-jokic)          |

## Image source and fallback

Images come directly from the NBA CDN:

```text
https://cdn.nba.com/headshots/nba/latest/260x190/{nbaId}.png
```

The shirt and portrait in a ranking come from the same player ID as the underlying statistics. The site first loads a bundled image from `public/players/`. PNGs use the NBA source above. Most archived JPEGs use Basketball-Reference’s player ID. Examples include [Jason Kidd](https://www.basketball-reference.com/req/202106291/images/headshots/kiddja01.jpg) and [Al Harrington](https://www.basketball-reference.com/req/202106291/images/headshots/harrial01.jpg). Chris Gatling’s photograph comes from [his CSKA Moscow player profile](https://cskabasket.com/en/team/player/84/). Local files cover the expanded rankings in the featured Dončić and Edwards examples and James’s comparisons at ages 28 and 36.

Players without bundled images use the Basketball-Reference archive and then the NBA CDN when an NBA ID is known. Jordan Hamilton also has a verified ESPN archive image. The final fallback displays the player’s initials. Each change of player resets the image-loading state.

[`data/photo-manifest.json`](../data/photo-manifest.json) records the exact coverage, source URLs, file sizes and checksums. The sync script detects the NBA’s generic silhouette by checksum and uses an archived headshot for those players, including Al Harrington and Jason Richardson. The NBA ID map covers 2,762 of the 2,859 players in the dataset. The photographic assets remain the property of their respective rights holders.

## Reproduce

After preparing the statistical dataset, run:

```sh
node --experimental-strip-types scripts/sync-photos.mjs
```

This rebuilds `src/lib/player-photos.json`, reuses the registered PNG and archived JPEG files, and updates the provenance manifest. Add `--refresh` to retrieve newer portraits. No credentials or account connection are required. The downloaded Python file is parsed as data, never executed.
