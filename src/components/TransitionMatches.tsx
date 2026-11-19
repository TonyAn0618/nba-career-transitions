import PlayerPicker from "./PlayerPicker";
import PlayerPortrait from "./PlayerPortrait";
import { percent, pp, seasonLabel, PLAYER_COLORS } from "../lib/analysis";
import { zoneChanges } from "../lib/transitions";
import {
  MIN_MATCH_FGA,
  type HistoricalTransition,
  type matchTransitions,
} from "../lib/transition-matches";
import type { TwinFollowup } from "../lib/paired-career";
import type { SeasonRow, Translate } from "../lib/types";
import { BAND_COLORS, bandNames } from "./TransitionCharts";
import "./transition-matches.css";

type Ranking = ReturnType<typeof matchTransitions>;

export default function TransitionMatches({
  ranking,
  selected,
  onSelect,
  t,
}: {
  ranking: Ranking;
  selected?: HistoricalTransition;
  onSelect: (id: string) => void;
  t: Translate;
}) {
  return (
    <section
      className="ct-matches"
      aria-labelledby="matches-title"
      id="transition-matches"
    >
      {selected ? (
        <div className="tm-match-profile">
          <div className="ct-player">
            <PlayerPortrait
              playerId={selected.b.playerId}
              name={selected.b.name}
            />
            <div className="tm-match-identity">
              <h2 id="matches-title">{t("Historical twin", "历史匹配球员")}</h2>
              <PlayerPicker
                players={ranking.matches.map(({ a, b, similarity }) => ({
                  id: b.playerId,
                  name: b.name,
                  first: a.season,
                  last: b.season,
                  description: `${seasonLabel(a.season)} → ${seasonLabel(b.season)} · ${similarity.score.toFixed(1)} / 100`,
                }))}
                prioritizePopular={false}
                value={selected.b.playerId}
                onChange={onSelect}
                label={t("Choose a historical match", "选择历史匹配球员")}
                t={t}
              />
              <p>
                {selected.b.position} · {seasonLabel(selected.a.season)} →{" "}
                {seasonLabel(selected.b.season)} ·{" "}
                {(selected.b.teams ?? [selected.b.team]).join("/")}
              </p>
            </div>
          </div>
          <div className="tm-match-score">
            <span>{t("Similarity / 100", "相似度 / 100")}</span>
            <strong>{selected.similarity.score.toFixed(1)}</strong>
          </div>
        </div>
      ) : (
        <>
          <h2 id="matches-title">{t("Historical twin", "历史匹配球员")}</h2>
          <p className="tm-empty">
            {ranking.anchor
              ? t(
                  "No earlier player in this dataset meets the age, interval and sample criteria. Try a different season pair.",
                  "当前数据中没有同时满足年龄、赛季跨度和样本要求的历史球员。可以换一组赛季。",
                )
              : t(
                  `Select two seasons with age, minutes, complete distance shares and at least ${MIN_MATCH_FGA} attempts each.`,
                  `请选择两个年龄、分钟数和五区占比均完整，且各有至少 ${MIN_MATCH_FGA} 次出手的赛季。`,
                )}
          </p>
        </>
      )}
    </section>
  );
}

