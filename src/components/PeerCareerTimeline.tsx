import { useEffect, useId, useRef, useState } from "react";
import { fga36, seasonLabel, seasonRange } from "../lib/analysis";
import { MIN_ZONE_FGA, type CareerShootingTotals } from "../lib/career-peers";
import { missingPeerSeason, type PeerStage } from "../lib/peer-stages";
import { hasSmallZoneSample, valueAt } from "../lib/ring-encoding";
import type { SeasonRow, Translate } from "../lib/types";
import "./peer-career-timeline.css";

type Measure = "share" | "fg" | "rts" | "points" | "volume";
type ZoneMeasure = "share" | "fg";
type Overall = Exclude<Measure, ZoneMeasure>;
type Side = "target" | "peer";
const sides: Side[] = ["target", "peer"];

interface Props {
  anchor: SeasonRow;
  baseline: SeasonRow;
  seasons: readonly PeerStage[];
  selectedStage: PeerStage | null;
  totals: Record<Side, CareerShootingTotals>;
  onStage: (year: number | null) => void;
  t: Translate;
}

function measurement(
  row: SeasonRow | undefined,
  metric: Measure,
  zone: number,
) {
  if (!row) return null;
  if (metric === "rts") return row.rts;
  if (metric === "volume") return fga36(row);
  if (metric === "points")
    return row.points != null && row.minutes != null && row.minutes > 0
      ? (36 * row.points) / row.minutes
      : null;
  const value = valueAt(row, metric, zone);
  return value == null ? null : value * 100;
}

function signed(value: number) {
  const rounded = Number(value.toFixed(1));
  return (
    (rounded > 0 ? "+" : rounded < 0 ? "−" : "") + Math.abs(rounded).toFixed(1)
  );
}

function careerValue(
  totals: CareerShootingTotals,
  metric: Measure,
  zone: number,
) {
  if (metric === "rts") return totals.rts;
  if (metric === "volume") return totals.fga36;
  if (metric === "points") return totals.points36;
  const value = (metric === "share" ? totals.shares : totals.fg)[zone];
  return value == null ? null : value * 100;
}

function seasonInfo(
  row: SeasonRow | undefined,
  year: number,
  totals: CareerShootingTotals,
  t: Translate,
) {
  if (!row) return missingPeerSeason(year, totals, t);
  const age = row.age == null ? "" : t(` · age ${row.age}`, ` · ${row.age} 岁`);
  return seasonLabel(row.season) + age;
}

function axisTicks(values: (number | null)[]) {
  const numeric = values.filter((v): v is number => v != null);
  const min = Math.min(0, ...numeric);
  const max = Math.max(0, ...numeric);
  const rough = Math.max(1, (max - min) / 4);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const tick =
    magnitude * ([1, 2, 2.5, 5, 10].find((n) => n * magnitude >= rough) ?? 10);
  const bottom = Math.floor(min / tick) * tick;
  const top = Math.max(bottom + tick, Math.ceil(max / tick) * tick);
  return Array.from(
    { length: Math.round((top - bottom) / tick) + 1 },
    (_, i) => bottom + i * tick,
  );
}

