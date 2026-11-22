import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Expand, RotateCcw } from "lucide-react";
import {
  percent,
  PLAYER_COLORS,
  PLAYER_LETTERS,
  seasonLabel,
  seasonRange,
  shortName,
  ZONES,
} from "../lib/analysis";
import {
  cellId,
  inCourt,
  shotCells,
  shotSummary,
  shotZone,
  type Shot,
  type ShotFile,
  type ShotIndex,
  type ShotMode,
} from "../lib/shots";
import { BAND_COLORS, bandNames } from "./TransitionCharts";
import type { TwinFollowup } from "../lib/paired-career";
import type { SeasonRow, Translate } from "../lib/types";
import {
  courtRegionId,
  courtRegions,
  courtRegionStats,
} from "../lib/court-regions";
import regionLeague from "../lib/league-court-regions.json";
import { PeerRegionCourt, PeerRegionLegend } from "./PeerRegionCourt";
import CareerShotPoints from "./CareerShotPoints";

type MissingSeason = Pick<SeasonRow, "playerId" | "name" | "season"> & {
  missing: "season" | "outside-window";
  detail?: string;
};
type MissingPeerStage = Pick<SeasonRow, "playerId" | "name"> & {
  missing: "peer-stage";
  season?: undefined;
  detail: string;
};
export type CourtSeason = SeasonRow | MissingSeason | MissingPeerStage;

export interface CourtComparisonSlot {
  player: SeasonRow;
  row?: SeasonRow;
  year: number;
  label: string;
  message?: string;
}

const leagueRegions: Record<
  string,
  Record<string, number[]>
> = regionLeague.seasons;
const cache = new Map<string, ShotFile>();
function leagueRegionsFor(seasons: number[]) {
  if (seasons.length === 1) return leagueRegions[seasons[0]] ?? {};
  if (seasons.some((season) => !leagueRegions[season])) return {};
  const pooled: Record<string, number[]> = {};
  for (const season of seasons) {
    for (const [region, counts] of Object.entries(
      leagueRegions[season] ?? {},
    )) {
      const sum = (pooled[region] ??= [0, 0]);
      sum[0] += counts[0];
      sum[1] += counts[1];
    }
  }
  return pooled;
}
const seasonTitles: Record<ShotMode, [string, string]> = {
  points: ["Shot locations by season", "两季投篮点对比图"],
  frequency: ["Shot frequency by season", "两季出手热区对比图"],
  accuracy: ["Field goal percentage by season", "两季命中率对比图"],
};
const WIDTH = 270,
  PAD = 10,
  SCALE = 5;