export function MatchComparisonTables({
  a,
  b,
  selected,
  followup,
  band,
  onBand,
  t,
}: {
  a: SeasonRow;
  b: SeasonRow;
  selected: HistoricalTransition;
  followup: TwinFollowup;
  band: number;
  onBand: (i: number) => void;
  t: Translate;
}) {
  const names = bandNames(t);
  const changes = zoneChanges(a, b);
  const otherChanges = zoneChanges(selected.a, selected.b);
  const extent = Math.max(
    5,
    Math.ceil(
      Math.max(...[...changes, ...otherChanges].map((v) => Math.abs(v ?? 0))) /
        5,
    ) * 5,
  );
  return (
    <>
      <section
        className="ct-panel tm-detail tm-shifts"
        aria-labelledby="shifts-title"
      >
        <h2 id="shifts-title">
          {t("Where did their shots shift?", "当时哪里像？")}
          <small>
            {t(
              "Earlier → later · change in pp",
              "较早季 → 较晚季 · 变化量为百分点",
            )}
          </small>
        </h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("Distance", "距离")}</th>
              <th scope="col" className="tm-player-col">
                <i
                  className="pc-mark"
                  style={{ background: PLAYER_COLORS[0] }}
                />{" "}
                {b.name}
                <small>
                  {seasonLabel(a.season)} → {seasonLabel(b.season)}
                </small>
              </th>
              <th scope="col" className="tm-player-col">
                <i
                  className="pc-mark square"
                  style={{ background: PLAYER_COLORS[1] }}
                />{" "}
                {selected.b.name}
                <small>
                  {seasonLabel(selected.a.season)} →{" "}
                  {seasonLabel(selected.b.season)}
                </small>
              </th>
              <th className="pc-delta-key" scope="col">
                {t("Shift · pp", "变化 · pp")}
                <small>
                  −{extent}　0　+{extent}
                </small>
              </th>
            </tr>
          </thead>
          <tbody>
            {names.map((name, i) => (
              <tr key={i} className={i === band ? "tm-focus" : undefined}>
                <th scope="row">
                  <button aria-pressed={band === i} onClick={() => onBand(i)}>
                    <i style={{ background: BAND_COLORS[i] }} />
                    {name}
                  </button>
                </th>
                {[
                  { start: a, end: b, delta: changes[i] },
                  {
                    start: selected.a,
                    end: selected.b,
                    delta: otherChanges[i],
                  },
                ].map(({ start, end, delta }) => (
                  <td key={end.id}>
                    <span className="tm-endpoints">
                      {percent(start.shares[i])} → {percent(end.shares[i])}
                    </span>{" "}
                    <b
                      className={
                        delta != null && delta > 0 ? "tm-gain" : "tm-delta"
                      }
                    >
                      {pp(delta).split(" ")[0]}
                    </b>
                  </td>
                ))}
                <td className="pc-delta-cell">
                  <span className="pc-delta-plot" aria-hidden="true">
                    {[changes[i], otherChanges[i]].map((d, side) =>
                      d == null ? null : (
                        <i
                          key={side}
                          style={{
                            left: 50 + (48 * d) / extent + "%",
                            background: PLAYER_COLORS[side],
                            top: side ? "67%" : "30%",
                          }}
                        />
                      ),
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section
        className="ct-panel tm-detail tm-future"
        aria-labelledby="followup-title"
      >
        <h2 id="followup-title">
          {t("What happened next?", "后来三个赛季怎么走？")}
          <small>
            {t(
              "From each player’s later selected season",
              "从各自所选的较晚赛季往后看",
            )}
          </small>
        </h2>
        <div className="tm-future-control">
          <label>
            {t("Track shot share", "追踪出手占比")}{" "}
            <select
              value={band}
              onChange={(e) => onBand(Number(e.target.value))}
            >
              {names.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <table className="pc-follow-table">
          <thead>
            <tr>
              <th scope="col">{t("Phase", "阶段")}</th>
              {[b, selected.b].map((r) => (
                <th key={r.id} scope="col">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {followup.map((stage, i) => (
              <tr key={i}>
                <th scope="row">
                  <span className="tm-offset">
                    {i === 0
                      ? t("Later season", "较晚季")
                      : t(`${i}y later`, `${i} 年后`)}
                  </span>
                </th>
                {stage.map(({ row, year, observable }, side) => (
                  <td key={side}>
                    <small>{seasonLabel(year)}</small>
                    {row ? (
                      <>
                        <b>{percent(row.shares[band])}</b>
                        <span>
                          {" "}
                          · {pp(row.rts)} · {row.fga ?? "—"}
                          {row.fga != null && row.fga < MIN_MATCH_FGA
                            ? "*"
                            : ""}
                        </span>
                      </>
                    ) : (
                      <span>
                        {observable
                          ? t("No season record", "无赛季记录")
                          : t("Outside coverage", "超出观察期")}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tm-caption">
          {t(
            "Each cell shows shot share · rTS relative to league average · field goal attempts.",
            "各格依次为所选区域出手占比、相对联盟真实命中率（pp）和总出手数。",
          )}
          {followup
            .flat()
            .some((r) => r.row?.fga != null && r.row.fga < MIN_MATCH_FGA) && (
            <>
              {" "}
              {t(
                `* Fewer than ${MIN_MATCH_FGA} attempts.`,
                `* 当季出手不足 ${MIN_MATCH_FGA} 次。`,
              )}
            </>
          )}
        </p>
      </section>
    </>
  );
}
