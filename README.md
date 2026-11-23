# NBA Player Career Transitions

English · [简体中文](README.zh-CN.md)

How does a player change his shot selection as he ages, and what can a scout learn from a player who faced a similar transition? Shot Atlas follows 2,859 players across 30 NBA regular seasons, from 1996–97 through 2025–26. It compares five shooting distances, scoring efficiency and the later careers of historical peers.

[Open the live demo](https://tonyan0618.github.io/nba-career-transitions/) · [Explore Dončić and Russell in English](https://tonyan0618.github.io/nba-career-transitions/?player=doncilu01&ref=2026&lang=en&peer=russeda01&view=peers#age-peers)

## Try the visualization

1. **Explore one career.** Select LeBron James and pin age 28 on the career rings. The linked pie chart shows that 37.3% of his shots came at the rim and 18.8% from three. Compare two ages to see how shot share, accuracy and true shooting changed. The efficiency chart uses the league average for the same season as its reference.
2. **Find a historical match.** In the Dončić example, D’Angelo Russell ranks first at 89.4/100 through career year eight. Expand the score to inspect its three components. Select a career year on the trend line to compare the two shot maps, then follow Russell for three more seasons. The scouting advice explains why Dončić should keep his mid-range looks and review his long twos. Its what-if estimates hold shot volume and free throws fixed.
3. **Compare the league.** Explore shooting styles at ages 20–23, 25–28 and 31+. Filter by position or select a style on the flow diagram to follow players between adjacent age groups. Wider bands represent more players.

The site opens in English. Use the language switch to read it in Chinese. Shared links retain the chosen language and view. Earlier [career-path](https://tonyan0618.github.io/nba-career-transitions/?view=paths&lang=en) and [interval](https://tonyan0618.github.io/nba-career-transitions/?view=interval&lang=en) views are also available.

## Install and run

Use Node.js 22.12 or newer, npm, Python 3.10 or newer, and curl. From the directory containing this README and `package.json`, run:

```sh
npm ci
npm run dev
```

Open [the local site on port 5181](http://127.0.0.1:5181/). On macOS you can also double-click `start.command`. The first run needs internet access to download the pinned season and shot datasets. Allow time for that step. Generated browser data takes about 493 MB, with additional space for the source cache. Subsequent runs reuse the downloaded data.

To build the static site and serve that build locally, stop the development server first, then run:

```sh
npm run build
npm run preview
```

Open the same local address. The static files are in `dist/`. For the hosted project, GitHub builds and publishes the site after a change reaches `main`. Pull requests from collaborators with write access merge automatically after the configured checks pass. [Build and deployment history](https://github.com/TonyAn0618/nba-career-transitions/actions/workflows/pages.yml)

## Data and methods

The season dataset contains 14,569 player-seasons. The shot maps cover 4,669,949 recorded attempts from 2003–04 through 2025–26. A player can have season statistics even when shot coordinates are unavailable. Each map reports how many attempts it covers. [Season data manifest](data/source-manifest.json) · [Shot data, coordinates and coverage](docs/shot-data.md) · [Portrait sources](docs/photo-sources.md)

Historical peers must have debuted earlier and played the same primary position in the matched career year. The score gives equal weight to shot distribution, accuracy by zone and attempts per 36 minutes. Each component combines pooled career data with comparisons at the same career years. Only seasons through the matching point contribute to the score. Later observations are used to study what happened next.

| Work on                          | Start here                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Season data and player identity  | [Season importer](scripts/sync-data.mjs) and [shot importer](scripts/sync-shots.py). Join records by player ID and season-ending year.                 |
| Historical matches and follow-up | [Career similarity](src/lib/career-peers.ts), [follow-up periods](src/lib/peer-followup.ts) and [historical backtest](scripts/backtest-age-peers.mjs). |
| Scouting suggestions             | [Shot-selection scenarios](src/lib/peer-shot-advice.ts) and [recommendation display](src/components/ShotSelectionAdvice.tsx).                          |
| Player photographs               | [Photo source notes](docs/photo-sources.md) and [photo importer](scripts/sync-photos.mjs).                                                             |
| Course design and demonstrations | [Design notes and AI use](docs/course-design.md). The M5 submission includes `GenAI.md` with prompts and output excerpts.                              |

## Verify the project

```sh
npm run prepare:data
npm test
npm run check:data
npm run check:shots
node --experimental-strip-types scripts/backtest-age-peers.mjs --check
npm run build
```

To include the 2015–16 source reconciliation in the tests on macOS or Linux, run `NBA_SHOT_RECONCILE_2016=1 npm test` after preparing the data.