export default function PeerCareerTimeline({
  anchor,
  baseline,
  seasons,
  selectedStage,
  totals,
  onStage,
  t,
}: Props) {
  const id = useId();
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [metricKey, setMetricKey] = useState("zone-4");
  const [zoneMeasure, setZoneMeasure] = useState<ZoneMeasure>("share");
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const size = new ResizeObserver(([entry]) =>
      setWidth(Math.max(1, Math.round(entry.contentRect.width))),
    );
    size.observe(el);
    return () => size.disconnect();
  }, []);

  const names = [
    t("At rim", "篮下"),
    t("Short two", "近两分"),
    t("Mid-range", "中距离"),
    t("Long two", "长两分"),
    t("Three-point", "三分"),
  ];
  const labels = {
    share: t("attempt share", "出手占比"),
    fg: t("FG%", "命中率"),
    rts: t("TS relative to league", "相对联盟真实命中率"),
    points: t("Points per 36 minutes", "每 36 分钟得分"),
    volume: t("Attempts per 36 minutes", "每 36 分钟出手"),
  };
  const isZoneMetric = metricKey.startsWith("zone-");
  const zone = isZoneMetric ? Number(metricKey.slice(5)) : 0;
  const metric: Measure = isZoneMetric ? zoneMeasure : (metricKey as Overall);
  const metricLabel = isZoneMetric
    ? t(names[zone] + " " + labels[metric], names[zone] + labels[metric])
    : labels[metric];
  const summaryUnit =
    isZoneMetric || metricKey === "rts"
      ? t("pp", "百分点")
      : metricKey === "points"
        ? t("pts", "分")
        : t("attempts", "次");
  const format = (v: number | null) =>
    v == null
      ? "—"
      : metric === "rts"
        ? signed(v) + t(" pp", " 个百分点")
        : v.toFixed(1) + (isZoneMetric ? "%" : "");
  const references = { target: anchor, peer: baseline };
  const available = seasons.filter((stage) => stage.target || stage.peer);
  const first = seasons[0].year;
  const last = seasons[seasons.length - 1].year;
  const left = 38;
  const right = Math.max(left + 1, width - 13);
  const top = 10;
  const plotHeight = Math.round(Math.min(164, Math.max(116, width * 0.36)));
  const bottom = top + plotHeight;
  const figureHeight = bottom + 23;
  const x = (year: number) =>
    first === last
      ? (left + right) / 2
      : left + ((year - first) / (last - first)) * (right - left);
  const series = {
    target: seasons.map((stage) => measurement(stage.target, metric, zone)),
    peer: seasons.map((stage) => measurement(stage.peer, metric, zone)),
  };
  const ticks = axisTicks([...series.target, ...series.peer]);
  const y = (v: number) =>
    bottom -
    ((v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * plotHeight;
  const interval = Math.max(
    1,
    Math.ceil((last - first) / (width < 460 ? 5 : 10)),
  );
  const spacing = (right - left) / Math.max(1, last - first);
  const labelsX = seasons.filter(
    ({ year }) =>
      year === first ||
      year === last ||
      (year % interval === 0 &&
        (year - first) * spacing > 23 &&
        (last - year) * spacing > 23),
  );
  const hasSmallSample = (row?: SeasonRow) =>
    row != null && hasSmallZoneSample(row, zone);
  const valueForSeason = (row: SeasonRow | undefined) =>
    format(measurement(row, metric, zone)) +
    (metric === "fg" && hasSmallSample(row) ? "*" : "");
  const smallSample = (side: Side) =>
    selectedStage
      ? hasSmallSample(selectedStage[side])
      : totals[side].fg[zone] != null &&
        totals[side].fgAttempts[zone] < MIN_ZONE_FGA;
  const comparisons = (selectedStage ? sides : ["peer" as const]).flatMap(
    (side) => {
      const origin = careerValue(
        selectedStage ? totals[side] : totals.target,
        metric,
        zone,
      );
      const now = selectedStage
        ? measurement(selectedStage[side], metric, zone)
        : careerValue(totals.peer, metric, zone);
      if (origin == null || now == null) return [];
      return (
        (selectedStage ? references[side].name + " " : "") +
        signed(now - origin)
      );
    },
  );
  const selectYear = (year: number) =>
    onStage(year === selectedStage?.year ? null : year);
  const markerX = selectedStage ? x(selectedStage.year) : left;
  const scope = selectedStage
    ? t(
        `Current season · Year ${selectedStage.year}`,
        `当前赛季 · 第${selectedStage.year}季`,
      )
    : t("Career to date", "生涯至今");

  return (
    <section className="peer-career" id="peer-follow-up" aria-labelledby={id}>
      <header className="peer-career-head">
        <div className="peer-career-title">
          <h3 id={id}>{t("Career shooting trends", "生涯投篮走势")}</h3>
          <span aria-live="polite">{scope}</span>
        </div>
        <div className="peer-trend-controls">
          <select
            aria-label={t("Trend metric", "趋势指标")}
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
          >
            <optgroup label={t("Shooting zones", "投篮区域")}>
              {names.map((name, i) => (
                <option value={"zone-" + i} key={name}>
                  {name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("Overall performance", "全季表现")}>
              {(["rts", "points", "volume"] as const).map((m) => (
                <option key={m} value={m}>
                  {labels[m]}
                </option>
              ))}
            </optgroup>
          </select>
          {isZoneMetric && (
            <div
              className="ap-switch"
              role="group"
              aria-label={t("Zone measure", "投篮指标")}
            >
              {(["share", "fg"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={zoneMeasure === choice}
                  onClick={() => setZoneMeasure(choice)}
                >
                  {choice === "share"
                    ? t("Attempt share", "出手占比")
                    : labels.fg}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div
        className="peer-trend-keys"
        aria-label={t("Player shooting statistics", "球员投篮数据")}
      >
        {sides.map((side) => {
          const row = selectedStage?.[side];
          const career = totals[side];
          return (
            <div key={side} className={"peer-trend-key pt-" + side}>
              <span className="peer-trend-swatch" aria-hidden="true" />
              <strong>{references[side].name}</strong>
              <span>
                {selectedStage
                  ? seasonInfo(row, selectedStage.year, career, t)
                  : seasonRange(career.firstSeason, career.lastSeason)}
              </span>
              <b>
                {selectedStage
                  ? valueForSeason(row)
                  : format(careerValue(career, metric, zone)) +
                    (metric === "fg" && smallSample(side) ? "*" : "")}
              </b>
            </div>
          );
        })}
      </div>
      <div className="peer-trend-figure" ref={frame}>
        <svg
          viewBox={"0 0 " + width + " " + figureHeight}
          height={figureHeight}
          role="group"
          aria-label={t("Select a career year", "选择生涯赛季")}
        >
          <g className="peer-trend-plot" data-metric={metric}>
            {ticks.map((v) => (
              <g className="peer-trend-grid" key={v} aria-hidden="true">
                <line x1={left} x2={right} y1={y(v)} y2={y(v)} />
                <text
                  x={left - 6}
                  y={y(v)}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {v}
                  {isZoneMetric && "%"}
                </text>
              </g>
            ))}
            {selectedStage && (
              <path
                className="peer-trend-current"
                aria-hidden="true"
                d={`M${markerX} ${top}v${plotHeight}`}
              />
            )}
            {sides.map((side) => {
              const vals = series[side];
              const path = vals
                .map((v, i) =>
                  v == null
                    ? ""
                    : (i > 0 &&
                      vals[i - 1] != null &&
                      seasons[i - 1].year + 1 === seasons[i].year
                        ? "L"
                        : "M") +
                      x(seasons[i].year) +
                      "," +
                      y(v),
                )
                .join(" ");
              return (
                <g
                  className={"peer-trend-series pt-" + side}
                  key={side}
                  aria-hidden="true"
                >
                  <path d={path} />
                  {vals.map((v, i) => {
                    if (v == null) return null;
                    const cx = x(seasons[i].year),
                      cy = y(v);
                    const active = seasons[i].year === selectedStage?.year;
                    const radius = active ? 5 : 2.4;
                    return side === "target" ? (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        className={active ? "is-active" : undefined}
                      />
                    ) : (
                      <rect
                        key={i}
                        x={cx - radius * 0.8}
                        y={cy - radius * 0.8}
                        width={radius * 1.6}
                        height={radius * 1.6}
                        transform={`rotate(45 ${cx} ${cy})`}
                        className={active ? "is-active" : undefined}
                      />
                    );
                  })}
                </g>
              );
            })}
            {labelsX.map(({ year }) => (
              <text
                className="peer-trend-tick"
                key={year}
                x={x(year)}
                y={bottom + 19}
                textAnchor="middle"
                aria-hidden="true"
              >
                {year}
              </text>
            ))}
            {available.map((stage, i) => {
              const year = stage.year;
              const start = year === first ? left - 5 : x(year) - spacing / 2;
              const end = year === last ? right + 5 : x(year) + spacing / 2;
              return (
                <rect
                  key={year}
                  className="peer-trend-hit"
                  x={start}
                  width={Math.max(1, end - start)}
                  y={top - 5}
                  height={bottom - top + 27}
                  role="button"
                  data-career-year={year}
                  aria-label={t(
                    `View career year ${year}`,
                    `查看生涯第 ${year} 季`,
                  )}
                  aria-description={sides
                    .map((side) =>
                      [
                        references[side].name,
                        seasonInfo(stage[side], stage.year, totals[side], t),
                        metricLabel + " " + valueForSeason(stage[side]),
                      ].join(" · "),
                    )
                    .join(t(". ", "。"))}
                  aria-pressed={selectedStage?.year === year}
                  tabIndex={
                    year === (selectedStage?.year ?? available[0].year) ? 0 : -1
                  }
                  onClick={() => selectYear(year)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!e.repeat) selectYear(year);
                      return;
                    }
                    let next = i;
                    if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
                    else if (e.key === "ArrowRight")
                      next = Math.min(available.length - 1, i + 1);
                    else if (e.key === "Home") next = 0;
                    else if (e.key === "End") next = available.length - 1;
                    else if (e.key === "Escape") {
                      onStage(null);
                      return;
                    } else return;
                    e.preventDefault();
                    frame.current
                      ?.querySelector<SVGRectElement>(
                        `[data-career-year="${available[next].year}"]`,
                      )
                      ?.focus();
                  }}
                />
              );
            })}
          </g>
        </svg>
      </div>
      <div className="peer-trend-foot">
        <div className="peer-trend-caption">
          <span>{t("Career year", "生涯赛季")}</span>
          {selectedStage ? (
            <button type="button" onClick={() => onStage(null)}>
              {t("Back to career totals", "返回生涯至今")}
            </button>
          ) : (
            <span>{t("Select a season to explore", "点击赛季查看")}</span>
          )}
        </div>
        <p className="peer-trend-summary" aria-live="polite">
          {comparisons.length
            ? (selectedStage
                ? t(
                    "Compared with each player's career · " +
                      metricLabel +
                      " · ",
                    "与各自生涯相比 · " + metricLabel + " · ",
                  )
                : t(
                    `Career difference (${baseline.name} − ${anchor.name}) · `,
                    `生涯差值（${baseline.name} − ${anchor.name}） · `,
                  ) +
                  metricLabel +
                  " · ") +
              comparisons.join(" / ") +
              t(" (" + summaryUnit + ")", "（" + summaryUnit + "）")
            : t("No comparable shooting records.", "缺少可比较的投篮记录。")}
        </p>
      </div>
      {metric === "fg" && sides.some(smallSample) && (
        <p className="peer-trend-note">
          {t(
            "* Fewer than 25 estimated attempts in the zone.",
            "* 该区估算出手少于 25 次。",
          )}
        </p>
      )}
    </section>
  );
}
