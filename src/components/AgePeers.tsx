import { useEffect, useMemo, useState } from "react";
import { fga36, percent, seasonLabel } from "../lib/analysis";
import {
  COHORT_SIZE,
  HORIZON,
  cohortOutlook,
  peerPath,
  rankAgePeers,
  type AgePeer,
} from "../lib/age-peers";
import { valueAt, hasSmallZoneSample, type Metric } from "../lib/ring-encoding";
import { zoneChanges } from "../lib/transitions";
import type { SeasonRow, Translate } from "../lib/types";
import backtest from "../lib/age-peer-backtest.json";
import ZonePairBars from "./ZonePairBars";
import "./age-peers.css";

interface Props {
  anchor: SeasonRow;
  careers: Map<string, SeasonRow[]>;
  peerId: string | null;
  onPeer: (id: string | null) => void;
  step: number;
  onStep: (step: number) => void;
  t: Translate;
}

const signed = (n: number | null) =>
  n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1).replace("-0.0", "0.0");

function zoneLabels(t: Translate) {
  return [
    t("0–3 ft", "0–3 英尺"),
    t("3–10 ft", "3–10 英尺"),
    t("10–16 ft", "10–16 英尺"),
    t("16 ft–arc", "16 英尺至三分线"),
    t("3-point", "三分"),
  ];
}

function groupedPoints(values: (number | null)[], y: (n: number) => number) {
  const paths: string[][] = [];
  values.forEach((v, i) => {
    if (v == null) return;
    if (!i || values[i - 1] == null) paths.push([]);
    paths[paths.length - 1].push(
      `${((i + 0.5) * 100) / values.length},${y(v)}`,
    );
  });
  return paths;
}

function EfficiencyChart({
  anchor,
  path,
  outlook,
  step,
  onStep,
  t,
}: {
  anchor: SeasonRow;
  path: (SeasonRow | null)[];
  outlook: ReturnType<typeof cohortOutlook>;
  step: number;
  onStep: Props["onStep"];
  t: Translate;
}) {
  const peer = path[0]!;
  const median = outlook.map((o) => o.median),
    observed = path.map((r) => r?.rts ?? null);
  const all = [...median, ...observed, anchor.rts].filter(
    (n): n is number => n != null,
  );
  const extent = Math.max(5, 5 * Math.ceil(Math.max(...all.map(Math.abs)) / 5));
  const y = (v: number) => 50 - (v / extent) * 43;
  const series = [
    { id: "median", values: median },
    { id: "peer", values: observed },
  ];
  const x = (i: number) => ((i + 0.5) * 100) / (HORIZON + 1);
  const value = (v: number | null) =>
    v == null ? "—" : signed(v) + t(" pp", " 个百分点");
  return (
    <div className="ap-chart">
      <h3>{t("Efficiency over the next five ages", "之后五年的得分效率")}</h3>
      <p className="ap-sub">
        {t(
          "True shooting above / below that season’s league average (pp)",
          "真实命中率高出或低于当季联盟平均的百分点（rTS）",
        )}
      </p>
      <div className="ap-legend">
        <span>
          <i className="ap-k-anchor" />
          {anchor.name} · {t("baseline", "起点")}
        </span>
        <span>
          <i className="ap-k-peer" />
          {peer.name}
        </span>
        <span>
          <i className="ap-k-median" />
          {t("Peer median", "同龄参照中位数")}
        </span>
      </div>
      <div className="ap-chart-body">
        <div className="ap-y-axis" aria-hidden="true">
          {[extent, 0, -extent].map((v) => (
            <span key={v} style={{ top: y(v) + "%" }}>
              {v > 0 ? "+" : ""}
              {v}
            </span>
          ))}
        </div>
        <div className="ap-plot" aria-hidden="true">
          {[extent, 0, -extent].map((v) => (
            <div
              key={v}
              className={"ap-guide" + (!v ? " ap-zero" : "")}
              style={{ top: y(v) + "%" }}
            />
          ))}
          <div className="ap-cursor" style={{ left: x(step) + "%" }} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {series.map((s) =>
              groupedPoints(s.values, y).map((points, index) => (
                <polyline
                  key={s.id + index}
                  className={"ap-line ap-" + s.id}
                  vectorEffect="non-scaling-stroke"
                  points={points.join(" ")}
                />
              )),
            )}
          </svg>
          {series.map((s) =>
            s.values.map((v, i) =>
              v == null ? null : (
                <i
                  key={s.id + i}
                  className={"ap-point ap-" + s.id}
                  style={{ left: x(i) + "%", top: y(v) + "%" }}
                />
              ),
            ),
          )}
          {anchor.rts != null && (
            <i
              className="ap-point ap-anchor"
              style={{ left: x(0) + "%", top: y(anchor.rts) + "%" }}
            />
          )}
        </div>
        <span className="ap-age-label">{t("Age", "年龄")}</span>
        <div
          className="ap-ages"
          role="group"
          aria-label={t("Age to inspect", "选择观察年龄")}
        >
          {outlook.map((_, i) => (
            <button
              type="button"
              key={i}
              aria-pressed={i === step}
              aria-label={t(
                `Inspect age ${anchor.age! + i}`,
                `查看 ${anchor.age! + i} 岁`,
              )}
              onClick={() => onStep(i)}
            >
              {anchor.age! + i}
            </button>
          ))}
        </div>
      </div>
      <p className="ap-readout" aria-live="polite">
        <strong>
          {t(`Age ${anchor.age! + step}`, `${anchor.age! + step} 岁`)}
        </strong>
        <span>
          {peer.name} <b>{value(observed[step])}</b>
        </span>
        <span>
          {t("Median", "中位数")} <b>{value(median[step])}</b> · n=
          {outlook[step].count}
        </span>
      </p>
    </div>
  );
}

