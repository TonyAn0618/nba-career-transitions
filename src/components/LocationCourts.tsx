import { useEffect, useMemo, useState } from "react";
import { Expand, RotateCcw } from "lucide-react";
import {
  percent,
  PLAYER_COLORS,
  PLAYER_LETTERS,
  seasonLabel,
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
const cache = new Map<string, ShotFile>();
const WIDTH = 270,
  PAD = 10,
  SCALE = 5;
const px = (x: number) => PAD + (x + 25) * SCALE;
const py = (y: number) => PAD + y * SCALE;
function CourtLines({ full }: { full: boolean }) {
  return (
    <g fill="none" stroke="#90a3b3" strokeWidth=".8" pointerEvents="none">
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
  twinMatrix = false,
  followup,
  index,
  indexError,
  onRetryIndex,
  zone,
  hoverZone,
  onClearZone,
  focus,
  t,
}: {
  selected: SeasonRow[];
  twinMatrix?: boolean;
  followup?: TwinFollowup;
  index: ShotIndex | null;
  indexError: boolean;
  onRetryIndex: () => void;
  zone: number | null;
  hoverZone: number | null;
  onClearZone: () => void;
  focus: number | null;
  t: Translate;
}) {
  const [mode, setMode] = useState<ShotMode>("points"),
    [full, setFull] = useState(false),
    [minShots, setMinShots] = useState(5),
    [hoverCell, setHoverCell] = useState<string | null>(null),
    [pinnedCell, setPinnedCell] = useState<string | null>(null),
    [point, setPoint] = useState<{ slot: number; shot: Shot } | null>(null),
    [loaded, setLoaded] = useState<Record<string, ShotFile>>({}),
    [errors, setErrors] = useState<string[]>([]),
    [attempt, setAttempt] = useState(0);
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
  const slots = useMemo(
    () =>
      tracked
        ? [selected[2], selected[3], tracked[0].row, tracked[1].row]
        : selected,
    [selected, tracked],
  );
  const color = (slot: number) => PLAYER_COLORS[twinMatrix ? slot % 2 : slot];
  const label = (slot: number) => {
    if (!twinMatrix) return PLAYER_LETTERS[slot];
    if (tracked && slot >= 2) return t(`${phase}y later`, `${phase} 年后`);
    return slot < 2 && !tracked ? t("Earlier", "较早季") : t("Later", "较晚季");
  };
  const keys = slots.map((r) => r?.id ?? "").join("|");
  useEffect(() => {
    const ctrl = new AbortController();
    setErrors([]);
    setLoaded((previous) =>
      Object.fromEntries(
        slots
          .filter((row): row is SeasonRow => !!row && !!previous[row.id])
          .map((row) => [row.id, previous[row.id]]),
      ),
    );
    setPinnedCell(null);
    setHoverCell(null);
    setPoint(null);
    for (const r of slots) {
      if (!r) continue;
      const entry = entryMap.get(r.id);
      if (!entry) continue;
      if (cache.has(r.id)) {
        setLoaded((old) => ({ ...old, [r.id]: cache.get(r.id)! }));
        continue;
      }
      fetch("./data/shots/" + entry.file.replace(/^\/?data\/shots\//, ""), {
        signal: ctrl.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Shot file unavailable");
          const data = (await response.json()) as ShotFile;
          if (
            data.schemaVersion !== 1 ||
            data.season !== r.season ||
            data.playerId !== r.playerId ||
            !Array.isArray(data.shots)
          )
            throw new Error("Shot file mismatch");
          if (ctrl.signal.aborted) return;
          if (cache.size >= 24) cache.delete(cache.keys().next().value!);
          cache.set(r.id, data);
          setLoaded((old) => ({ ...old, [r.id]: data }));
        })
        .catch((e) => {
          if (e.name !== "AbortError") setErrors((old) => [...old, r.id]);
        });
    }
    return () => ctrl.abort();
  }, [keys, entryMap, attempt]);
  useEffect(() => {
    setPinnedCell(null);
    setHoverCell(null);
    setPoint(null);
  }, [zone, full]);
  const views = useMemo(
    () =>
      slots.map((row) => {
        if (!row) return null;
        const file = loaded[row.id],
          all = file?.shots ?? [];
        const shots =
          zone == null ? all : all.filter((s) => shotZone(s) === zone);
        return {
          row,
          file,
          shots,
          cells: shotCells(shots, full),
          summary: shotSummary(shots),
          outside: shots.filter((s) => !inCourt(s, full)).length,
        };
      }),
    [slots, loaded, zone, full],
  );
  const maxShare = Math.max(
    0.01,
    ...views.flatMap((v) => v?.cells.map((c) => c.share) ?? []),
  );
  const activeCell = hoverCell ?? pinnedCell;
  const nRows = full ? 19 : 10;
  const bands = Array.from({ length: 10 * nRows }, (_, i) => ({
    col: i % 10,
    row: Math.floor(i / 10),
  }));
  return (
    <section
      className={
        "analysis-panel courts-panel" + (twinMatrix ? " pc-courts" : "")
      }
      aria-label={t("Real shot locations", "真实投篮位置")}
    >
      <div className="panel-heading">
        <h2>
          {twinMatrix
            ? t("Shot maps by season", "赛季投篮图对照")
            : t("Shot locations", "真实投篮位置")}
        </h2>
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
        {followup && (
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
        <button
          className={zone == null ? "filter-chip active" : "filter-chip"}
          onClick={onClearZone}
        >
          {t("All shots", "全部出手")}
        </button>
        {zone != null && (
          <span className="filter-chip active">
            {ZONES[zone]}{" "}
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
              aria-label={t("Minimum cell attempts", "网格最少出手数")}
              value={minShots}
              onChange={(e) => setMinShots(+e.target.value)}
            >
              {[5, 10, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        <button
          className={"full-court " + (full ? "active" : "")}
          aria-pressed={full}
          onClick={() => setFull(!full)}
        >
          <Expand size={12} />
          {full ? t("Full court", "全场") : t("Half court", "半场")}
        </button>
      </div>
      <div className={"courts-grid count-" + selected.length}>
        {views.map((v, i) => {
          if (!v) {
            const record = tracked![i - 2],
              player = selected[i];
            return (
              <article
                className="court-player pc-missing-season"
                key={player.playerId + ":" + record.year}
              >
                <div className="court-player-name" style={{ color: color(i) }}>
                  <b>{player.name}</b>
                  <span>
                    {label(i)} · {seasonLabel(record.year)}
                  </span>
                </div>
                <div className="court-empty">
                  {record.observable
                    ? t("No season record", "无赛季记录")
                    : t("Outside observation window", "超出观察期")}
                </div>
              </article>
            );
          }
          const entry = entryMap.get(v.row.id);
          const cell = v.cells.find((c) => c.id === activeCell);
          const h = PAD * 2 + (full ? 94 : 47) * SCALE;
          const muted = focus != null && focus !== i;
          return (
            <article
              className="court-player"
              key={v.row.id}
              style={{ opacity: muted ? 0.4 : 1 }}
            >
              <div className="court-player-name" style={{ color: color(i) }}>
                <b>
                  {twinMatrix
                    ? v.row.name
                    : label(i) + " · " + shortName(v.row.name)}
                </b>
                <span>
                  {twinMatrix && label(i) + " · "}
                  {seasonLabel(v.row.season)}
                  {twinMatrix &&
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
              ) : !entry ? (
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
                    {v.row.season < 2004
                      ? "2003–04 → 2024–25"
                      : t("No verified player match", "无可验证的球员匹配")}
                  </small>
                </div>
              ) : errors.includes(v.row.id) ? (
                <div className="court-empty">
                  {t("Could not load shots", "投篮数据载入失败")}
                  <button onClick={() => setAttempt(attempt + 1)}>
                    {t("Retry", "重试")}
                  </button>
                </div>
              ) : !v.file ? (
                <div className="court-empty">
                  {t("Loading shots…", "载入投篮记录…")}
                </div>
              ) : (
                <>
                  <svg
                    className={"shot-court " + (full ? "full" : "")}
                    viewBox={`0 0 ${WIDTH} ${h}`}
                    role="group"
                    aria-label={
                      v.row.name +
                      " " +
                      seasonLabel(v.row.season) +
                      t(" shot chart", " 投篮图")
                    }
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
                      fill="var(--page)"
                    />
                    {mode !== "points" &&
                      v.cells.map((c) => {
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
                            height={Math.min(5, (full ? 94 : 47) - c.y) * SCALE}
                            fill={
                              mode === "accuracy" && c.attempts < minShots
                                ? "#47525e"
                                : "var(--player-blue)"
                            }
                            fillOpacity={
                              mode === "accuracy" && c.attempts < minShots
                                ? 1
                                : alpha
                            }
                            stroke="var(--page)"
                            strokeWidth=".5"
                          />
                        );
                      })}
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
                      v.shots
                        .filter((s) => inCourt(s, full))
                        .map((s, j) => (
                          <circle
                            key={j}
                            cx={px(s[0])}
                            cy={py(s[1])}
                            r={s[2] ? 1.5 : 1.35}
                            fill={s[2] ? color(i) : "var(--page)"}
                            stroke={color(i)}
                            strokeWidth={s[2] ? 0.25 : 0.65}
                            opacity={
                              (hoverZone != null &&
                                shotZone(s) !== hoverZone) ||
                              (activeCell && cellId(s) !== activeCell)
                                ? 0.12
                                : s[2]
                                  ? 0.82
                                  : 0.72
                            }
                            onMouseEnter={() => {
                              setHoverCell(cellId(s));
                              setPoint({ slot: i, shot: s });
                            }}
                            onClick={() =>
                              setPinnedCell(
                                pinnedCell === cellId(s) ? null : cellId(s),
                              )
                            }
                          >
                            <title>{`${s[7]} · ${s[2] ? t("Made", "命中") : t("Missed", "未中")} · ${s[4]} ft · Q${s[8]} ${Math.floor(s[9] / 60)}:${String(s[9] % 60).padStart(2, "0")} · ${s[12]}`}</title>
                          </circle>
                        ))}
                    <CourtLines full={full} />
                  </svg>
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
                  </div>
                  <div
                    className="coverage"
                    title={t(
                      "Recorded locations / Basketball-Reference full-season FGA. Differences are retained, never filled.",
                      "坐标记录数 / Basketball-Reference 全赛季出手数。差异保留，不补点。",
                    )}
                  >
                    {t("Coverage ", "坐标覆盖 ")}
                    {entry.coverage.recordedAttempts.toLocaleString()} /{" "}
                    {entry.coverage.expectedAttempts?.toLocaleString() ?? "—"}
                    {entry.coverage.status === "excess" ? " ⚠" : ""}
                    {v.outside > 0 && (
                      <button onClick={() => setFull(true)}>
                        {v.outside} {t("off view", "次在视图外")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="court-readout" aria-live="polite">
        {point && mode === "points" ? (
          <span>
            <b style={{ color: color(point.slot) }}>
              {label(point.slot)}
              {twinMatrix && " · " + shortName(slots[point.slot]?.name ?? "")}
            </b>{" "}
            · {point.shot[7]} ·{" "}
            {point.shot[2] ? t("Made", "命中") : t("Missed", "未中")} ·{" "}
            {point.shot[4]} ft · {point.shot[12]}
          </span>
        ) : activeCell ? (
          <span>
            {t(
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
        ) : (
          <span>
            {t(
              "Hover a region to compare · click to hold",
              "悬停同一区域比较 · 点击固定",
            )}
          </span>
        )}
      </div>
      <div className="panel-foot">
        <span>
          {mode === "points"
            ? t("● Made  ○ Missed", "● 命中  ○ 未中")
            : mode === "frequency"
              ? t("Cell / filtered recorded shots", "网格出手 / 筛选后坐标记录")
              : t(
                  `Makes / attempts · gray < ${minShots} shots`,
                  `命中 / 出手 · 灰色 < ${minShots}次`,
                )}
        </span>
        {mode === "frequency" ? (
          <b className="heat-legend">
            0 <i /> {percent(maxShare)}
          </b>
        ) : mode === "accuracy" ? (
          <b className="heat-legend">
            0 <i /> 100%
          </b>
        ) : (
          <span>NBA.com · 2003–25</span>
        )}
      </div>
    </section>
  );
}
