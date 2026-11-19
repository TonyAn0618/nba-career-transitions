import type { ReactNode } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import {
  percent,
  pp,
  seasonLabel,
  shortName,
  PLAYER_COLORS,
} from "../lib/analysis";
import { zoneChanges } from "../lib/transitions";
import {
  MATCH_WEIGHTS,
  MIN_MATCH_FGA,
  type HistoricalTransition,
  type matchTransitions,
} from "../lib/transition-matches";
import type { TwinFollowup } from "../lib/paired-career";
import type { SeasonRow, Translate } from "../lib/types";
import { BAND_COLORS, bandNames } from "./TransitionCharts";
import "./transition-matches.css";

type Ranking = ReturnType<typeof matchTransitions>;

function ScoreMethod({
  ranking,
  selected,
  t,
}: {
  ranking: Ranking;
  selected?: HistoricalTransition;
  t: Translate;
}) {
  const { shift, start, volume } = MATCH_WEIGHTS;
  const s = selected?.similarity;
  return (
    <details className="tm-method">
      <summary>
        <BookOpen size={14} />
        {t("How is similarity scored?", "相似度怎么算？")}
        <ChevronDown size={14} />
      </summary>
      <div className="tm-method-body">
        <p>
          {t(
            `Compare different players whose start and end ages and elapsed seasons match. The historical transition must end before the selected end season. Both endpoints need age, minutes, valid five-zone shares and at least ${MIN_MATCH_FGA} field goal attempts. Each player's best interval counts once.`,
            `筛选起止年龄、赛季跨度均相同的其他球员，且对方的比较区间更早。两端赛季都需要有年龄、有效分钟数、完整五区占比和至少 ${MIN_MATCH_FGA} 次出手。每位球员取最高分区间。`,
          )}
        </p>
        <p className="tm-equation">
          {t("Score", "总分")} = 100 × ({shift.toFixed(2)} D +{" "}
          {start.toFixed(2)} S + {volume.toFixed(2)} V)
        </p>
        <dl>
          <div>
            <dt>{t("D · Shot mix change", "D · 出手变化")}</dt>
            <dd>
              {t(
                "For each zone, take the end share minus the start share (Δ). Split gains and losses into separate channels. Bray–Curtis similarity is twice the sum of the smaller same-direction changes, divided by the sum of both players’ absolute changes across all zones. Two unchanged profiles score 1. If only one changes, the score is 0.",
                "逐区计算结束占比减起始占比（Δ），把增投与减投分开。计算 Bray–Curtis 相似度时，同向变化取两人幅度的较小值，反向取 0。将五区结果相加并乘 2，除以两人五区绝对变化量之和。两人都无变化时取 1，仅一人有变化时取 0。",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("S · Starting mix", "S · 起点分布")}</dt>
            <dd>
              {t(
                "Sum the smaller of the two starting shares in each zone. Identical starting distributions score 1.",
                "逐区取两人起始占比的较小值，再将五区相加。起始分布完全一致时取 1。",
              )}
            </dd>
          </div>
          <div>
            <dt>{t("V · Shot volume", "V · 出手量")}</dt>
            <dd>
              {t(
                "Compute attempts per 36 minutes at each endpoint. For each season pair divide the smaller rate by the larger, then average the two ratios.",
                "分别计算起始和结束赛季每 36 分钟出手数。两端各取两人较小值除以较大值，再取两个比值的平均。",
              )}
            </dd>
          </div>
        </dl>
        <p>
          {t(
            "The display uses published shares. For scoring, divide each share by that season’s five-zone sum to correct rounding. The weights give priority to the size and direction of the shift. They are design choices. Ranks use the two endpoints only, across positions and eras, using absolute shot shares. The career charts show all recorded seasons. The three-season follow-up table limits the historical player to records available by the selected player’s later season.",
            "图表显示来源公布的占比。评分前，各区占比除以当季五区占比之和，校正舍入误差。权重是本项目的设计选择，优先考虑转型的方向和幅度。评分只使用起止两季，跨位置、跨年代比较实际出手占比。生涯图展示所有有记录赛季。下方的后三季追踪表中，历史球员只使用截至所选球员较晚赛季已有的记录。",
          )}{" "}
          <a
            href="https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.braycurtis.html"
            target="_blank"
            rel="noreferrer"
          >
            Bray–Curtis ↗
          </a>
        </p>
        {s && selected && ranking.anchor && (
          <p className="tm-worked">
            <b>{selected.b.name}</b> · D {s.shift.toFixed(3)} · S{" "}
            {s.start.toFixed(3)} · V {s.volume.toFixed(3)} →{" "}
            <strong>{s.score.toFixed(1)} / 100</strong>
            <br />
            {t("Attempts per 36 minutes", "每 36 分钟出手数")} ·{" "}
            {ranking.anchor.volume.map((v) => v.toFixed(1)).join(" → ")}（
            {t("selected player", "所选球员")}） /{" "}
            {selected.profile.volume.map((v) => v.toFixed(1)).join(" → ")}（
            {shortName(selected.b.name)}）
          </p>
        )}
      </div>
    </details>
  );
}

export default function TransitionMatches({
  a,
  b,
  ranking,
  selected,
  followup,
  onSelect,
  band,
  onBand,
  children,
  t,
}: {
  a: SeasonRow;
  b: SeasonRow;
  ranking: Ranking;
  selected?: HistoricalTransition;
  followup: TwinFollowup;
  onSelect: (id: string) => void;
  band: number;
  onBand: (i: number) => void;
  children?: ReactNode;
  t: Translate;
}) {
  const names = bandNames(t);
  const changes = zoneChanges(a, b);
  const otherChanges = selected ? zoneChanges(selected.a, selected.b) : [];
  const extent = Math.max(
    5,
    Math.ceil(
      Math.max(...[...changes, ...otherChanges].map((v) => Math.abs(v ?? 0))) /
        5,
    ) * 5,
  );
  return (
    <section
      className="ct-panel ct-matches"
      aria-labelledby="matches-title"
      id="transition-matches"
    >
      <div className="ct-panel-head">
        <h2 id="matches-title">
          {t(
            "Find players who made a similar transition",
            "找经历过类似转型的球员",
          )}
        </h2>
        {ranking.anchor && (
          <span>
            {t(
              `Ages ${a.age} → ${b.age} · ${ranking.count} eligible players`,
              `${a.age} → ${b.age} 岁 · ${ranking.count} 名符合条件的球员`,
            )}
          </span>
        )}
      </div>
      {selected ? (
        <>
          <div className="tm-ranks">
            <h3>
              {t("Closest matches", "最相似的球员")}
              <small>{t("Score / 100", "评分 / 100")}</small>
            </h3>
            <div className="tm-options">
              {ranking.matches.map((match, i) => (
                <button
                  className="tm-candidate"
                  key={match.b.playerId}
                  aria-pressed={match === selected}
                  onClick={() => onSelect(match.b.playerId)}
                >
                  <span className="tm-rank">{i + 1}</span>
                  <span className="tm-candidate-name">
                    {match.b.name}
                    <small>
                      {seasonLabel(match.a.season)} →{" "}
                      {seasonLabel(match.b.season)}
                    </small>
                  </span>
                  <strong>{match.similarity.score.toFixed(1)}</strong>
                </button>
              ))}
            </div>
          </div>
          <ScoreMethod ranking={ranking} selected={selected} t={t} />
          {children}
          <div className="tm-grid tm-paired-details">
            <div className="tm-shifts">
              <h3>
                {t("Where did their shots shift?", "当时哪里像？")}
                <small>
                  {t(
                    "Earlier → later · change in pp",
                    "较早季 → 较晚季 · 变化量为百分点",
                  )}
                </small>
              </h3>
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
                        <button
                          aria-pressed={band === i}
                          onClick={() => onBand(i)}
                        >
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
                            {percent(start.shares[i])} →{" "}
                            {percent(end.shares[i])}
                          </span>{" "}
                          <b
                            className={
                              delta != null && delta > 0
                                ? "tm-gain"
                                : "tm-delta"
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
            </div>
            <div className="tm-future">
              <h3>
                {t("What happened next?", "后来三个赛季怎么走？")}
                <small>
                  {t(
                    "From each player’s later selected season",
                    "从各自所选的较晚赛季往后看",
                  )}
                </small>
              </h3>
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
                  .some(
                    (r) => r.row?.fga != null && r.row.fga < MIN_MATCH_FGA,
                  ) && (
                  <>
                    {" "}
                    {t(
                      `* Fewer than ${MIN_MATCH_FGA} attempts.`,
                      `* 当季出手不足 ${MIN_MATCH_FGA} 次。`,
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      ) : (
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
      )}
      {!selected && <ScoreMethod ranking={ranking} t={t} />}
    </section>
  );
}