function baselineVolume(row: SeasonRow) {
  return [
    fga36(row)?.toFixed(1) ?? "—",
    row.fga && row.fta != null ? (row.fta / row.fga).toFixed(2) : "—",
  ];
}

function largestProfileGap(anchor: SeasonRow, peer: SeasonRow, t: Translate) {
  const changes = zoneChanges(anchor, peer);
  let largest = 0;
  let zone = 0;
  changes.forEach((delta, i) => {
    if (delta != null && Math.abs(delta) > Math.abs(largest)) {
      largest = delta;
      zone = i;
    }
  });
  if (Math.abs(largest) < 0.05)
    return t(
      "The five shot shares match to 0.1 pp.",
      "五区出手占比相同（精确至 0.1 个百分点）。",
    );
  const leader = largest > 0 ? peer : anchor;
  const gap = Math.abs(largest).toFixed(1);
  const label = zoneLabels(t)[zone];
  return t(
    `Largest gap · ${leader.name} takes ${gap} pp more of his shots from ${label}.`,
    `最大差异在${label}，${leader.name} 的出手占比高 ${gap} 个百分点。`,
  );
}

function PeerProfile({
  anchor,
  peer,
  t,
}: {
  anchor: SeasonRow;
  peer: SeasonRow;
  t: Translate;
}) {
  const [metric, setMetric] = useState<Metric>("share");
  const series = [anchor, peer].map((row, i) => ({
    label: [row.name, seasonLabel(row.season), row.team].join(" · "),
    color: i ? "var(--ap-peer)" : "var(--ap-player)",
    values: row.shares.map((_, z) => valueAt(row, metric, z)),
    lowSample:
      metric === "fg"
        ? row.shares.map((_, z) => hasSmallZoneSample(row, z))
        : undefined,
  }));
  return (
    <section className="ap-profile" aria-labelledby="ap-profile-title">
      <div className="ap-profile-head">
        <h3 id="ap-profile-title">
          {t(`Shooting at age ${anchor.age}`, `${anchor.age} 岁的投篮分布`)}
        </h3>
        <div
          className="ap-metric-switch"
          role="group"
          aria-label={t("Shooting metric", "投篮指标")}
        >
          {(["share", "fg"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
            >
              {m === "share" ? t("Shot share", "出手占比") : t("FG%", "命中率")}
            </button>
          ))}
        </div>
      </div>
      <ZonePairBars zones={zoneLabels(t)} series={series} t={t} />
    </section>
  );
}

