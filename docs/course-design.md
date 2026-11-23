# Visual design and evaluation

English · [简体中文](course-design.zh-CN.md)

Shot Atlas is designed for an NBA player-development scout. Starting with a particular age, the scout can ask where a player moved his attempts, how his accuracy and scoring efficiency changed, and what a historical peer’s later career suggests investigating.

## Connections to COMP 6411D

The page numbers refer to the course lecture PDFs used during development.

| Lecture | Topic and pages                                                        | Application in Shot Atlas                                                                                                     |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 01      | Audience and decision-making, p. 65                                    | Paired shot maps use identically sized courts and show how many attempts each map covers.                                     |
| 02      | Exploration, comparison and narrative, pp. 6–20, 33–34                 | Featured examples and name search share one player selector.                                                                  |
| 03      | Color, proximity and ordered lightness, pp. 36–47, 79–85, 109–110      | Lightness encodes a rate in the rings. Adjacent bars and percentages allow precise comparisons.                               |
| 04      | Zero baselines, common scales and time series, pp. 25, 37–54, 60–61    | Zone bars start at zero. The age-based efficiency curve uses zero for the contemporary league average.                        |
| 05      | Points, matrices and color, pp. 12, 20                                 | Rings and sectors encode an age-by-zone matrix. Each plotted shot has its own location.                                       |
| 06      | Focus and context, small multiples, pp. 8–13, 35–51                    | The full career remains visible while a linked pie chart shows one age. The two courts share a projection.                    |
| 07      | Evaluation against user tasks, pp. 9–10, 19, 25–29                     | Navigation follows three tasks: explore a player, find a historical peer, or compare league styles.                           |
| 08      | Graphical integrity and visual clutter, pp. 26–35, 51–55, 67–72, 82–85 | Ring radius encodes age. Attempt counts are displayed separately. Subtle gridlines keep the data legible.                     |
| 09      | Dynamic queries and linked views, pp. 26–27, 35–45, 50–54              | Selecting a ring updates the pie chart and efficiency cursor. The two-season bars and courts use the same selections.         |
| 10      | Individuals, context and missing observations, pp. 7–14, 22–29, 53     | Names, actual seasons, coverage, low attempt counts and missing records remain visible.                                       |
| 11      | Anchoring, confirmation and selection bias, pp. 10–25, 45–51, 66–68    | Historical matching uses only information through the relevant career year.                                                   |
| 12      | Evaluation, tasks, insight and ICE-T, pp. 7–12, 18–28                  | Browser walkthroughs exercise scouting tasks. Regression tests and a historical backtest check calculations and estimates.    |
| 13      | Neighborhoods and ranking, pp. 15–20, 65–69                            | A ranked list finds peers. A five-zone radar chart lets the reader inspect the match.                                         |
| 14      | Hierarchies, area and composition, pp. 25–38, 60–62                    | Five pie sectors partition the season’s shots. Angles represent attempt shares.                                               |
| 15      | Vectors, similarity and drill-down, pp. 45–57, 62–68                   | The score combines pooled and year-aligned profiles. The reader can inspect the underlying zone statistics.                   |
| 16      | Space, time and small multiples, pp. 49, 55, 67, 73, 79, 89            | Rings move outward with age at equal intervals. Gaps in a career retain their space.                                          |
| 17      | Direct manipulation, touch and small screens, pp. 10–14, 47, 50–52     | Touch can pin a ring. Age controls and previous/next buttons provide another way to select a season.                          |
| 18      | Accessibility and internationalization, pp. 4–15, 27–35                | English and Chinese views preserve shareable selections. Key charts have text or tables, and controls support keyboard focus. |

## Three demonstration questions

- **LeBron James.** How did his 10–16 ft shots change from age 19 to 41? Choose the two ages, compare shot shares and zone FG%, then use season TS% to check the overall efficiency change.
- **Luka Dončić.** Which earlier-debuting point guard had the closest shooting profile through eight career years? Open the ranking, inspect the calculation and select year six on the timeline to compare the two courts.
- **League-wide.** How do shooting styles change across the three age groups? Compare style shares and sample counts, then select a style in the flow diagram to see where those players appear next.

## GenAI use

OpenAI Codex assisted with reviewing course materials and the revised proposal, implementation of the interface and data processing, regression tests, and browser checks. The source manifests identify the published statistical and photographic data. The submitted M5 ZIP includes the original prompt excerpts, English translations and corresponding outputs in `GenAI.md`.
