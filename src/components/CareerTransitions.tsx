import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Globe2,
  ListFilter,
  Activity,
} from "lucide-react";
import {
  percent,
  pp,
  seasonLabel,
  shortName,
  PLAYER_COLORS,
} from "../lib/analysis";
import {
  completeProfile,
  TRANSITION_CASES,
  zoneChanges,
} from "../lib/transitions";
import type { Dataset, Language, SeasonRow, Translate } from "../lib/types";
import useShotIndex from "../hooks/useShotIndex";
import { pairedFollowup } from "../lib/paired-career";
import { matchTransitions } from "../lib/transition-matches";
import ComparisonTakeaway from "./ComparisonTakeaway";
import { thirdSeasonReference } from "../lib/comparison-takeaways";
import TransitionMatches from "./TransitionMatches";
import CareerShifts from "./CareerShifts";
import {
  detectCareerShifts,
  initialSeasons,
  type CareerShift,
} from "../lib/career-shifts";
import PairedCareerCharts from "./PairedCareerCharts";
import { SeasonComparisonTable } from "./SeasonComparisonTable";
import "./paired-career.css";
import PlayerPortrait from "./PlayerPortrait";
import PlayerPicker from "./PlayerPicker";
import LocationCourts from "./LocationCourts";
import {
  BAND_COLORS,
  bandNames,
  DietHistory,
  EfficiencyHistory,
} from "./TransitionCharts";
import "./career-transitions.css";