function MixDetails({
  baseline,
  current,
  step,
  t,
}: {
  baseline: SeasonRow;
  current: SeasonRow | null;
  step: number;
  t: Translate;
}) {
  const zones = zoneLabels(t);
  const fmtFg = (r: SeasonRow | null, i: number) => {
    if (!r || valueAt(r, "fg", i) == null) return "—";
    const thin = hasSmallZoneSample(r, i);
    return (
      <span className={thin ? "ap-thin" : ""}>
        {percent(r.fg[i])}
        {thin ? "*" : ""}
      </span>
    );
  };
  return (
    <details className="ap-details ap-zones">
      <summary>{t("Peer’s follow-up by zone", "参照球员后续分区明细")}</summary>
      <p className="ap-sub">
        {t(
          `${baseline.name} · ages ${baseline.age} → ${baseline.age! + step}`,
          `${baseline.name} · ${baseline.age} → ${baseline.age! + step} 岁`,
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t("Zone", "区域")}</th>
            <th>{t("Attempt share", "出手占比")}</th>
            <th>{t("Field goal %", "区域命中率")}</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z, i) => (
            <tr key={z}>
              <th scope="row">{z}</th>
              <td>
                {percent(baseline.shares[i])} →{" "}
                <b>{percent(current?.shares[i] ?? null)}</b>
              </td>
              <td>
                {fmtFg(baseline, i)} → <b>{fmtFg(current, i)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ap-sub">
        {t(
          "* Under 25 estimated zone attempts. A dash means unavailable.",
          "* 该区估算出手不足 25 次。破折号表示缺少记录。",
        )}
      </p>
    </details>
  );
}

function ScoutingNote({
  anchor,
  path,
  step,
  outlook,
  candidates,
  careers,
  onCompare,
  t,
}: {
  anchor: SeasonRow;
  path: (SeasonRow | null)[];
  step: number;
  outlook: ReturnType<typeof cohortOutlook>;
  candidates: AgePeer[];
  careers: Map<string, SeasonRow[]>;
  onCompare: (id: string, step: number) => void;
  t: Translate;
}) {
  const baseline = path[0]!;
  const i = step || path.findIndex((r, index) => index > 0 && r != null);
  const later = path[i];
  const metric = t(" pp", " 个百分点");
  const zones = zoneLabels(t);
  const change =
    later && i > 0
      ? zoneChanges(baseline, later)
          .map((value, zone) => ({ value, zone }))
          .filter(
            (item): item is { value: number; zone: number } =>
              item.value != null &&
              (later.shares[item.zone] ?? 0) * (later.fga ?? 0) >= 25,
          )
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]
      : null;
  const horizon = step || (i > 0 ? i : 1),
    sample = outlook[horizon];
  const selectedChange =
    later?.rts != null && baseline.rts != null
      ? later.rts - baseline.rts
      : null;
  const alternative = candidates
    .slice(0, COHORT_SIZE)
    .flatMap(({ baseline: other }) => {
      if (other.playerId === baseline.playerId || other.rts == null) return [];
      const end = peerPath(other, careers, anchor.season)[horizon];
      if (end?.rts == null) return [];
      const delta = end.rts - other.rts;
      if (
        selectedChange != null &&
        Math.sign(delta) === Math.sign(selectedChange)
      )
        return [];
      return [{ row: other, delta }];
    })[0];
  return (
    <div className="ap-scout">
      <h3>
        {t(
          "Follow-up at age " + (anchor.age! + horizon),
          `${anchor.age! + horizon} 岁的转型结果`,
        )}
      </h3>
      <p className="ap-change">
        {later && i > 0 ? (
          <>
            <strong>{baseline.name}</strong> · {baseline.age} → {later.age}{" "}
            {t("years", "岁")}
            <br />
            {change && (
              <>
                {zones[change.zone]} {t("share", "出手占比")}{" "}
                {signed(change.value)}
                {metric} ·{" "}
              </>
            )}
            {t("ΔrTS", "rTS 变化")} {signed(selectedChange)}
            {selectedChange != null && metric}
          </>
        ) : (
          t(
            `${baseline.name} has no qualifying season at age ${anchor.age! + horizon}.`,
            `${baseline.name} 在 ${anchor.age! + horizon} 岁没有合格赛季记录。`,
          )
        )}
      </p>
      <p className="ap-scenario">
        {sample.scenario ? (
          <>
            {t(
              `${anchor.name} · estimated rTS`,
              `${anchor.name} · rTS 类比估计`,
            )}{" "}
            <strong>
              {signed(sample.prediction)}
              {metric}
            </strong>
            <br />
            {t("Middle 50%", "中间 50%")} {signed(sample.scenario[0])}{" "}
            {t("to", "至")} {signed(sample.scenario[1])}
            {metric} ·{" "}
            {t(
              `${sample.pairedCount} peers`,
              `${sample.pairedCount} 名参照球员`,
            )}
            <br />
            {t("Unchanged rTS", "起点持平估计")} {signed(anchor.rts)}
            {metric}
          </>
        ) : (
          t(
            `${sample.pairedCount} paired records. A range requires three and a known starting rTS.`,
            `可用记录 ${sample.pairedCount} 人。估计区间需要至少 3 人及已知的起点 rTS。`,
          )
        )}
      </p>
      {alternative && (
        <button
          className="ap-compare"
          onClick={() => onCompare(alternative.row.playerId, horizon)}
        >
          {t(
            `Compare ${alternative.row.name} · ΔrTS ${signed(alternative.delta)} pp`,
            `对照 ${alternative.row.name} · rTS 变化 ${signed(alternative.delta)} 个百分点`,
          )}{" "}
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

export default function AgePeers({
  anchor,
  careers,
  peerId,
  onPeer,
  step,
  onStep,
  t,
}: Props) {
  const ranking = useMemo(
    () => rankAgePeers(anchor, careers),
    [anchor, careers],
  );
  const shortlist = ranking.matches.slice(0, COHORT_SIZE);
  const rank = ranking.matches.findIndex((m) => m.baseline.playerId === peerId);
  const selected = ranking.matches[Math.max(rank, 0)];
  const id = selected?.baseline.playerId ?? null;
  useEffect(() => {
    if (peerId !== id) onPeer(id);
  }, [id, peerId, onPeer]);
  const outlook = useMemo(
    () => cohortOutlook(ranking.matches, careers, anchor),
    [ranking, careers, anchor],
  );
  const path = useMemo(
    () => (selected ? peerPath(selected.baseline, careers, anchor.season) : []),
    [selected, careers, anchor.season],
  );
  const index =
    Number.isInteger(step) && step >= 0 && step <= HORIZON ? step : 0;
  const peer = selected?.baseline;
  if (rank >= COHORT_SIZE) shortlist.push(selected);
  return (
    <section className="ap-section" id="age-peers" aria-labelledby="ap-title">
      <header className="ap-header">
        <h2 id="ap-title">{t("Same-age comparisons", "同龄转型对照")}</h2>
      </header>
      {peer ? (
        <>
          <div className="ap-grid">
            <div className="ap-match">
              <label htmlFor="ap-peer">
                {t("Historical match", "历史参照球员")}
              </label>
              <select
                id="ap-peer"
                value={peer.playerId}
                onChange={(e) => onPeer(e.target.value)}
              >
                {shortlist.map((m, j) => (
                  <option
                    key={m.baseline.playerId}
                    value={m.baseline.playerId}
                  >{`#${j >= COHORT_SIZE ? rank + 1 : j + 1}　${m.baseline.name}`}</option>
                ))}
              </select>
              <div className="ap-score" aria-live="polite">
                <span>{t("Cosine similarity", "余弦相似度")}</span>
                <strong>{selected.score.toFixed(2)}</strong>
                <small>
                  {t(
                    `Rank ${Math.max(rank, 0) + 1} of ${ranking.matches.length} at age ${anchor.age}`,
                    `${anchor.age} 岁 · ${ranking.matches.length} 人中第 ${Math.max(rank, 0) + 1} 名`,
                  )}
                </small>
                <p>{largestProfileGap(anchor, peer, t)}</p>
              </div>
              <table className="ap-metrics">
                <thead>
                  <tr>
                    <th scope="col">
                      {t(`At age ${anchor.age}`, `${anchor.age} 岁时`)}
                    </th>
                    <th
                      scope="col"
                      title={t(
                        "Field goal attempts per 36 minutes",
                        "每 36 分钟出手次数",
                      )}
                    >
                      {t("FGA / 36", "出手 / 36 分钟")}
                    </th>
                    <th
                      scope="col"
                      title={t(
                        "Free throw attempts per field goal attempt",
                        "罚球次数 / 投篮次数",
                      )}
                    >
                      FTr
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[anchor, peer].map((r, j) => (
                    <tr key={r.playerId}>
                      <th scope="row">
                        <i className={j ? "ap-id-peer" : "ap-id-anchor"} />
                        {r.name}
                      </th>
                      {baselineVolume(r).map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PeerProfile anchor={anchor} peer={peer} t={t} />
          </div>
          <div className="ap-follow">
            <EfficiencyChart
              anchor={anchor}
              path={path}
              outlook={outlook}
              step={index}
              onStep={onStep}
              t={t}
            />
            <ScoutingNote
              anchor={anchor}
              path={path}
              outlook={outlook}
              step={index}
              candidates={ranking.matches}
              careers={careers}
              onCompare={(id, nextStep) => {
                onPeer(id);
                onStep(nextStep);
              }}
              t={t}
            />
          </div>
          {index > 0 && (
            <MixDetails
              baseline={peer}
              current={path[index]}
              step={index}
              t={t}
            />
          )}
        </>
      ) : (
        <p className="ap-empty">
          {ranking.hasProfile
            ? t(
                `There are too few distinct earlier same-age profiles to calculate a comparison (${ranking.eligible} eligible). Select another age.`,
                `同龄历史样本不足或特征差异不足，无法计算匹配（${ranking.eligible} 人符合筛选）。可选择另一个年龄。`,
              )
            : t(
                "This season has limited volume or incomplete shooting, playing-time or free-throw data. Select a different age.",
                "该季出场时间、出手量或投篮、罚球资料不足，无法匹配。可选择另一个年龄。",
              )}
        </p>
      )}
      <details className="ap-details">
        <summary>
          {t("Matching method and historical backtest", "匹配方法与历史回测")}
        </summary>
        <p>
          {t(
            "Only earlier seasons at the same age enter the pool. Each season needs 500 minutes or 200 field goal attempts. Matching also requires complete five-zone shares, positive minutes and observed free throws. Short careers remain eligible, including players with no follow-up.",
            "只纳入赛季早于目标球员且同龄的样本。每季需至少上场 500 分钟或出手 200 次；匹配还需完整的五区占比、有效出场时间与罚球记录。短生涯和没有后续记录的球员也参与匹配。",
          )}
        </p>
        <p>
          {t(
            "We standardize five attempt shares, attempts per 36 minutes and free throws per field goal attempt (FTr) against eligible historical baselines. In weighted cosine similarity (−1 to +1), each zone has weight 1 and the two volume measures have weight 0.5 each. Constant features carry no weight. Higher scores indicate more similar profiles.",
            "用合格历史样本在起点赛季的均值与标准差，标准化五区出手占比、每 36 分钟出手及罚球率（FTr＝罚球次数 / 出手次数）。加权余弦相似度范围为 −1 至 +1；五区各占权重 1，两项投篮量指标各占 0.5，历史样本中无差异的指标不参与计算。分数越高，打法特征越接近。",
          )}
        </p>
        <p>
          {t(
            `The median uses the ten closest available matches, ranked without subsequent results. At each age, we include qualifying records observable by ${seasonLabel(anchor.season)}. Missing ages stay blank. Historical scenarios cannot establish what caused efficiency to change.`,
            `中位数取最相似的最多十人，排名仅使用起点数据。各年龄仅计入截至 ${seasonLabel(anchor.season)} 可观察的合格记录。缺失年龄留空；历史类比无法确定效率变化的原因。`,
          )}
        </p>
        <h3 className="ap-test-title">
          {t("How accurate were the historical estimates?", "历史类比有多准？")}
        </h3>
        <p>
          {t(
            `One starting season per player, the first qualifying season in ${seasonLabel(backtest.firstQuery)} through ${seasonLabel(backtest.lastQuery)}. All ${backtest.uniqueQueries} players aged ${backtest.minAge}–${backtest.maxAge} with at least 1,000 minutes and complete starting measurements entered. Each forecast used only information available that season. Later seasons through ${seasonLabel(backtest.lastOutcome)} supplied the observed outcomes.`,
            `在 ${seasonLabel(backtest.firstQuery)} 至 ${seasonLabel(backtest.lastQuery)} 逐人取首个合格赛季，共 ${backtest.uniqueQueries} 人，起点为 ${backtest.minAge}–${backtest.maxAge} 岁、至少 1,000 分钟且指标完整。每次预测仅用截至当季的数据，实际后续观察至 ${seasonLabel(backtest.lastOutcome)}。`,
          )}
        </p>
        <table className="ap-backtest">
          <thead>
            <tr>
              <th>{t("Horizon", "时距")}</th>
              <th>n</th>
              <th>{t("Peer MAE", "类比误差")}</th>
              <th>{t("Flat MAE", "持平误差")}</th>
              <th>{t("In range", "区间命中")}</th>
            </tr>
          </thead>
          <tbody>
            {backtest.horizons.map((h) => (
              <tr key={h.years}>
                <th scope="row">
                  +{h.years}
                  {t(" yr", " 年")}
                </th>
                <td>{h.scored}</td>
                <td>{h.peerMae.toFixed(2)}</td>
                <td>{h.persistenceMae.toFixed(2)}</td>
                <td>{h.coveragePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {t(
            "Mean absolute error (MAE) is measured in percentage points of rTS. Holding each player’s rTS at its starting value gave a lower error at all three horizons. The peers’ middle 50% range contained fewer than half of observed outcomes.",
            "表中误差为 rTS 的平均绝对误差，单位是百分点。三个时距内，直接沿用球员起点 rTS 的误差均较低。参照球员的中间 50% 区间覆盖了不足一半的实际结果。",
          )}
        </p>
        <p>
          {t(
            `At +1 / +3 / +5 years, ${backtest.horizons.map((h) => h.noQualifyingOutcome).join(" / ")} players had no qualifying outcome and a further ${backtest.horizons.map((h) => h.insufficientPeersWithOutcome).join(" / ")} had fewer than three usable peers. Both estimates were scored on the same remaining players at each horizon.`,
            `在第 1、3、5 年，分别有 ${backtest.horizons.map((h) => h.noQualifyingOutcome).join("、")} 人缺少合格后续，另有 ${backtest.horizons.map((h) => h.insufficientPeersWithOutcome).join("、")} 人的可用参照不足 3 名。两种估计在每个时距均使用同一批可评分球员。`,
          )}
        </p>
      </details>
    </section>
  );
}
