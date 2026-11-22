import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, RotateCcw } from "lucide-react";
import {
  fga36,
  percent,
  PLAYER_COLORS,
  seasonLabel,
  shortName,
} from "../lib/analysis";
import {
  CHANGE_THRESHOLD_PP,
  eligibleStyle,
  evidenceGroups,
  matchStyles,
  pathEvidence,
  pathObservation,
  pathValue,
  STYLE_MIN_FGA,
  type ObservationStatus,
  type PathMetric,
  type StyleMatch,
} from "../lib/style-paths";
import { detectCareerShifts } from "../lib/career-shifts";
import type { Dataset, Language, SeasonRow, Translate } from "../lib/types";
import useShotIndex from "../hooks/useShotIndex";
import PlayerPicker from "./PlayerPicker";
import PlayerPortrait from "./PlayerPortrait";
import CareerPathStacks from "./CareerPathStacks";
import LocationCourts, { type CourtComparisonSlot } from "./LocationCourts";
import { BAND_COLORS, bandNames } from "./TransitionCharts";
import "./career-paths.css";

type Selection = {
  player: string;
  season: number;
  peer: string;
  offset: number;
  zone: number | null;
  tolerance: number;
  sameRole: boolean;
  measure: "share" | "change";
};
const signed = (n: number | null, suffix = "") =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}${suffix}`;
const phaseName = (offset: number, t: Translate) =>
  offset === 0
    ? t("Reference season", "参考季")
    : offset > 0
      ? t(`Year +${offset}`, `之后第 ${offset} 年`)
      : t(`${Math.abs(offset)}y earlier`, `${Math.abs(offset)} 年前`);
function statusName(status: ObservationStatus, t: Translate) {
  return status === "outside"
    ? t("Not yet observed at reference date", "参考时点尚未发生")
    : status === "missing"
      ? t("No season record", "无赛季记录")
      : status === "sample"
        ? t("Under 200 attempts", "少于200次出手")
        : t("Recorded", "有记录");
}
function initialSelection(query: URLSearchParams): Selection {
  const number = (key: string, fallback: number) =>
    query.has(key) && Number.isInteger(Number(query.get(key)))
      ? Number(query.get(key))
      : fallback;
  const zone = query.has("zone") ? number("zone", -1) : -1;
  return {
    player: query.get("player") ?? "curryst01",
    season: number("ref", number("to", 2022)),
    peer: query.get("peer") ?? "",
    offset: Math.max(-40, Math.min(3, number("step", 0))),
    zone: zone >= 0 && zone <= 4 ? zone : null,
    tolerance: query.get("age") === "1" ? 1 : 0,
    sameRole: query.get("role") === "same",
    measure: query.get("profile") === "change" ? "change" : "share",
  };
}

export default function CareerPathExplorer({
  data,
  query,
}: {
  data: Dataset;
  query: URLSearchParams;
}) {
  const [selection, setSelection] = useState(() => initialSelection(query));
  const [lang, setLang] = useState<Language>(
    query.get("lang") === "en" ? "en" : "zh",
  );
  const [hoverOffset, setHoverOffset] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const t: Translate = (en, zh) => (lang === "en" ? en : zh);
  const careers = useMemo(() => {
    const map = new Map<string, SeasonRow[]>();
    for (const row of data.rows) {
      if (!map.has(row.playerId)) map.set(row.playerId, []);
      map.get(row.playerId)!.push(row);
    }
    for (const rows of map.values()) rows.sort((a, b) => a.season - b.season);
    return map;
  }, [data]);
  const players = useMemo(
    () => data.players.filter((p) => careers.get(p.id)?.some(eligibleStyle)),
    [data, careers],
  );
  const player =
    players.find((p) => p.id === selection.player) ??
    players.find((p) => p.id === "curryst01") ??
    players[0];
  const rows = careers.get(player?.id) ?? [];
  const eligible = rows.filter(eligibleStyle);
  const anchor =
    eligible.find((r) => r.season === selection.season) ?? eligible.at(-1);
  const ranking = useMemo(
    () =>
      anchor
        ? matchStyles(anchor, careers, {
            ageTolerance: selection.tolerance,
            sameRole: selection.sameRole,
          })
        : { count: 0, matches: [] },
    [anchor, careers, selection.tolerance, selection.sameRole],
  );
  const selected =
    ranking.matches.find((m) => m.baseline.playerId === selection.peer) ??
    ranking.matches[0];
  const activeOffset = hoverOffset ?? selection.offset;
  const band = selection.zone ?? 4;
  const names = bandNames(t);
  const shotIndex = useShotIndex();
  useEffect(() => {
    if (!anchor) return;
    const next = new URLSearchParams({
      view: "paths",
      player: anchor.playerId,
      ref: String(anchor.season),
      step: String(selection.offset),
      lang,
    });
    if (selected) next.set("peer", selected.baseline.playerId);
    if (selection.zone != null) next.set("zone", String(selection.zone));
    if (selection.tolerance) next.set("age", "1");
    if (selection.sameRole) next.set("role", "same");
    if (selection.measure === "change") next.set("profile", "change");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${next}${window.location.hash}`,
    );
    document.title = `Shot Atlas · ${anchor.name} · ${t("Career paths", "生涯转型")}`;
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [
    anchor,
    selected,
    selection.offset,
    selection.zone,
    selection.tolerance,
    selection.sameRole,
    selection.measure,
    lang,
  ]);
  if (!anchor)
    return (
      <main className="path-empty">
        {t(
          "No eligible reference seasons in this dataset.",
          "当前数据中没有符合条件的参考赛季。",
        )}
      </main>
    );
  function changePlayer(id: string) {
    const next = careers.get(id)?.filter(eligibleStyle).at(-1);
    if (next)
      setSelection((s) => ({
        ...s,
        player: id,
        season: next.season,
        peer: "",
        offset: 0,
      }));
    setHoverOffset(null);
  }
  function chooseSeason(season: number) {
    setSelection((s) => ({
      ...s,
      player: anchor!.playerId,
      season,
      peer: "",
      offset: 0,
    }));
    setHoverOffset(null);
  }
  function choosePeer(peer: string) {
    setSelection((s) => ({ ...s, peer }));
    setHoverOffset(null);
  }
  function choosePhase(offset: number) {
    setSelection((s) => ({ ...s, offset }));
    setHoverOffset(null);
  }
  function chooseBand(zone: number | null) {
    setSelection((s) => ({ ...s, zone }));
  }
  const evidenceOffset = activeOffset > 0 ? activeOffset : 1;
  function chooseCase(id: string) {
    setSelection((s) => ({ ...s, peer: id, offset: evidenceOffset }));
    setHoverOffset(null);
    document.getElementById("path-profile")?.scrollIntoView({ block: "start" });
  }
  const evidence = pathEvidence(
    anchor,
    ranking.matches,
    careers,
    evidenceOffset,
    band,
  );
  const validEvidence = evidence.filter((e) => e.included);
  const peers = selected ? [anchor, selected.baseline] : [anchor];
  const observations = peers.map((base) =>
    pathObservation(
      base,
      careers.get(base.playerId) ?? [],
      activeOffset,
      anchor.season,
    ),
  );
  const slots: CourtComparisonSlot[] = peers.map((base) => ({
    row: base,
    player: base,
    year: base.season,
    label: t("Reference", "参考季"),
  }));
  if (activeOffset > 0 && selected) {
    slots.push({
      row: observations[1].row,
      player: selected.baseline,
      year: observations[1].year,
      label: phaseName(activeOffset, t),
      message: statusName(observations[1].status, t),
    });
  } else if (activeOffset < 0) {
    peers.forEach((base, i) => {
      slots[i] = {
        row: observations[i].row,
        player: base,
        year: observations[i].year,
        label: phaseName(activeOffset, t),
        message: statusName(observations[i].status, t),
      };
    });
  }
  const shifts = detectCareerShifts(
    rows.filter((r) => r.season <= anchor.season),
  );
  return (
    <div className="path-app">
      <a className="skip-link" href="#path-main">
        {t("Skip to analysis", "跳至分析")}
      </a>
      <header className="path-topbar">
        <a className="path-brand" href="?player=curryst01&ref=2022&lang=zh">
          <img src="./ball.svg" alt="" />
          <b>SHOT ATLAS</b>
        </a>
        <span className="path-title">{t("Career paths", "生涯转型")}</span>
        <div className="path-header-actions">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={15} />
            {copied ? t("Copied", "已复制") : t("Share view", "复制当前视图")}
          </button>
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>
      <main id="path-main" className="path-main">
        <div className="path-context">
          <div className="path-anchor">
            <PlayerPortrait playerId={anchor.playerId} name={anchor.name} />
            <div>
              <span className="path-label">{t("Player", "当前球员")}</span>
              <PlayerPicker
                players={players}
                value={anchor.playerId}
                onChange={changePlayer}
                label={t("Choose player", "选择球员")}
                t={t}
              />
              <p>
                {anchor.position} · {anchor.age} {t("years old", "岁")} ·{" "}
                {anchor.team}
              </p>
            </div>
          </div>
          <label className="path-field">
            {t("Reference season", "参考赛季")}
            <select
              aria-label={t("Reference season", "参考赛季")}
              value={anchor.season}
              onChange={(e) => chooseSeason(+e.target.value)}
            >
              {[...eligible].reverse().map((r) => (
                <option key={r.id} value={r.season}>
                  {seasonLabel(r.season)} · {r.age}
                  {t(" yrs", "岁")}
                </option>
              ))}
            </select>
          </label>
          <div className="path-reference-stats">
            <span>
              {t("Attempts", "出手")}
              <b>{anchor.fga?.toLocaleString()}</b>
            </span>
            <span>
              {t("FGA / 36", "每36分钟出手")}
              <b>{fga36(anchor)?.toFixed(1)}</b>
            </span>
            <span>
              rTS<b>{signed(anchor.rts, " pp")}</b>
            </span>
          </div>
        </div>
        <nav
          className="path-nav"
          aria-label={t("Analysis sections", "分析顺序")}
        >
          <a href="#path-matches">{t("Historical peers", "历史相似球员")}</a>
          <a href="#path-profile">{t("Shooting profile", "投篮风格对照")}</a>
          <a href="#path-trends">{t("What changed", "后续变化")}</a>
          <a href="#path-reference">
            {t("Directions to consider", "转型参考")}
          </a>
          <span>
            {t("Observed through", "资料截至")} {seasonLabel(anchor.season)}
          </span>
        </nav>
        <div className="path-workspace">
          <aside id="path-matches" className="path-panel path-candidates">
            <div className="path-heading">
              <h2>{t("Historical peers", "历史相似球员")}</h2>
              <small>
                {ranking.matches.length} / {ranking.count}
              </small>
            </div>
            <div className="path-filters">
              <label>
                {t("Age", "年龄")}
                <select
                  aria-label={t("Age matching", "年龄匹配")}
                  value={selection.tolerance}
                  onChange={(e) =>
                    setSelection((s) => ({
                      ...s,
                      tolerance: +e.target.value,
                      peer: "",
                    }))
                  }
                >
                  <option value={0}>{t("Same age", "同龄")}</option>
                  <option value={1}>{t("Within 1 year", "相差1岁以内")}</option>
                </select>
              </label>
              <label>
                {t("Position", "位置")}
                <select
                  aria-label={t("Position filter", "位置筛选")}
                  value={selection.sameRole ? "same" : "all"}
                  onChange={(e) =>
                    setSelection((s) => ({
                      ...s,
                      sameRole: e.target.value === "same",
                      peer: "",
                    }))
                  }
                >
                  <option value="all">{t("All positions", "全部位置")}</option>
                  <option value="same">
                    {t("Same role group", "同类位置")}
                  </option>
                </select>
              </label>
            </div>
            <div className="path-candidate-list">
              {ranking.matches.map((match) => {
                const base = match.baseline;
                const usable = [1, 2, 3].filter(
                  (offset) =>
                    pathObservation(
                      base,
                      careers.get(base.playerId) ?? [],
                      offset,
                      anchor.season,
                    ).status === "available",
                ).length;
                return (
                  <button
                    key={base.playerId}
                    className={`path-candidate ${selected?.baseline.playerId === base.playerId ? "selected" : ""}`}
                    aria-pressed={selected?.baseline.playerId === base.playerId}
                    onClick={() => choosePeer(base.playerId)}
                  >
                    <PlayerPortrait playerId={base.playerId} name={base.name} />
                    <span>
                      <strong>{base.name}</strong>
                      <small>
                        {seasonLabel(base.season)} · {base.age}
                        {t(" yrs", "岁")} · {base.position}
                      </small>
                      <small>
                        {t("Follow-up", "后续样本")} {usable}/3{" "}
                        {t("seasons ≥200 FGA", "季≥200次")}
                      </small>
                    </span>
                    <b>
                      {match.similarity.score.toFixed(1)}
                      <small>{t("similarity", "相似度")}</small>
                    </b>
                  </button>
                );
              })}
            </div>
            {!selected && (
              <p className="path-empty">
                {t(
                  "No earlier player meets these filters. Try a later reference season or adjust the filters.",
                  "暂无更早且符合筛选的球员，可换一个参考赛季或调整筛选。",
                )}
              </p>
            )}
            <details className="path-details">
              <summary>
                {t("How are peers matched?", "为什么是这些球员？")}
              </summary>
              <p>
                {t(
                  "Only the reference season is scored: 80% five-zone shot mix + 20% attempts per 36 minutes. Historical seasons must be earlier than the selected reference date, with at least 200 attempts. One season per player; the top eight are shown.",
                  "只比较参考季：五区出手分布占80%，每36分钟出手量占20%。历史赛季须早于所选参考季，且至少有200次出手。每人保留一个最相似赛季，展示前8名。",
                )}
              </p>
              <p>
                {t(
                  "Mix compares normalized shares. Volume compares the smaller and larger rates. Weights are design choices. Later outcomes do not affect ranking, and missing follow-up does not remove a peer. Position groups are guards, forwards and centers.",
                  "分布比较校正舍入后的占比，出手量比较两人的比值。权重是本项目的设计选择；后续表现不参与评分，也不因缺少后续记录排除案例。位置分为后卫、前锋和中锋。",
                )}
              </p>
              {selected && (
                <div className="path-score-parts">
                  <span>
                    {t("Shot mix", "投篮分布")}
                    <b>{(selected.similarity.mix * 100).toFixed(1)}/100</b>
                  </span>
                  <span>
                    {t("Shot volume", "出手量")}
                    <b>{(selected.similarity.volume * 100).toFixed(1)}/100</b>
                  </span>
                </div>
              )}
              <p>
                {t(
                  "This compares shooting style, not defense, playmaking, or probability of future success. Cross-era differences remain.",
                  "这里比较投篮风格，不代表防守、组织能力或未来成功概率；年代差异仍然存在。",
                )}
              </p>
            </details>
          </aside>
          <div className="path-analysis">
            <div className="path-linked-toolbar">
              <div className="path-player-key">
                <span style={{ color: PLAYER_COLORS[0] }}>
                  <PlayerPortrait
                    playerId={anchor.playerId}
                    name={anchor.name}
                  />{" "}
                  {shortName(anchor.name)}
                </span>
                {selected && (
                  <span style={{ color: PLAYER_COLORS[1] }}>
                    <PlayerPortrait
                      playerId={selected.baseline.playerId}
                      name={selected.baseline.name}
                    />{" "}
                    {shortName(selected.baseline.name)}
                  </span>
                )}
              </div>
              <div
                className="path-phase"
                role="group"
                aria-label={t("Comparison stage", "比较阶段")}
              >
                {[0, 1, 2, 3].map((offset) => (
                  <button
                    key={offset}
                    aria-pressed={selection.offset === offset}
                    className={activeOffset === offset ? "active" : ""}
                    onClick={() => choosePhase(offset)}
                  >
                    {phaseName(offset, t)}
                  </button>
                ))}
              </div>
              <label className="path-zone">
                {t("Zone", "区域")}
                <select
                  aria-label={t("Shot region", "投篮区域")}
                  value={selection.zone ?? "all"}
                  onChange={(e) =>
                    chooseBand(
                      e.target.value === "all" ? null : +e.target.value,
                    )
                  }
                >
                  <option value="all">{t("All zones", "全部分区")}</option>
                  {names.map((name, i) => (
                    <option value={i} key={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="path-reset"
                aria-label={t("Reset stage and region", "重置阶段与区域")}
                onClick={() => {
                  setSelection((s) => ({ ...s, offset: 0, zone: null }));
                  setHoverOffset(null);
                }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <CareerPathStacks
              key={`${anchor.id}:${selected?.baseline.id}`}
              anchor={anchor}
              match={selected}
              careers={careers}
              offset={activeOffset}
              earliestOffset={Math.min(-3, selection.offset)}
              zone={selection.zone}
              onSelect={choosePhase}
              onZone={chooseBand}
              t={t}
            />
            <div className="path-comparison-grid">
              <ShotProfile
                measure={selection.measure}
                onMeasure={(measure) =>
                  setSelection((s) => ({ ...s, measure }))
                }
                anchor={anchor}
                match={selected}
                careers={careers}
                offset={activeOffset}
                zone={selection.zone}
                onZone={chooseBand}
                t={t}
              />
              <div className="path-court-panel">
                <LocationCourts
                  selected={peers}
                  comparisonSlots={slots}
                  initialMode="frequency"
                  twinMatrix
                  index={shotIndex.shotIndex}
                  indexError={shotIndex.indexError}
                  onRetryIndex={shotIndex.retryIndex}
                  zone={selection.zone}
                  hoverZone={null}
                  onClearZone={() => chooseBand(null)}
                  focus={null}
                  t={t}
                />
              </div>
            </div>
            <section id="path-trends" className="path-panel path-trends">
              <div className="path-heading">
                <h2>{t("What changed with age", "后续变化")}</h2>
                <span>
                  {t(
                    "Same stage · actual observations only",
                    "同阶段对齐 · 仅显示实测记录",
                  )}
                </span>
              </div>
              <div className="path-trend-grid">
                {(["share", "rts", "points"] as const).map((metric) => (
                  <PathTrend
                    key={metric}
                    metric={metric}
                    band={band}
                    anchor={anchor}
                    match={selected}
                    careers={careers}
                    offset={activeOffset}
                    earliestOffset={Math.min(-3, selection.offset)}
                    onPreview={setHoverOffset}
                    onSelect={choosePhase}
                    t={t}
                  />
                ))}
              </div>
              <p className="path-footnote">
                {t(
                  "X: years from reference. Gaps: missing records. Hollow points: under 200 attempts.",
                  "横轴：距参考季年数。断线：缺失；空心点：少于200次出手。",
                )}
              </p>
            </section>
          </div>
        </div>
        <section id="path-reference" className="path-panel path-evidence">
          <div className="path-heading">
            <div>
              <h2>{t("Directions to consider", "转型参考")}</h2>
              <p>
                {names[band]} · {phaseName(evidenceOffset, t)} ·{" "}
                {validEvidence.length}/{evidence.length}{" "}
                {t("peers with an eligible observation", "个案例样本足够")}
              </p>
            </div>
            <label className="path-zone">
              {t("Follow-up", "后续")}
              <select
                aria-label={t("Evidence horizon", "历史案例观察年限")}
                value={evidenceOffset}
                onChange={(e) => choosePhase(+e.target.value)}
              >
                {[1, 2, 3].map((year) => (
                  <option key={year} value={year}>
                    {phaseName(year, t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {validEvidence.length ? (
            <div className="path-direction-grid">
              {evidenceGroups(evidence).map((group) => (
                <div className="path-direction" key={group.direction}>
                  <h3>
                    {group.direction === "up"
                      ? t("More", "增加")
                      : group.direction === "down"
                        ? t("Less", "减少")
                        : t("Little change in", "基本维持")}{" "}
                    {names[band]}
                    <b>
                      {group.count}
                      <small>{t(" peers", "例")}</small>
                    </b>
                  </h3>
                  <div className="path-direction-stats">
                    <span>
                      {t("Median ΔrTS", "效率变化中位数")}
                      <strong>{signed(group.rts, " pp")}</strong>
                      <small>n={group.rtsN}</small>
                    </span>
                    <span>
                      {t("Median ΔPTS/36", "每36分钟得分变化")}
                      <strong>{signed(group.points)}</strong>
                      <small>n={group.pointsN}</small>
                    </span>
                  </div>
                  <div className="path-case-links">
                    {group.cases.map((item) => (
                      <button
                        key={item.baseline.id}
                        aria-pressed={
                          selected?.baseline.playerId === item.baseline.playerId
                        }
                        onClick={() => chooseCase(item.baseline.playerId)}
                      >
                        {shortName(item.baseline.name)}
                      </button>
                    ))}
                    {!group.count && (
                      <span>{t("No eligible cases", "暂无合格案例")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="path-empty">
              {t(
                "No historical observations meet the sample threshold at this stage.",
                "这个阶段没有达到样本量要求的历史记录。",
              )}
            </p>
          )}
          <p className="path-footnote">
            {t(
              `Changes are from each peer's reference season; within ±${CHANGE_THRESHOLD_PP} pp counts as little change. Small samples and missing values are excluded. These historical outcomes are not a forecast.`,
              `与各自参考季比较；±${CHANGE_THRESHOLD_PP}个百分点以内记为基本维持。小样本和缺失值不计入汇总。历史结果不代表未来预测。`,
            )}
          </p>
          <EvidenceTable
            evidence={evidence}
            selected={selected}
            offset={evidenceOffset}
            onSelect={chooseCase}
            t={t}
          />
        </section>
        <details className="path-panel path-history">
          <summary>
            {t("Career before the reference season", "参考季之前的生涯")}
          </summary>
          <div className="path-history-bars">
            {rows
              .filter((r) => r.season <= anchor.season)
              .map((r) => (
                <button
                  key={r.id}
                  disabled={!eligibleStyle(r)}
                  aria-pressed={r.id === anchor.id}
                  onClick={() => chooseSeason(r.season)}
                  title={`${seasonLabel(r.season)} · ${r.age}${t(" years old", "岁")}`}
                >
                  <span className="path-history-stack">
                    {r.shares.map((value, i) => (
                      <i
                        key={i}
                        style={{
                          height: percent(value ?? 0),
                          background: BAND_COLORS[i],
                          opacity:
                            selection.zone == null || selection.zone === i
                              ? 1
                              : 0.2,
                        }}
                      />
                    ))}
                  </span>
                  <span>{String(r.season).slice(-2)}</span>
                </button>
              ))}
          </div>
          {!!shifts.shifts.length && (
            <div className="path-history-shifts">
              <span>{t("Larger past shifts", "此前较大的投篮变化")}</span>
              {shifts.shifts.map((shift) => (
                <button
                  key={shift.first.id}
                  onClick={() => chooseSeason(shift.last.season)}
                >
                  {seasonLabel(shift.first.season)} →{" "}
                  {seasonLabel(shift.last.season)} · {names[shift.driver]}
                </button>
              ))}
            </div>
          )}
        </details>
        <footer className="path-footer">
          <span>26fall 6411D GOAT · NBA {t("regular season", "常规赛")}</span>
          <details>
            <summary>{t("Data and definitions", "数据与指标")}</summary>
            <p>
              {t("Season statistics", "赛季统计")}：
              {seasonLabel(data.metadata.firstSeason)}—
              {seasonLabel(data.metadata.lastSeason)} · Basketball-Reference.{" "}
              {t("Shot coordinates", "逐球坐标")}：2003–04—2024–25 · NBA.com.
            </p>
            <p>
              {t(
                "rTS is true shooting percentage minus that season's league average, in percentage points. Points per 36 minutes = points × 36 / minutes. Missing locations are never synthesized. Follow-up uses only data available by the selected reference season.",
                "rTS为真实命中率减去当季联盟均值，单位为百分点；每36分钟得分=总得分×36÷上场分钟数。缺失坐标不补点。后续追踪仅使用所选参考赛季之前已发生的记录。",
              )}
            </p>
            {data.metadata.sources.map((source) => (
              <a
                key={source.file}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.file}
              </a>
            ))}
          </details>
        </footer>
      </main>
    </div>
  );
}

function ShotProfile({
  measure,
  onMeasure,
  anchor,
  match,
  careers,
  offset,
  zone,
  onZone,
  t,
}: {
  measure: "share" | "change";
  onMeasure: (measure: "share" | "change") => void;
  anchor: SeasonRow;
  match?: StyleMatch;
  careers: Map<string, SeasonRow[]>;
  offset: number;
  zone: number | null;
  onZone: (zone: number | null) => void;
  t: Translate;
}) {
  const bases = match ? [anchor, match.baseline] : [anchor];
  const current = bases.map((base) =>
    pathObservation(
      base,
      careers.get(base.playerId) ?? [],
      offset,
      anchor.season,
    ),
  );
  const values = bases.map((base, side) =>
    base.shares.map((value, i) => {
      const now = current[side].row?.shares[i];
      return now == null
        ? null
        : measure === "share"
          ? now * 100
          : value == null
            ? null
            : (now - value) * 100;
    }),
  );
  const extent =
    measure === "share"
      ? 100
      : Math.max(
          10,
          Math.ceil(
            Math.max(...values.flat().map((v) => Math.abs(v ?? 0))) / 5,
          ) * 5,
        );
  const names = bandNames(t);
  const differences = anchor.shares.map((v, i) =>
    v == null || match?.baseline.shares[i] == null
      ? null
      : Math.abs(v - match.baseline.shares[i]!),
  );
  const biggest = differences.reduce<number>(
    (best, v, i) => ((v ?? -1) > (differences[best] ?? -1) ? i : best),
    0,
  );
  return (
    <section id="path-profile" className="path-panel path-profile">
      <div className="path-heading">
        <h2>{t("Shooting profile", "投篮风格对照")}</h2>
        <select
          aria-label={t("Profile measure", "分布图指标")}
          value={measure}
          onChange={(e) => onMeasure(e.target.value as "share" | "change")}
        >
          <option value="share">{t("Attempt share", "出手占比")}</option>
          <option value="change">
            {t("Change from reference", "较参考季变化")}
          </option>
        </select>
      </div>
      <div className="path-profile-dates">
        {bases.map((base, i) => (
          <span key={base.id} style={{ color: PLAYER_COLORS[i] }}>
            {shortName(base.name)} · {seasonLabel(current[i].year)}
            <small>
              {current[i].row?.age ?? base.age! + offset}
              {t(" yrs", "岁")}
              {current[i].status === "sample"
                ? ` · ${t("small sample", "小样本")}`
                : ""}
            </small>
          </span>
        ))}
      </div>
      <div className="path-bar-axis">
        <span>{measure === "share" ? "0" : `−${extent}`}</span>
        <span>{measure === "share" ? "50" : "0"}</span>
        <span>
          {extent}
          {measure === "share" ? "%" : " pp"}
        </span>
      </div>
      <div className="path-bars">
        {names.map((name, i) => (
          <button
            key={name}
            className={`path-bar-row ${zone === i ? "selected" : ""} ${zone != null && zone !== i ? "dimmed" : ""}`}
            aria-pressed={zone === i}
            onClick={() => onZone(zone === i ? null : i)}
          >
            <span className="path-bar-name">{name}</span>
            <span className="path-bar-pair">
              {bases.map((base, side) => {
                const v = values[side][i];
                return (
                  <span
                    className={`path-bar-track ${current[side].status === "sample" ? "small-sample" : ""}`}
                    key={base.id}
                    style={{ color: PLAYER_COLORS[side] }}
                  >
                    <i
                      className="path-bar-zero"
                      style={{ left: measure === "share" ? "0%" : "50%" }}
                    />
                    {v != null && (
                      <i
                        className="path-bar-fill"
                        style={{
                          left:
                            measure === "share"
                              ? "0%"
                              : `${50 + (Math.min(0, v) / extent) * 50}%`,
                          width: `${(Math.abs(v) / extent) * (measure === "share" ? 100 : 50)}%`,
                          background: PLAYER_COLORS[side],
                        }}
                      />
                    )}
                    {measure === "share" && offset > 0 && (
                      <i
                        className="path-baseline-tick"
                        style={{ left: percent(base.shares[i]) }}
                      />
                    )}
                    <span className="path-bar-value">
                      {v == null
                        ? "—"
                        : measure === "share"
                          ? `${v.toFixed(1)}%`
                          : signed(v)}
                    </span>
                  </span>
                );
              })}
            </span>
          </button>
        ))}
      </div>
      <p className="path-footnote">
        {phaseName(offset, t)}
        {offset > 0
          ? ` · ${measure === "share" ? t("Thin marks: reference shares. ", "细线：参考季占比。") : ""}${t("Current player's later seasons are not yet observed.", "当前球员后续在参考时点尚未发生。")}`
          : match && offset === 0
            ? ` · ${t("Largest starting difference", "起点差异最大")}：${names[biggest]} ${(differences[biggest]! * 100).toFixed(1)} pp`
            : ""}
      </p>
    </section>
  );
}

function PathTrend({
  anchor,
  match,
  careers,
  metric,
  band,
  offset,
  earliestOffset,
  onPreview,
  onSelect,
  t,
}: {
  anchor: SeasonRow;
  match?: StyleMatch;
  careers: Map<string, SeasonRow[]>;
  metric: PathMetric;
  band: number;
  offset: number;
  earliestOffset: number;
  onPreview: (offset: number | null) => void;
  onSelect: (offset: number) => void;
  t: Translate;
}) {
  const offsets = Array.from(
    { length: 4 - earliestOffset },
    (_, i) => earliestOffset + i,
  );
  const bases = match ? [anchor, match.baseline] : [anchor];
  const observations = bases.map((base) =>
    offsets.map((o) =>
      pathObservation(base, careers.get(base.playerId) ?? [], o, anchor.season),
    ),
  );
  const series = observations.map((line) =>
    line.map((o) => pathValue(o.row, metric, band)),
  );
  const allValues = series.flat().filter((n): n is number => n != null);
  let lo = metric === "rts" ? Math.floor(Math.min(0, ...allValues) / 5) * 5 : 0;
  let hi =
    metric === "share"
      ? 100
      : Math.ceil(Math.max(metric === "rts" ? 5 : 10, ...allValues) / 5) * 5;
  if (hi === lo) hi = lo + 5;
  const left = 38,
    right = 306,
    top = 18,
    bottom = 142;
  const x = (o: number) =>
      left + ((o - earliestOffset) / (3 - earliestOffset)) * (right - left),
    y = (n: number) => bottom - ((n - lo) / (hi - lo)) * (bottom - top);
  const title =
    metric === "share"
      ? `${bandNames(t)[band]} · ${t("attempt share", "出手占比")}`
      : metric === "rts"
        ? t("Efficiency · rTS", "得分效率 · rTS")
        : t("Production · points / 36", "得分产量 · 每36分钟");
  const format = (v: number | null) =>
    v == null
      ? "—"
      : metric === "share"
        ? `${v.toFixed(1)}%`
        : metric === "rts"
          ? signed(v, " pp")
          : v.toFixed(1);
  return (
    <figure className="path-trend">
      <figcaption>{title}</figcaption>
      <svg
        viewBox="0 0 322 178"
        role="group"
        aria-label={title}
        onMouseLeave={() => onPreview(null)}
      >
        <rect
          x={x(0)}
          y={top}
          width={right - x(0)}
          height={bottom - top}
          fill="var(--path-future)"
        />
        {[...new Set([lo, metric === "rts" ? 0 : (lo + hi) / 2, hi])].map(
          (v) => (
            <g key={v}>
              <line
                x1={left}
                x2={right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeDasharray="2 4"
              />
              <text x={left - 7} y={y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ),
        )}
        <line
          x1={x(0)}
          x2={x(0)}
          y1={top}
          y2={bottom}
          stroke="var(--muted)"
          strokeDasharray="4 4"
        />
        <line
          x1={x(offset)}
          x2={x(offset)}
          y1={top}
          y2={bottom}
          stroke="var(--ink)"
          opacity=".6"
        />
        {series.map((line, side) => (
          <g key={side} stroke={PLAYER_COLORS[side]}>
            <path
              fill="none"
              strokeWidth={2.5}
              strokeDasharray={side ? "6 3" : undefined}
              d={line
                .map((value, i) =>
                  value == null || observations[side][i].status === "sample"
                    ? ""
                    : `${i === 0 || line[i - 1] == null || observations[side][i - 1].status === "sample" ? "M" : "L"}${x(offsets[i])},${y(value)}`,
                )
                .join(" ")}
            />
            {line.map((value, i) =>
              value == null ? null : (
                <circle
                  key={i}
                  cx={x(offsets[i])}
                  cy={y(value)}
                  r={offsets[i] === offset ? 4.5 : 3}
                  strokeWidth={1.6}
                  fill={
                    observations[side][i].status === "sample"
                      ? "var(--panel)"
                      : PLAYER_COLORS[side]
                  }
                >
                  <title>
                    {bases[side].name} ·{" "}
                    {seasonLabel(observations[side][i].year)} · {format(value)}{" "}
                    · {observations[side][i].row?.fga} FGA
                  </title>
                </circle>
              ),
            )}
          </g>
        ))}
        {offsets.map((o) => (
          <g key={o}>
            <text x={x(o)} y={166} textAnchor="middle">
              {o === 0
                ? t("Ref", "参考")
                : o === 3 || o % Math.ceil(offsets.length / 7) === 0
                  ? o > 0
                    ? `+${o}`
                    : o
                  : ""}
            </text>
            {
              <rect
                x={
                  x(o) - Math.min(19, (right - left) / (offsets.length - 1) / 2)
                }
                y={top}
                width={Math.min(38, (right - left) / (offsets.length - 1))}
                height={bottom - top + 29}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${title} · ${phaseName(o, t)}`}
                aria-pressed={offset === o}
                onMouseEnter={() => onPreview(o)}
                onFocus={() => onPreview(o)}
                onBlur={() => onPreview(null)}
                onClick={() => onSelect(o)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(o);
                  }
                }}
              />
            }
          </g>
        ))}
      </svg>
      <div className="path-trend-values">
        {bases.map((base, side) => {
          const obs = pathObservation(
            base,
            careers.get(base.playerId) ?? [],
            offset,
            anchor.season,
          );
          return (
            <span key={base.id} style={{ color: PLAYER_COLORS[side] }}>
              <span>
                {shortName(base.name)}
                <small>
                  {seasonLabel(obs.year)} · {base.age! + offset}
                  {t(" yrs", "岁")}
                </small>
              </span>
              <b>
                {format(pathValue(obs.row, metric, band))}
                <small>
                  {obs.status !== "available"
                    ? statusName(obs.status, t)
                    : `${obs.row!.fga} ${t("FGA", "次出手")}`}
                </small>
              </b>
            </span>
          );
        })}
      </div>
    </figure>
  );
}

function EvidenceTable({
  evidence,
  selected,
  offset,
  onSelect,
  t,
}: {
  evidence: ReturnType<typeof pathEvidence>;
  selected?: StyleMatch;
  offset: number;
  onSelect: (id: string) => void;
  t: Translate;
}) {
  const extent = Math.max(
    10,
    Math.ceil(Math.max(...evidence.map((e) => Math.abs(e.share ?? 0))) / 10) *
      10,
  );
  return (
    <div className="path-evidence-scroll">
      <table className="path-evidence-table">
        <caption>
          {t(
            "All ranked peers, including incomplete records",
            "全部候选，包括后续记录不足的案例",
          )}
        </caption>
        <thead>
          <tr>
            <th>{t("Historical player", "历史球员")}</th>
            <th>{t(`Year +${offset}`, `之后第${offset}年`)}</th>
            <th>{t("Change in shot share", "出手占比变化")} · pp</th>
            <th>ΔrTS · pp</th>
            <th>{t("ΔPoints / 36", "每36分钟得分变化")}</th>
            <th>{t("Sample", "样本")}</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((item) => (
            <tr
              key={item.baseline.id}
              className={
                selected?.baseline.playerId === item.baseline.playerId
                  ? "selected"
                  : ""
              }
            >
              <th>
                <button onClick={() => onSelect(item.baseline.playerId)}>
                  {item.baseline.name}
                </button>
                <small>
                  {seasonLabel(item.baseline.season)} · {item.baseline.age}
                  {t(" yrs", "岁")}
                </small>
              </th>
              <td>{seasonLabel(item.observation.year)}</td>
              <td>
                <div className="path-difference">
                  <span className="path-dot-track">
                    <i className="zero" />
                    {item.share != null && (
                      <i
                        className={`dot ${item.included ? "" : "hollow"}`}
                        style={{ left: `${50 + (item.share / extent) * 45}%` }}
                      />
                    )}
                  </span>
                  <b>{signed(item.share)}</b>
                </div>
              </td>
              <td>{signed(item.rts)}</td>
              <td>{signed(item.points)}</td>
              <td>
                {item.observation.row?.fga != null && (
                  <b>
                    {item.observation.row.fga} {t("FGA", "次")}
                  </b>
                )}
                <small>{statusName(item.observation.status, t)}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