const px = (x: number) => PAD + (x + 25) * SCALE;
const py = (y: number) => PAD + y * SCALE;
function CourtLines({ full }: { full: boolean }) {
  return (
    <g
      fill="none"
      stroke="var(--court-lines, #90a3b3)"
      strokeWidth=".8"
      pointerEvents="none"
    >
      <rect
        x={px(-25)}
        y={py(0)}
        width={250}
        height={(full ? 94 : 47) * SCALE}
      />
      <path
        d={`M${px(-22)} ${py(0)} V${py(14.2)} A${23.75 * SCALE} ${23.75 * SCALE} 0 0 0 ${px(22)} ${py(14.2)} V${py(0)}`}
      />
      <rect x={px(-8)} y={py(0)} width={80} height={19 * SCALE} />
      <path d={`M${px(-6)} ${py(19)} A30 30 0 0 0 ${px(6)} ${py(19)}`} />
      <path
        d={`M${px(-6)} ${py(19)} A30 30 0 0 1 ${px(6)} ${py(19)}`}
        strokeDasharray="3 3"
      />
      <path d={`M${px(-4)} ${py(5.25)} A20 20 0 0 0 ${px(4)} ${py(5.25)}`} />
      <path d={`M${px(-3)} ${py(4)} H${px(3)}`} strokeWidth="1.6" />
      <circle cx={px(0)} cy={py(5.25)} r={0.75 * SCALE} strokeWidth="1.5" />
      <path d={`M${px(-6)} ${py(47)} A30 30 0 0 1 ${px(6)} ${py(47)}`} />
      {full && (
        <>
          <path d={`M${px(-25)} ${py(47)} H${px(25)}`} />
          <circle cx={px(0)} cy={py(88.75)} r={0.75 * SCALE} />
          <rect x={px(-8)} y={py(75)} width={80} height={19 * SCALE} />
          <path
            d={`M${px(-22)} ${py(94)} V${py(79.8)} A${23.75 * SCALE} ${23.75 * SCALE} 0 0 1 ${px(22)} ${py(79.8)} V${py(94)}`}
          />
        </>
      )}
    </g>
  );
}
export default function LocationCourts({
  selected,
  comparisonSlots,
  twinMatrix = false,
  initialMode = "points",
  careerYear,
  careerRows,
  seasonComparison = false,
  followup,
  index,
  indexError,
  onRetryIndex,
  zone: distanceBand,
  hoverZone,
  onClearZone,
  focus,
  t,
}: {
  selected: readonly CourtSeason[];
  comparisonSlots?: readonly CourtComparisonSlot[];
  twinMatrix?: boolean;
  initialMode?: ShotMode;
  careerYear?: number;
  careerRows?: readonly [readonly SeasonRow[], readonly SeasonRow[]];
  seasonComparison?: boolean;
  followup?: TwinFollowup;
  index: ShotIndex | null;
  indexError: boolean;
  onRetryIndex: () => void;
  zone: number | null;
  hoverZone: number | null;
  onClearZone?: () => void;
  focus: number | null;
  t: Translate;
}) {
  const regional = seasonComparison || careerYear != null || !!careerRows;
  const [mode, setMode] = useState<ShotMode>(initialMode),
    [showFullCourt, setFull] = useState(false),
    [minShots, setMinShots] = useState(regional ? 1 : 5),
    [hoverCell, setHoverCell] = useState<string | null>(null),
    [pinnedCell, setPinnedCell] = useState<string | null>(null),
    [point, setPoint] = useState<{ slot: number; shot: Shot } | null>(null),
    [loaded, setLoaded] = useState<Record<string, ShotFile>>({}),
    [errors, setErrors] = useState<string[]>([]),
    [attempt, setAttempt] = useState(0);
  const full = !regional && showFullCourt;
  // A distance filter applies to individual shots. League benchmarks cover whole regions.
  const zone = seasonComparison && mode !== "points" ? null : distanceBand;
  const entryMap = useMemo(
    () =>
      new Map(
        Object.values(index?.playerSeasons ?? {})
          .filter((e) => e.playerId)
          .map((e) => [`${e.playerId}:${e.season}`, e]),
      ),
    [index],
  );
  const [phase, setPhase] = useState(0);
  const tracked = phase > 0 ? followup?.[phase] : undefined;
  const slots = useMemo(() => {
    if (comparisonSlots)
      return comparisonSlots.map(
        ({ row, player, year, message }): CourtSeason =>
          row ?? {
            playerId: player.playerId,
            name: player.name,
            season: year,
            missing: "season",
            detail: message,
          },
      );
    if (!tracked) return selected;
    const later = tracked.map((record, i): CourtSeason => {
      const { name, playerId } = selected[i + 2];
      return (
        record.row ?? {
          name,
          playerId,
          season: record.year,
          missing: record.observable ? "season" : "outside-window",
        }
      );
    });
    return [selected[2], selected[3], ...later];
  }, [selected, tracked, comparisonSlots]);
  const heatMetric = regional && mode !== "points" ? mode : null;
  const pointRegion = regional ? courtRegionId : cellId;
  const color = (slot: number) => {
    if (regional) return "var(--peer-shot-ink)";
    if (comparisonSlots)
      return PLAYER_COLORS[
        slots[slot].playerId === selected[0].playerId ? 0 : 1
      ];
    return PLAYER_COLORS[twinMatrix ? slot % 2 : slot];
  };
  const label = (slot: number) => {
    if (comparisonSlots) return comparisonSlots[slot].label;
    if (seasonComparison)
      return t(
        `Season ${PLAYER_LETTERS[slot]}`,
        `赛季 ${PLAYER_LETTERS[slot]}`,
      );
    if (!twinMatrix) return PLAYER_LETTERS[slot];
    if (tracked && slot >= 2) return t(`${phase}y later`, `${phase} 年后`);
    return slot < 2 && !tracked ? t("Earlier", "较早季") : t("Later", "较晚季");
  };
  const rowsBySlot = useMemo(
    () => slots.map((row, i) => careerRows?.[i] ?? ("id" in row ? [row] : [])),
    [slots, careerRows],
  );
  const fileIds = rowsBySlot
    .flat()
    .map((row) => row.id)
    .join("|");
  const keys =
    (careerRows ? "career/" : "") +
    slots.map((r) => `${r.playerId}:${r.season}`).join("|") +
    "/" +
    fileIds;
  useEffect(() => {
    const ctrl = new AbortController();
    const ids = [...new Set(fileIds.split("|"))].filter((id) =>
      entryMap.has(id),
    );
    const files: Record<string, ShotFile> = {};
    const missing = ids.filter((id) => {
      const cached = cache.get(id);
      if (cached) files[id] = cached;
      return !cached;
    });
    setLoaded({ ...files });
    setErrors([]);
    if (!missing.length) return;
    const failed: string[] = [];
    Promise.all(
      missing.map(async (id) => {
        const entry = entryMap.get(id)!;
        try {
          const response = await fetch(
            "./data/shots/" + entry.file.replace(/^\/?data\/shots\//, ""),
            { signal: ctrl.signal },
          );
          if (!response.ok) throw new Error("Shot file unavailable");
          const data = (await response.json()) as ShotFile;
          if (
            data.schemaVersion !== 1 ||
            data.season !== entry.season ||
            data.playerId !== entry.playerId ||
            !Array.isArray(data.shots)
          )
            throw new Error("Shot file mismatch");
          if (ctrl.signal.aborted) return;
          if (cache.size >= 64) cache.delete(cache.keys().next().value!);
          cache.set(id, data);
          files[id] = data;
        } catch {
          if (!ctrl.signal.aborted) failed.push(id);
        }
      }),
    ).then(() => {
      if (ctrl.signal.aborted) return;
      setLoaded(files);
      setErrors(failed);
    });
    return () => ctrl.abort();
  }, [fileIds, entryMap, attempt]);
  useLayoutEffect(() => {
    setPinnedCell(null);
    setHoverCell(null);
    setPoint(null);
  }, [keys, zone, full]);
  const views = useMemo(
    () =>
      slots.map((row, i) => {
        if ("missing" in row) return { missing: row };
        const rows = rowsBySlot[i];
        const covered = rows.filter((r) => entryMap.has(r.id));
        const ready = covered.length > 0 && covered.every((r) => loaded[r.id]);
        const all = !ready
          ? []
          : covered.length === 1
            ? loaded[covered[0].id].shots
            : covered.flatMap((r) => loaded[r.id].shots);
        const shots =
          zone == null ? all : all.filter((s) => shotZone(s) === zone);
        const expected = rows.reduce<number | null>(
          (sum, r) => (sum == null || r.fga == null ? null : sum + r.fga),
          0,
        );
        return {
          missing: null,
          row,
          rows,
          covered: covered.length,
          ready,
          failed: covered.some((r) => errors.includes(r.id)),
          league: regional
            ? leagueRegionsFor(covered.map((r) => r.season))
            : {},
          coverage: careerRows
            ? {
                recordedAttempts: all.length,
                expectedAttempts: expected,
                status:
                  expected != null && all.length > expected ? "excess" : "",
              }
            : entryMap.get(row.id)?.coverage,
          shots,
          cells: regional ? [] : shotCells(shots, full),
          regions: regional ? courtRegionStats(shots) : null,
          summary: shotSummary(shots),
          outside: shots.filter((s) => !inCourt(s, full)).length,
        };
      }),
    [
      slots,
      rowsBySlot,
      entryMap,
      loaded,
      errors,
      zone,
      full,
      regional,
      careerRows,
    ],
  );
  const maxShare = Math.max(
    0.01,
    ...views.flatMap((v) => v.cells?.map((c) => c.share) ?? []),
  );
  const activeCell = regional
    ? (pinnedCell ?? hoverCell)
    : (hoverCell ?? pinnedCell);
  const pointPlayer = point ? slots[point.slot] : undefined;
  const selectedRegion = regional
    ? courtRegions.find((r) => r.id === activeCell)
    : null;
  const nRows = full ? 19 : 10;
  const bands = Array.from({ length: regional ? 0 : 10 * nRows }, (_, i) => ({
    col: i % 10,
    row: Math.floor(i / 10),
  }));
  const title = careerRows
    ? t("Career shot map", "生涯至今投篮热区图")
    : seasonComparison
      ? t(...seasonTitles[mode])
      : careerYear != null
        ? t(`Season ${careerYear} shot map`, `第${careerYear}赛季投篮热区图`)
        : twinMatrix
          ? t("Shot maps by season", "赛季投篮图对照")
          : t("Shot locations", "真实投篮位置");
  return (
    <section
      className={
        "analysis-panel courts-panel" + (twinMatrix ? " pc-courts" : "")
      }
      aria-label={regional ? title : t("Real shot locations", "真实投篮位置")}
    >
      <div className="panel-heading">
        <h2>{title}</h2>
        <div className="tiny-toggle">
          {(["points", "frequency", "accuracy"] as const).map((m) => (
            <button
              key={m}
              className={m === mode ? "active" : ""}
              aria-pressed={m === mode}
              onClick={() => setMode(m)}
            >
              {m === "points"
                ? t("Shots", "投篮点")
                : m === "frequency"
                  ? t("Frequency", "出手热区")
                  : t("FG%", "命中率")}
            </button>
          ))}
        </div>
      </div>
      <div className="court-toolbar">
        {followup && !comparisonSlots && (
          <select
            className="pc-court-stage"
            value={phase}
            aria-label={t("Court seasons", "球场对照阶段")}
            onChange={(e) => setPhase(Number(e.target.value))}
          >
            <option value={0}>{t("Selected seasons", "所选两季")}</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {t(`Later season and ${n}y later`, `较晚季与 ${n} 年后`)}
              </option>
            ))}
          </select>
        )}
        {onClearZone && !seasonComparison && (
          <button
            className={zone == null ? "filter-chip active" : "filter-chip"}
            onClick={onClearZone}
          >
            {t("All shots", "全部出手")}
          </button>
        )}
        {zone != null && (
          <span className="filter-chip active">
            {seasonComparison ? bandNames(t)[zone] : ZONES[zone]}{" "}
            <button
              aria-label={t("Clear distance filter", "清除距离筛选")}
              onClick={onClearZone}
            >
              ×
            </button>
          </span>
        )}
        {mode === "accuracy" && (
          <label className="min-shot-control">
            {t("Min.", "最少")}
            <select
              aria-label={t("Minimum region attempts", "区域最少出手数")}
              value={minShots}
              onChange={(e) => setMinShots(+e.target.value)}
            >
              {(regional ? [1, 5, 10, 20] : [5, 10, 20]).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {!regional && (
          <button
            className={"full-court " + (full ? "active" : "")}
            aria-pressed={full}
            onClick={() => setFull(!full)}
          >
            <Expand size={12} />
            {full ? t("Full court", "全场") : t("Half court", "半场")}
          </button>
        )}
      </div>
      <div className={"courts-grid count-" + slots.length}>
        {views.map((v, i) => {
          if (v.missing) {
            const record = v.missing;
            return (
              <article
                className={
                  twinMatrix
                    ? "court-player pc-missing-season"
                    : "court-player peer-missing-season"
                }
                key={`${i}:${record.playerId}:${record.season}`}
              >
                <div className="court-player-name" style={{ color: color(i) }}>
                  <b>{record.name}</b>
                  {record.season != null && (
                    <span>
                      {twinMatrix && label(i) + " · "}
                      {seasonLabel(record.season)}
                    </span>
                  )}
                </div>
                <div className="court-empty">
                  {record.detail ??
                    (record.missing === "outside-window"
                      ? t("Outside observation window", "超出观察期")
                      : t(
                          "No regular-season record",
                          "暂无该赛季的常规赛记录",
                        ))}
                </div>
              </article>
            );
          }
          const season = careerRows
            ? seasonRange(v.rows[0].season, v.rows[v.rows.length - 1].season)
            : seasonLabel(v.row.season);
          const chartName = seasonComparison
            ? `${v.row.name} · ${label(i)} · ${season}`
            : `${v.row.name} ${season}`;
          const cell =
            v.regions && activeCell
              ? v.regions.get(activeCell)
              : v.cells.find((c) => c.id === activeCell);
          const league = v.league;
          const leagueCounts = activeCell ? league[activeCell] : undefined;
          const h = PAD * 2 + (full ? 94 : 47) * SCALE;
          const muted = focus != null && focus !== i;
          return (
            <article
              className="court-player"
              key={`${i}:${v.row.id}`}
              style={{ opacity: muted ? 0.4 : 1 }}
            >
              <div className="court-player-name" style={{ color: color(i) }}>
                <b>
                  {seasonComparison
                    ? label(i)
                    : twinMatrix || regional
                      ? v.row.name
                      : label(i) + " · " + shortName(v.row.name)}
                </b>
                <span>
                  {twinMatrix && label(i) + " · "}
                  {season}
                  {careerRows &&
                    index &&
                    t(
                      ` · ${v.covered}/${v.rows.length} seasons with locations`,
                      ` · ${v.covered}/${v.rows.length} 季有坐标`,
                    )}
                  {regional &&
                    !careerRows &&
                    v.row.age != null &&
                    t(` · age ${v.row.age}`, ` · ${v.row.age} 岁`)}
                  {!careerRows &&
                    (twinMatrix || regional) &&
                    " · " + (v.row.teams ?? [v.row.team]).join("/")}
                </span>
              </div>
              {!index ? (
                <div className="court-empty">
                  {indexError ? (
                    <>
                      {t("Location data unavailable", "投篮位置数据不可用")}
                      <button onClick={onRetryIndex}>
                        <RotateCcw size={13} />
                        {t("Retry", "重试")}
                      </button>
                    </>
                  ) : (
                    t("Loading shot index…", "载入投篮索引…")
                  )}
                </div>
              ) : !v.covered ? (
                <div className="court-empty">
                  {twinMatrix && (
                    <div
                      className="pc-distance-fallback"
                      role="img"
                      aria-label={
                        v.row.name +
                        " · " +
                        seasonLabel(v.row.season) +
                        " · " +
                        t("season distance profile", "赛季距离分布")
                      }
                    >
                      <b>
                        {mode === "accuracy"
                          ? t("FG% by distance", "五区命中率")
                          : t("Attempt share by distance", "五区出手占比")}
                      </b>
                      {bandNames(t).map((name, k) => {
                        const amount =
                          mode === "accuracy"
                            ? v.row.shares[k] === 0
                              ? null
                              : v.row.fg[k]
                            : v.row.shares[k];
                        return (
                          <div
                            key={k}
                            style={{
                              opacity: zone == null || zone === k ? 1 : 0.4,
                            }}
                          >
                            <span>{name}</span>
                            <i>
                              <i
                                style={{
                                  width: amount == null ? "0" : percent(amount),
                                  background: BAND_COLORS[k],
                                }}
                              />
                            </i>
                            <b>{percent(amount)}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {t("No recorded locations", "无投篮位置记录")}
                  <small>
                    {careerRows ||
                    v.row.season < index.metadata.firstSeason ||
                    v.row.season > index.metadata.lastSeason
                      ? t(
                          `Coordinate coverage: ${seasonLabel(index.metadata.firstSeason)} to ${seasonLabel(index.metadata.lastSeason)}`,
                          `坐标覆盖期为 ${seasonLabel(index.metadata.firstSeason)} 至 ${seasonLabel(index.metadata.lastSeason)}`,
                        )
                      : v.row.fga === 0
                        ? t(
                            "No field-goal attempts this season",
                            "该赛季没有出手",
                          )
                        : t(
                            "No shot file for this player-season",
                            "该球员这一季缺少逐球坐标",
                          )}
                  </small>
                </div>
              ) : v.failed ? (
                <div className="court-empty">
                  {t("Could not load shots", "投篮数据载入失败")}
                  <button onClick={() => setAttempt(attempt + 1)}>
                    {t("Retry", "重试")}
                  </button>
                </div>
              ) : !v.ready || !v.coverage ? (
                <div className="court-empty">
                  {t("Loading shots…", "载入投篮记录…")}
                </div>
              ) : (
                <>
                  {heatMetric && v.regions ? (
                    <PeerRegionCourt
                      name={chartName}
                      mode={heatMetric}
                      stats={v.regions}
                      league={league}
                      full={full}
                      minShots={minShots}
                      activeRegion={activeCell}
                      pinnedRegion={pinnedCell}
                      onHover={setHoverCell}
                      onPin={setPinnedCell}
                      t={t}
                    />
                  ) : (
                    <svg
                      className={"shot-court " + (full ? "full" : "")}
                      viewBox={`0 0 ${WIDTH} ${h}`}
                      role="group"
                      aria-label={chartName + t(" shot chart", " 投篮图")}
                      onMouseLeave={() => {
                        setHoverCell(null);
                        setPoint(null);
                      }}
                    >
                      <rect
                        x={PAD}
                        y={PAD}
                        width={250}
                        height={(full ? 94 : 47) * SCALE}
                        fill="var(--court-floor, var(--page))"
                      />
                      {mode !== "points" &&
                        v.cells.map((c) => {
                          const belowMinimum =
                            mode === "accuracy" && c.attempts < minShots;
                          const alpha =
                            mode === "frequency"
                              ? 0.12 + (0.8 * c.share) / maxShare
                              : 0.1 + 0.85 * c.fg;
                          return (
                            <rect
                              key={c.id}
                              x={px(c.x)}
                              y={py(c.y)}
                              width={25}
                              height={
                                Math.min(5, (full ? 94 : 47) - c.y) * SCALE
                              }
                              fill={
                                belowMinimum ? "#47525e" : "var(--player-blue)"
                              }
                              fillOpacity={belowMinimum ? 1 : alpha}
                              stroke="var(--court-floor, var(--page))"
                              strokeWidth=".5"
                            />
                          );
                        })}
                      {regional && (
                        <g
                          transform={`translate(${px(0)} ${py(0)}) scale(${SCALE})`}
                        >
                          {careerRows && mode === "points" && (
                            <CareerShotPoints
                              shots={v.shots}
                              activeRegion={activeCell}
                              slot={i}
                              onPoint={setPoint}
                            />
                          )}
                          {courtRegions
                            .filter((r) => full || r.id !== "backcourt")
                            .map((r) => (
                              <path
                                key={r.id}
                                d={r.path}
                                fill={
                                  r.id === activeCell
                                    ? "var(--ink)"
                                    : "transparent"
                                }
                                fillOpacity={r.id === activeCell ? 0.1 : 0}
                                stroke={
                                  r.id === activeCell ? "var(--ink)" : "none"
                                }
                                strokeWidth=".2"
                                data-point-region={r.id}
                                role="button"
                                tabIndex={0}
                                aria-label={chartName + " · " + t(...r.name)}
                                aria-pressed={pinnedCell === r.id}
                                onMouseEnter={() => {
                                  setHoverCell(r.id);
                                  setPoint(null);
                                }}
                                onFocus={() => setHoverCell(r.id)}
                                onBlur={() => setHoverCell(null)}
                                onClick={() =>
                                  setPinnedCell(
                                    pinnedCell === r.id ? null : r.id,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setPinnedCell(
                                      pinnedCell === r.id ? null : r.id,
                                    );
                                  } else if (e.key === "Escape") {
                                    setPinnedCell(null);
                                    setHoverCell(null);
                                  }
                                }}
                              />
                            ))}
                        </g>
                      )}
                      {bands.map(({ col, row }) => {
                        const id = `${col}:${row}`,
                          x = col * 5 - 25,
                          y = row * 5;
                        return (
                          <rect
                            key={id}
                            x={px(x)}
                            y={py(y)}
                            width={25}
                            height={Math.min(5, (full ? 94 : 47) - y) * SCALE}
                            fill={
                              activeCell === id ? "var(--ink)" : "transparent"
                            }
                            fillOpacity={activeCell === id ? 0.12 : 0}
                            stroke={activeCell === id ? "var(--ink)" : "none"}
                            strokeWidth="1.5"
                            role="button"
                            tabIndex={(activeCell ?? "4:1") === id ? 0 : -1}
                            data-cell={id}
                            aria-label={`${shortName(v.row.name)} ${t("region", "区域")} x ${x}–${x + 5}, y ${y}–${Math.min(y + 5, full ? 94 : 47)} ft`}
                            aria-pressed={pinnedCell === id}
                            onMouseEnter={() => setHoverCell(id)}
                            onFocus={() => setHoverCell(id)}
                            onBlur={() => setHoverCell(null)}
                            onClick={() =>
                              setPinnedCell(pinnedCell === id ? null : id)
                            }
                            onKeyDown={(e) => {
                              const deltas: Record<string, [number, number]> = {
                                ArrowLeft: [-1, 0],
                                ArrowRight: [1, 0],
                                ArrowUp: [0, -1],
                                ArrowDown: [0, 1],
                              };
                              const delta = deltas[e.key];
                              if (delta) {
                                e.preventDefault();
                                const nx = Math.max(
                                    0,
                                    Math.min(9, col + delta[0]),
                                  ),
                                  ny = Math.max(
                                    0,
                                    Math.min(nRows - 1, row + delta[1]),
                                  );
                                e.currentTarget.parentElement
                                  ?.querySelector<SVGElement>(
                                    `[data-cell="${nx}:${ny}"]`,
                                  )
                                  ?.focus();
                              }
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setPinnedCell(pinnedCell === id ? null : id);
                              }
                              if (e.key === "Escape") {
                                setPinnedCell(null);
                                setHoverCell(null);
                              }
                            }}
                          />
                        );
                      })}
                      {mode === "points" &&
                        !careerRows &&
                        v.shots
                          .filter((s) => inCourt(s, full))
                          .map((s, j) => (
                            <circle
                              key={j}
                              cx={px(s[0])}
                              cy={py(s[1])}
                              r={s[2] ? 1.5 : 1.35}
                              fill={
                                s[2]
                                  ? color(i)
                                  : "var(--court-floor, var(--page))"
                              }
                              stroke={color(i)}
                              strokeWidth={s[2] ? 0.25 : 0.65}
                              opacity={
                                (hoverZone != null &&
                                  shotZone(s) !== hoverZone) ||
                                (activeCell && pointRegion(s) !== activeCell)
                                  ? 0.12
                                  : s[2]
                                    ? 0.82
                                    : 0.72
                              }
                              onMouseEnter={() => {
                                setHoverCell(pointRegion(s));
                                setPoint({ slot: i, shot: s });
                              }}
                              onClick={() =>
                                setPinnedCell(
                                  pinnedCell === pointRegion(s)
                                    ? null
                                    : pointRegion(s),
                                )
                              }
                            >
                              <title>{`${s[7]} · ${s[2] ? t("Made", "命中") : t("Missed", "未中")} · ${s[4]} ft · Q${s[8]} ${Math.floor(s[9] / 60)}:${String(s[9] % 60).padStart(2, "0")} · ${s[12]}`}</title>
                            </circle>
                          ))}
                      <CourtLines full={full} />
                    </svg>
                  )}
                  <div className="court-statline">
                    <b>
                      {activeCell ? (cell?.attempts ?? 0) : v.summary.attempts}
                    </b>{" "}
                    {activeCell
                      ? t("in region", "区域出手")
                      : t("shots", "次出手")}
                    <span>
                      {activeCell && mode === "frequency"
                        ? percent(cell?.share ?? (v.shots.length ? 0 : null)) +
                          t(" share", " 占比")
                        : (activeCell
                            ? percent(cell?.fg ?? null)
                            : percent(v.summary.fg)) + " FG"}
                    </span>
                    {heatMetric === "accuracy" &&
                      leagueCounts &&
                      leagueCounts[1] > 0 && (
                        <span>
                          {t("League", "联盟同区")}{" "}
                          {percent(leagueCounts[0] / leagueCounts[1])}
                        </span>
                      )}
                  </div>
                  <div
                    className="coverage"
                    title={t(
                      "Recorded locations / total field-goal attempts in the displayed seasons (Basketball-Reference).",
                      "有坐标的出手数 / 所示赛季的常规赛总出手数（Basketball-Reference）。",
                    )}
                  >
                    {t("Coverage ", "坐标覆盖 ")}
                    {v.coverage.recordedAttempts.toLocaleString()} /{" "}
                    {v.coverage.expectedAttempts?.toLocaleString() ?? "—"}
                    {v.coverage.status === "excess" ? " ⚠" : ""}
                    {v.outside > 0 &&
                      (regional ? (
                        <span>
                          {" "}
                          ·{" "}
                          {t(
                            `${v.outside} off view`,
                            `${v.outside} 次在半场外`,
                          )}
                        </span>
                      ) : (
                        <button onClick={() => setFull(true)}>
                          {v.outside} {t("off view", "次在视图外")}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      {(!comparisonSlots || views.some((v) => v.ready)) && (
        <>
          <div className="court-readout" aria-live="polite">
            {point && mode === "points" ? (
              <span>
                <b style={{ color: color(point.slot) }}>
                  {seasonComparison && pointPlayer?.season != null
                    ? label(point.slot) +
                      " · " +
                      seasonLabel(pointPlayer.season)
                    : regional
                      ? pointPlayer?.name
                      : label(point.slot)}
                  {twinMatrix && " · " + shortName(pointPlayer?.name ?? "")}
                </b>{" "}
                · {point.shot[7]} ·{" "}
                {point.shot[2] ? t("Made", "命中") : t("Missed", "未中")} ·{" "}
                {point.shot[4]} ft · {point.shot[12]}
              </span>
            ) : activeCell ? (
              <span>
                {selectedRegion
                  ? t(...selectedRegion.name)
                  : t(
                      "Same 5 × 5 ft region across all players",
                      "同一 5 × 5 英尺区域同步比较",
                    )}
                {pinnedCell && (
                  <button
                    onClick={() => {
                      setPinnedCell(null);
                      setHoverCell(null);
                    }}
                  >
                    {t("Clear", "清除")}
                  </button>
                )}
              </span>
            ) : !regional ? (
              <span>
                {t(
                  "Hover a region to compare · click to hold",
                  "悬停同一区域比较 · 点击固定",
                )}
              </span>
            ) : null}
          </div>
          {heatMetric ? (
            <PeerRegionLegend
              mode={heatMetric}
              minShots={minShots}
              career={!!careerRows}
              t={t}
            />
          ) : (
            <div className="panel-foot">
              {regional && mode === "points" ? (
                <span className="peer-point-key">
                  <span>
                    <i />
                    {t("Made", "命中")}
                  </span>
                  <span>
                    <i className="peer-miss" />
                    {t("Missed", "未中")}
                  </span>
                </span>
              ) : (
                <span>
                  {mode === "points"
                    ? t("● Made  ○ Missed", "● 命中  ○ 未中")
                    : mode === "frequency"
                      ? t(
                          "Cell / filtered recorded shots",
                          "网格出手 / 筛选后坐标记录",
                        )
                      : t(
                          `Makes / attempts · gray < ${minShots} shots`,
                          `命中 / 出手 · 灰色 < ${minShots}次`,
                        )}
                </span>
              )}
              {mode !== "points" && (
                <b className="heat-legend">
                  0 <i /> {mode === "frequency" ? percent(maxShare) : "100%"}
                </b>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