export default function CareerTransitions({
  data,
  query,
}: {
  data: Dataset;
  query: URLSearchParams;
}) {
  const careers = useMemo(() => {
    const groups = new Map<string, SeasonRow[]>();
    for (const r of data.rows) {
      const group = groups.get(r.playerId);
      if (group) group.push(r);
      else groups.set(r.playerId, [r]);
    }
    for (const group of groups.values())
      group.sort((a, b) => a.season - b.season);
    return groups;
  }, [data]);
  const players = useMemo(
    () => data.players.filter((p) => (careers.get(p.id)?.length ?? 0) > 1),
    [data, careers],
  );
  const [language, setLanguage] = useState<Language>(
    query.get("lang") === "en" ? "en" : "zh",
  );
  const t: Translate = (en, zh) => (language === "zh" ? zh : en);
  const [requestedSelection, setSelection] = useState<{
    player: string;
    from?: number;
    to?: number;
  } | null>(() => {
    const requested = query.get("player");
    const player =
      players.find((p) => p.id === requested)?.id ??
      players.find((p) => p.id === TRANSITION_CASES[0].player)?.id ??
      players[0]?.id;
    if (!player) return null;
    return {
      player,
      from: Number(query.get("from")),
      to: Number(query.get("to")),
    };
  });
  const [zone, setZone] = useState<number | null>(() =>
    query.has("band") && /^[0-4]$/.test(query.get("band")!)
      ? Number(query.get("band"))
      : null,
  );
  const { shotIndex, indexError, retryIndex } = useShotIndex();
  const rows = requestedSelection
    ? careers.get(requestedSelection.player)!
    : [];
  const detected = useMemo(() => detectCareerShifts(rows), [rows]);
  const strongest = detected.shifts[0];
  const selection = useMemo(
    () =>
      requestedSelection && {
        player: requestedSelection.player,
        ...initialSeasons(
          rows,
          strongest,
          requestedSelection.from,
          requestedSelection.to,
        ),
      },
    [rows, strongest, requestedSelection],
  );
  const [editingSeasons, setEditingSeasons] = useState(false);
  const pair = useMemo(
    () =>
      rows.filter(
        (r) => r.season === selection?.from || r.season === selection?.to,
      ),
    [rows, selection],
  );
  const ranking = useMemo(
    () =>
      pair.length === 2 ? matchTransitions(pair[0], pair[1], careers) : null,
    [pair, careers],
  );
  const [peer, setPeer] = useState(() =>
    requestedSelection?.from === selection?.from &&
    requestedSelection?.to === selection?.to
      ? query.get("peer")
      : null,
  );
  const selectedMatch =
    ranking?.matches.find((m) => m.b.playerId === peer) ?? ranking?.matches[0];
  const matrix = useMemo(
    () =>
      selectedMatch
        ? [pair[0], selectedMatch.a, pair[1], selectedMatch.b]
        : pair,
    [pair, selectedMatch],
  );
  const followup = useMemo(
    () =>
      selectedMatch
        ? pairedFollowup(
            pair[1],
            rows,
            selectedMatch.b,
            careers.get(selectedMatch.b.playerId)!,
            data.metadata.lastSeason,
          )
        : [],
    [pair, rows, selectedMatch, careers, data.metadata.lastSeason],
  );
  useEffect(() => {
    if (!selection) return;
    const params = new URLSearchParams({
      player: selection.player,
      from: String(selection.from),
      to: String(selection.to),
      lang: language,
    });
    if (zone != null) params.set("band", String(zone));
    if (selectedMatch && selectedMatch !== ranking?.matches[0])
      params.set("peer", selectedMatch.b.playerId);
    window.history.replaceState(
      {},
      "",
      window.location.pathname + "?" + params,
    );
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title =
      "Shot Atlas · " +
      careers.get(selection.player)![0].name +
      " · " +
      (language === "zh" ? "生涯转型" : "Career transitions");
  }, [selection, language, zone, careers, ranking, selectedMatch]);
  if (!selection || !ranking || pair.length !== 2)
    return (
      <p>
        {t(
          "Two recorded seasons are needed for this view.",
          "至少需要两个有记录赛季才能进行比较。",
        )}
      </p>
    );
  const [a, b] = pair;
  const viewingStrongest =
    a.id === strongest?.first.id && b.id === strongest?.last.id;
  const names = bandNames(t),
    changes = zoneChanges(a, b);
  const dominant = changes.reduce<number>(
    (best, n, i) =>
      Math.abs(n ?? 0) > Math.abs(changes[best] ?? 0) ? i : best,
    0,
  );
  const band = zone ?? dominant;
  const comparisons = selectedMatch
    ? [
        [a, b],
        [selectedMatch.a, selectedMatch.b],
      ]
    : [[a, b]];
  function pickPlayer(player: string) {
    setPeer(null);
    setSelection({ player });
    setEditingSeasons(false);
    setZone(null);
  }
  function pickShift({ first, last }: CareerShift) {
    setPeer(null);
    setEditingSeasons(false);
    setSelection({
      player: first.playerId,
      from: first.season,
      to: last.season,
    });
  }
  function pickColumn(row: SeasonRow) {
    setPeer(null);
    const i = rows.indexOf(row),
      end = Math.max(1, i);
    setSelection({
      player: row.playerId,
      from: rows[end - 1].season,
      to: rows[end].season,
    });
  }
  function summary(direction: "gain" | "loss", a: SeasonRow, b: SeasonRow) {
    const complete = completeProfile(a) && completeProfile(b);
    const ordered = zoneChanges(a, b)
      .flatMap((delta, i) => (delta == null ? [] : [{ delta, i }]))
      .sort((x, y) => x.delta - y.delta);
    const gain = ordered.at(-1),
      loss = ordered[0];
    const entry = direction === "gain" ? gain : loss;
    const valid =
      complete &&
      entry &&
      (direction === "gain" ? entry.delta > 0 : entry.delta < 0);
    const Icon = direction === "gain" ? ArrowUpRight : ArrowDownRight;
    return (
      <div className="ct-stat">
        <div className="ct-stat-label">
          <Icon size={16} />
          {direction === "gain"
            ? t("Largest share gain", "出手占比增幅最大")
            : t("Largest share decline", "出手占比降幅最大")}
        </div>
        <div className="ct-stat-value">
          {valid ? pp(entry.delta).split(" ")[0] : "—"}
          {valid && <small>pp</small>}
        </div>
        <div className="ct-stat-context">
          {valid ? (
            <>
              <b>{names[entry.i]}</b>
              <span>
                {percent(a.shares[entry.i])} → {percent(b.shares[entry.i])}
              </span>
            </>
          ) : complete ? (
            t("No shift in this direction", "该方向无变化")
          ) : (
            t("Incomplete zone profile", "五区记录不完整")
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="ct-page">
      <a className="skip-link" href="#career-main">
        {t("Skip to charts", "跳至图表")}
      </a>
      <header className="ct-nav">
        <div>
          <a
            className="brand"
            href={"?lang=" + language}
            aria-label="Shot Atlas"
          >
            <img src="./ball.svg" alt="" />
            <span>
              SHOT<span className="brand-light">ATLAS</span>
            </span>
          </a>
          <span className="ct-section-title">
            {t("Career transitions", "生涯转型")}
          </span>
          <button
            className="ct-language"
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label={t("Switch to Chinese", "Switch to English")}
          >
            <Globe2 size={15} />
            {language === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>
      <main id="career-main" className="ct-main">
        <div className="ct-casebar">
          <span>{t("Explore an example", "从示例开始")}</span>
          {TRANSITION_CASES.filter((sample) =>
            players.some((p) => p.id === sample.player),
          ).map((sample) => (
            <button
              key={sample.player}
              aria-pressed={
                selection.player === sample.player && viewingStrongest
              }
              onClick={() => pickPlayer(sample.player)}
            >
              {t(sample.en, sample.zh)}
            </button>
          ))}
        </div>
        <div className="ct-identity">
          <div className="ct-player">
            <PlayerPortrait playerId={a.playerId} name={a.name} />
            <div>
              <h1 className="ct-sr">
                {a.name}
                {selectedMatch && " / " + selectedMatch.b.name} ·{" "}
                {t("Career transitions", "生涯转型")}
              </h1>
              <PlayerPicker
                players={players}
                value={a.playerId}
                onChange={pickPlayer}
                label={t("Choose a multi-season player", "搜索多赛季球员")}
                t={t}
              />
              <p>
                {a.position}
                {b.position !== a.position ? " → " + b.position : ""}
                <i /> {seasonLabel(rows[0].season)} —{" "}
                {seasonLabel(rows[rows.length - 1].season)}
                <i />
                {rows.length} {t("recorded seasons", "个有记录赛季")}
              </p>
            </div>
          </div>
          {selectedMatch && (
            <div className="pc-peer-identity">
              <span className="pc-versus">vs</span>
              <PlayerPortrait
                playerId={selectedMatch.b.playerId}
                name={selectedMatch.b.name}
              />
              <div>
                <small>{t("Historical twin", "历史匹配球员")}</small>
                <strong>{selectedMatch.b.name}</strong>
                <p>
                  {selectedMatch.b.position} ·{" "}
                  {seasonLabel(selectedMatch.a.season)} →{" "}
                  {seasonLabel(selectedMatch.b.season)} ·{" "}
                  {(selectedMatch.b.teams ?? [selectedMatch.b.team]).join("/")}
                </p>
              </div>
            </div>
          )}
          <div className="ct-interval">
            <div className="ct-interval-heading">
              <span>
                {viewingStrongest
                  ? t("Largest detected shift", "系统识别的最大变化")
                  : t("Comparison window", "当前对比区间")}
              </span>
              <strong>
                {seasonLabel(a.season)} → {seasonLabel(b.season)}
              </strong>
              <button
                type="button"
                aria-expanded={editingSeasons}
                aria-controls="career-season-controls"
                onClick={() => setEditingSeasons(!editingSeasons)}
              >
                {editingSeasons
                  ? t("Hide season controls", "收起赛季选择")
                  : t("Choose seasons", "手动选赛季")}
              </button>
            </div>
            <div
              className="ct-season-controls"
              id="career-season-controls"
              hidden={!editingSeasons}
            >
              {pair.map((r, i) => (
                <label key={i}>
                  <span>
                    {i
                      ? t("Later season", "较晚赛季")
                      : t("Earlier season", "较早赛季")}
                  </span>
                  <select
                    value={r.season}
                    aria-label={
                      i
                        ? t("Later season", "较晚赛季")
                        : t("Earlier season", "较早赛季")
                    }
                    onChange={(e) => {
                      setPeer(null);
                      setSelection({
                        ...selection,
                        [i ? "to" : "from"]: Number(e.target.value),
                      });
                    }}
                  >
                    {rows
                      .filter((s) =>
                        i ? s.season > a.season : s.season < b.season,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.season}>
                          {seasonLabel(s.season)} · {s.team}
                          {s.age != null
                            ? " · " + t("age " + s.age, s.age + " 岁")
                            : ""}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>
        {selectedMatch && (
          <ComparisonTakeaway
            pairs={[
              [a, b],
              [selectedMatch.a, selectedMatch.b],
            ]}
            changes={[changes, zoneChanges(selectedMatch.a, selectedMatch.b)]}
            band={band}
            followup={followup}
            reference={thirdSeasonReference(
              ranking.matches,
              careers,
              b.season,
              band,
              changes[band]!,
            )}
            t={t}
          />
        )}
        <div className="ct-grid">
          <CareerShifts
            result={detected}
            a={a}
            b={b}
            twin={selectedMatch?.b.name}
            names={names}
            onShift={pickShift}
            t={t}
          />
          <TransitionMatches
            key={a.id + "/" + b.id}
            a={a}
            b={b}
            ranking={ranking}
            selected={selectedMatch}
            onSelect={setPeer}
            followup={followup}
            band={band}
            onBand={setZone}
            t={t}
          >
            {selectedMatch && (
              <div className="ct-grid pc-visuals">
                <PairedCareerCharts
                  key={selectedMatch.b.id}
                  rows={rows}
                  peerRows={careers.get(selectedMatch.b.playerId)!}
                  a={a}
                  b={b}
                  peerEnd={selectedMatch.b}
                  shifts={detected.shifts}
                  onShift={pickShift}
                  band={band}
                  zone={zone}
                  onZone={setZone}
                  onPick={pickColumn}
                  t={t}
                />
                <LocationCourts
                  selected={matrix}
                  twinMatrix
                  followup={followup}
                  index={shotIndex}
                  indexError={indexError}
                  onRetryIndex={retryIndex}
                  zone={zone}
                  hoverZone={null}
                  onClearZone={() => setZone(null)}
                  focus={null}
                  t={t}
                />
              </div>
            )}
          </TransitionMatches>
          {!selectedMatch && (
            <>
              <DietHistory
                shifts={detected.shifts}
                onShift={pickShift}
                rows={rows}
                a={a}
                b={b}
                onPick={pickColumn}
                t={t}
              />
              <section className="ct-panel ct-difference">
                <div className="ct-panel-head">
                  <h2>{t("Five-zone comparison", "五区出手对比")}</h2>
                  <span>
                    {t("Difference in percentage points", "差值单位为百分点")}
                  </span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>{t("Distance", "距离")}</th>
                      <th>{seasonLabel(a.season)}</th>
                      <th>{seasonLabel(b.season)}</th>
                      <th>{t("Share change", "占比变化")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {names.map((name, i) => (
                      <tr key={i} className={zone === i ? "selected" : ""}>
                        <th>
                          <button
                            aria-pressed={zone === i}
                            onClick={() => setZone(zone === i ? null : i)}
                          >
                            <i style={{ background: BAND_COLORS[i] }} />
                            {name}
                          </button>
                        </th>
                        <td>{percent(a.shares[i])}</td>
                        <td>{percent(b.shares[i])}</td>
                        <td
                          className={
                            changes[i] != null && changes[i]! > 0
                              ? "increase"
                              : ""
                          }
                        >
                          {pp(changes[i])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ct-panel-note">
                  <ListFilter size={13} />
                  {t(
                    "Select a distance to filter both courts.",
                    "点选距离可筛选下方两张球场。",
                  )}
                </div>
              </section>
              <LocationCourts
                selected={pair}
                index={shotIndex}
                indexError={indexError}
                onRetryIndex={retryIndex}
                zone={zone}
                hoverZone={null}
                onClearZone={() => setZone(null)}
                focus={null}
                t={t}
              />
              <EfficiencyHistory rows={rows} a={a} b={b} t={t} />
            </>
          )}
          <section
            className="pc-summaries"
            aria-label={t(
              "Changes between selected seasons",
              "所选赛季变化摘要",
            )}
          >
            {comparisons.map(([a, b], i) => {
              const rtsChange =
                a.rts == null || b.rts == null ? null : b.rts - a.rts;
              return (
                <div className="ct-summary pc-summary-row" key={b.id}>
                  <b className="pc-summary-name">
                    <i style={{ background: PLAYER_COLORS[i] }} />
                    {shortName(b.name)}
                  </b>
                  {summary("gain", a, b)}
                  {summary("loss", a, b)}
                  <div className="ct-stat">
                    <div className="ct-stat-label">
                      <Activity size={15} />
                      {t("Relative true shooting change", "相对真实命中率变化")}
                    </div>
                    <div className="ct-stat-value">
                      {rtsChange == null ? "—" : pp(rtsChange).split(" ")[0]}
                      {rtsChange != null && <small>pp</small>}
                    </div>
                    <div className="ct-stat-context">
                      <b>rTS</b>
                      <span>
                        {pp(a.rts)} → {pp(b.rts)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
          {selectedMatch && (
            <details className="ct-panel pc-source-data">
              <summary>
                {t(
                  "Full season data for both players",
                  "两人起止赛季的完整数据",
                )}
              </summary>
              <SeasonComparisonTable data={data} selected={matrix} t={t} />
            </details>
          )}
        </div>
        <footer className="ct-footer">
          <span>
            {t("NBA regular season", "NBA 常规赛")} · Basketball-Reference /
            NBA.com · {seasonLabel(data.metadata.firstSeason)} —{" "}
            {seasonLabel(data.metadata.lastSeason)}
          </span>
        </footer>
      </main>
    </div>
  );
}
