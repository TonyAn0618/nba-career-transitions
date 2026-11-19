# Player photographs

The portraits are actual NBA headshots. They identify the player; the photograph and jersey can be more recent than the selected historical season. They are not generated images.

## Identity mapping

Basketball-Reference IDs in `public/data/nba.json` are joined to NBA IDs using the public [`nba_api` static player list](https://github.com/swar/nba_api/blob/ec190700dab27498b3f75ecac8f932e3a3ee1606/src/nba_api/stats/library/data.py), pinned to commit `ec190700dab27498b3f75ecac8f932e3a3ee1606`. The package documents its [player identity lookup](https://github.com/swar/nba_api/blob/ec190700dab27498b3f75ecac8f932e3a3ee1606/docs/nba_api/stats/static/players.md).

Matching uses the complete name, with only case, accents, whitespace, and punctuation normalized. Suffixes such as Jr. and III remain significant. A normalized name must be unique in both datasets. There is no fuzzy matching, surname-only matching, or inferred identity for ambiguous players. Unmatched and ambiguous identities display initials.

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

Bundled 260 × 190 PNG files are stored in `public/players/` by player ID. The sync script includes career examples, previously registered portraits and PNG files in this directory. Other verified identities load from the same official CDN. Local-image failures retry the official source; unavailable images fall back to initials without showing a broken image. Changing the player resets that fallback state. Two known generic NBA silhouette responses (Jason Richardson and Al Harrington) are detected by their identical SHA-256 hash, excluded from the 27 bundled portraits, and displayed as initials. The full identity map covers 2,762 of 2,859 players; an identity match does not guarantee the NBA has a photograph.

[`data/photo-manifest.json`](../data/photo-manifest.json) records identity provenance, exact coverage, unresolved identities, source URLs, downloaded file sizes, and SHA-256 hashes. The NBA retains ownership of its photographic assets. Attribution does not turn them into generated or public-domain images.

## Reproduce

After preparing the statistical dataset, run:

```sh
node --experimental-strip-types scripts/sync-photos.mjs
```

This rebuilds `src/lib/player-photos.json`, keeps already downloaded valid PNG files, and updates the provenance manifest. Add `--refresh` to retrieve newer portraits. No credentials or account connection are required. The downloaded Python file is parsed as data, never executed.
