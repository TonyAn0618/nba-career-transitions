import { useEffect, useMemo, useState } from "react";
import { seasonLabel } from "../lib/analysis";
import { COHORT_SIZE, cohortOutlook } from "../lib/age-peers";
import {
  careerShootingTotals,
  rankCareerPeers,
  type CareerPeer,
} from "../lib/career-peers";
import { alignPeerStages } from "../lib/peer-stages";
import type { SeasonRow, Translate } from "../lib/types";
import backtest from "../lib/age-peer-backtest.json";
import { PeerMatchRadar } from "./PeerShootingComparison";
import PeerScoreMethod from "./PeerScoreMethod";
import { PeerStageCourts } from "./CareerCourts";
import PeerCareerTimeline from "./PeerCareerTimeline";
import ShotSelectionAdvice from "./ShotSelectionAdvice";
import PeerTransitionReview from "./PeerTransitionReview";
import PlayerPortrait from "./PlayerPortrait";
import "./age-peers.css";

interface Props {
  anchor: SeasonRow;
  careers: Map<string, SeasonRow[]>;
  peerId: string | null;
  onPeer: (id: string | null) => void;
  selectedYear: number | null;
  onYear: (year: number | null) => void;
  t: Translate;
}

function GroupOutlook({
  anchor,
  careers,
  matches,
  t,
}: Pick<Props, "anchor" | "careers" | "t"> & { matches: CareerPeer[] }) {
  const outlook = useMemo(
    () => cohortOutlook(matches, careers, anchor),
    [matches, careers, anchor],
  );
  const signed = (value: number | null) =>
    value == null ? "—" : (value > 0 ? "+" : "") + value.toFixed(1);
  return (
    <details className="ap-details">
      <summary>
        {t("Historical group estimates & backtest", "同组历史估计与回测")}
      </summary>
      <p>
        {t(
          `Up to ten matches · observations available by ${seasonLabel(anchor.season)} · rTS in percentage points above league average. The range uses the middle half of changes added to the starting rTS, with at least three paired observations.`,
          `取最相似的最多十人，仅使用截至 ${seasonLabel(anchor.season)} 已知的后续。将参照球员的效率变化加到目标起点，单位为高于联盟真实命中率的百分点。至少三人有配对记录时显示中间 50% 区间。`,
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t("Years later", "参考季之后")}</th>
            <th>{t("Usable peers", "配对人数")}</th>
            <th>{t("Estimated rTS", "rTS 估计")}</th>
            <th>{t("Middle 50%", "中间 50%")}</th>
          </tr>
        </thead>
        <tbody>
          {outlook.slice(1).map((v, i) => (
            <tr key={i}>
              <th>
                +{i + 1} {t("yr", "年")}
              </th>
              <td>{v.pairedCount}</td>
              <td>{signed(v.prediction)}</td>
              <td>{v.scenario ? v.scenario.map(signed).join(" ~ ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>{t("Historical forecast error", "历史预测误差")}</h4>
      <p>
        {t(
          `Ages ${backtest.minAge}–${backtest.maxAge} · one baseline per player · mean absolute rTS error in percentage points.`,
          `${backtest.minAge}–${backtest.maxAge} 岁球员，每人一个起点。下表为 rTS 的平均绝对误差（百分点）。`,
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t("Years ahead", "时距")}</th>
            <th>n</th>
            <th>{t("Peers", "生涯类比")}</th>
            <th>{t("Hold starting rTS", "沿用起点 rTS")}</th>
          </tr>
        </thead>
        <tbody>
          {backtest.horizons.map((h) => (
            <tr key={h.years}>
              <th>+{h.years}</th>
              <td>{h.scored}</td>
              <td>{h.peerMae.toFixed(2)}</td>
              <td>{h.persistenceMae.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default function AgePeers({
  anchor,
  careers,
  peerId,
  onPeer,
  selectedYear,
  onYear,
  t,
}: Props) {
  const { target, matches } = useMemo(
    () => rankCareerPeers(anchor, careers),
    [anchor, careers],
  );
  const rank = matches.findIndex((m) => m.baseline.playerId === peerId);
  const selected = matches[Math.max(0, rank)];
  const peer = selected?.baseline;
  const id = peer?.playerId ?? null;
  const career = id ? careers.get(id)! : [];
  const debutRow =
    selected &&
    career.find((row) => row.season === selected.history.debutSeason);
  const laterSeasons = peer
    ? career.filter((row) => row.season > peer.season)
    : [];
  const comparison = useMemo(() => {
    if (!target || !selected) return null;
    const targetRows = careers.get(anchor.playerId)!;
    const peerRows = careers.get(selected.baseline.playerId)!;
    return {
      careers: [targetRows, peerRows] as const,
      seasons: alignPeerStages(
        targetRows,
        target.debutSeason,
        peerRows,
        selected.history.debutSeason,
      ),
      totals: {
        target: careerShootingTotals(targetRows, target.debutSeason),
        peer: careerShootingTotals(peerRows, selected.history.debutSeason),
      },
    };
  }, [anchor.playerId, careers, target, selected]);
  const invalidPeer = peerId != null && peerId !== id;
  const stage =
    !invalidPeer && selectedYear != null
      ? (comparison?.seasons.find(
          (s) => s.year === selectedYear && (s.target || s.peer),
        ) ?? null)
      : null;
  useEffect(() => {
    if (peerId !== id) onPeer(id);
    if (!stage && selectedYear != null) onYear(null);
  }, [id, peerId, onPeer, onYear, selectedYear, stage]);
  const choosePeer = (newId: string) => {
    if (newId === id) return;
    onPeer(newId);
    onYear(null);
  };
  const [expanded, setExpanded] = useState(false);
  const shown = matches.slice(0, expanded ? COHORT_SIZE : 5);
  if (rank >= shown.length) shown.push(selected);
  return (
    <section className="ap-section" id="age-peers" aria-labelledby="ap-title">
      <header className="ap-header">
        <h2 id="ap-title">
          {t("Career transition references", "生涯转型参考")}
        </h2>
      </header>
      {selected && peer && target && comparison ? (
        <>
          <div className="ap-match-grid">
            <section className="ap-match-result">
              <header>
                <div className="ap-match-player">
                  <PlayerPortrait
                    className="ap-featured-portrait"
                    playerId={peer.playerId}
                    name={peer.name}
                  />
                  <h3>{peer.name}</h3>
                </div>
                <div className="ap-score-line">
                  <strong>{selected.score.toFixed(1)}</strong>
                  <div>
                    <b>/ 100</b>
                    <span>{t("Career similarity", "生涯投篮相似度")}</span>
                  </div>
                </div>
                <PeerScoreMethod match={selected} t={t} />
              </header>
              <PeerMatchRadar
                anchor={anchor}
                target={target}
                selected={selected}
                t={t}
              />
              <dl className="ap-season-facts">
                <div>
                  <dt>{t("Debut season", "首秀赛季")}</dt>
                  <dd>
                    {seasonLabel(selected.history.debutSeason)}
                    {debutRow?.age != null &&
                      t(
                        ` · season age ${debutRow.age}`,
                        ` · ${debutRow.age} 岁`,
                      )}
                  </dd>
                </div>
                <div>
                  <dt>
                    {t(
                      `Career year ${selected.history.careerYear}`,
                      `生涯第 ${selected.history.careerYear} 季`,
                    )}
                  </dt>
                  <dd>
                    {seasonLabel(peer.season)}
                    {peer.age != null &&
                      t(` · season age ${peer.age}`, ` · ${peer.age} 岁`)}
                  </dd>
                </div>
                <div>
                  <dt>{t("Subsequent records", "此后有记录")}</dt>
                  <dd>
                    {laterSeasons.length === 0 ? (
                      t("No later season in this dataset", "库中没有后续赛季")
                    ) : (
                      <a href="#peer-transition">
                        {laterSeasons.length === 1
                          ? t(
                              `${seasonLabel(laterSeasons[0].season)} (1 season)`,
                              `${seasonLabel(laterSeasons[0].season)}（1 季）`,
                            )
                          : t(
                              `${seasonLabel(laterSeasons[0].season)} to ${seasonLabel(laterSeasons[laterSeasons.length - 1].season)} (${laterSeasons.length} seasons)`,
                              `${seasonLabel(laterSeasons[0].season)} 至 ${seasonLabel(laterSeasons[laterSeasons.length - 1].season)}（${laterSeasons.length} 季）`,
                            )}
                        <span aria-hidden="true"> ↓</span>
                      </a>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="ap-ranking">
              <h3>{t("Historical match ranking", "相似球员排行")}</h3>
              <details className="ap-match-why">
                <summary>
                  {t("Why these players?", "为什么是这些球员？")}
                </summary>
                <p>
                  {t(
                    `The ranking uses ${anchor.name}’s full recorded career through ${seasonLabel(anchor.season)}. Each peer debuted at least one season earlier and played the same primary position (${target.position}) in career year ${target.careerYear}. We compare their records through year ${target.careerYear}, both by season and in total. Shot distribution, accuracy by zone and attempts per 36 minutes carry equal weight.`,
                    `排名使用 ${anchor.name} 截至 ${seasonLabel(anchor.season)} 的全部生涯记录。参照球员须至少早一个赛季首秀，且在生涯第 ${target.careerYear} 季同样担任 ${target.position}。双方比较截至第 ${target.careerYear} 季的逐季和累计表现，出手分布、分区命中率和每 36 分钟出手量各占三分之一。`,
                  )}
                </p>
              </details>
              <div className="ap-choices">
                {shown.map((m, i) => {
                  const row = m.baseline;
                  const place = m === selected && rank >= 0 ? rank + 1 : i + 1;
                  const debut = t(
                    `Debut ${seasonLabel(m.history.debutSeason)}`,
                    `首秀 ${seasonLabel(m.history.debutSeason)}`,
                  );
                  return (
                    <button
                      key={row.id}
                      aria-pressed={m === selected}
                      aria-label={`#${place} ${row.name} · ${debut} · ${m.score.toFixed(1)} / 100`}
                      onClick={() => choosePeer(row.playerId)}
                    >
                      <span className="ap-rank">{place}</span>
                      <PlayerPortrait
                        className="ap-rank-portrait"
                        playerId={row.playerId}
                        name={row.name}
                      />
                      <strong>{row.name}</strong>
                      <small>{debut}</small>
                      <b>{m.score.toFixed(1)}</b>
                    </button>
                  );
                })}
              </div>
              {matches.length > 5 && (
                <button
                  className="ap-more"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? t("Show top five", "收起")
                    : t(
                        `Show top ${Math.min(COHORT_SIZE, matches.length)}`,
                        `查看前 ${Math.min(COHORT_SIZE, matches.length)} 名`,
                      )}
                </button>
              )}
            </section>
          </div>
          <div className="ap-linked-charts">
            <PeerCareerTimeline
              key={peer.id + "/" + anchor.id}
              anchor={anchor}
              baseline={peer}
              seasons={comparison.seasons}
              selectedStage={stage}
              totals={comparison.totals}
              onStage={onYear}
              t={t}
            />
            <PeerStageCourts
              anchor={anchor}
              baseline={peer}
              stage={stage}
              totals={comparison.totals}
              careers={comparison.careers}
              t={t}
            />
          </div>
          <PeerTransitionReview
            key={"review/" + peer.id + "/" + anchor.id}
            anchor={anchor}
            peer={peer}
            career={comparison.careers[1]}
            playerCareer={comparison.careers[0]}
            debut={selected.history.debutSeason}
            matchYear={target.careerYear}
            selectedYear={stage?.year ?? null}
            onYear={(year) => onYear(year === stage?.year ? null : year)}
            t={t}
          />
        </>
      ) : (
        <>
          <section
            className="pr-review"
            id="peer-transition"
            aria-labelledby="peer-transition-title"
          >
            <ShotSelectionAdvice
              key={anchor.id}
              anchor={anchor}
              career={careers.get(anchor.playerId) ?? []}
              t={t}
            />
          </section>
          <p className="ap-empty">
            {target
              ? t(
                  `No earlier entrant with sufficient shooting records played ${target.position} in career year ${target.careerYear}, ${anchor.name}’s last recorded year.`,
                  `${anchor.name} 的最近记录是生涯第 ${target.careerYear} 季，主位置为 ${target.position}。库中没有首秀更早、在第 ${target.careerYear} 季同位置且投篮记录足够的参照球员。`,
                )
              : t(
                  "The career records lack a verified debut, a primary position, or enough shooting data.",
                  "现有生涯记录缺少首秀赛季、主位置或足够的投篮数据。",
                )}
          </p>
        </>
      )}
      {target && matches.length > 0 && (
        <GroupOutlook
          anchor={anchor}
          careers={careers}
          matches={matches}
          t={t}
        />
      )}
    </section>
  );
}
