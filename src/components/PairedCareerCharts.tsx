import type { ShiftActions } from "./CareerShifts";
import { useMemo, useState } from "react";
import {
  fga36,
  percent,
  pp,
  seasonLabel,
  shortName,
  PLAYER_COLORS,
} from "../lib/analysis";
import { pairedCareer } from "../lib/paired-career";
import CareerMixBars from "./CareerMixBars";
import type { SeasonRow, Translate } from "../lib/types";
import SeasonShotPies from "./SeasonShotPies";
import { bandNames } from "./TransitionCharts";

type Metric = "rts" | "share" | "fg" | "volume";
function value(r: SeasonRow | undefined, metric: Metric, band: number) {
  if (!r) return null;
  if (metric === "rts") return r.rts;
  if (metric === "volume") return fga36(r);
  const v =
    metric === "share"
      ? r.shares[band]
      : r.shares[band] === 0
        ? null
        : r.fg[band];
  return v == null ? null : v * 100;
}
function display(n: number | null, metric: Metric) {
  if (n == null) return "—";
  if (metric === "rts") return pp(n);
  return n.toFixed(1) + (metric === "volume" ? "" : "%");
}
export default function PairedCareerCharts({
  shifts,
  onShift,
  rows,
  peerRows,
  a,
  b,
  peerEnd,
  zone,
  band,
  onZone,
  onPick,
  t,
}: ShiftActions & {
  rows: SeasonRow[];
  peerRows: SeasonRow[];
  a: SeasonRow;
  b: SeasonRow;
  peerEnd: SeasonRow;
  zone: number | null;
  band: number;
  onZone: (z: number | null) => void;
  onPick: (r: SeasonRow) => void;
  t: Translate;
}) {
  const timeline = useMemo(
    () => pairedCareer(rows, peerRows, b.season, peerEnd.season),
    [rows, peerRows, b, peerEnd],
  );
  const [offset, setOffset] = useState(0),
    [metric, setMetric] = useState<Metric>("rts");
  const focus =
    timeline.find((col) => col.offset === offset) ??
    timeline.find((col) => col.offset === 0)!;
  const players = [b, peerEnd],
    start = a.season - b.season,
    names = bandNames(t);
  const ageAt = (offset: number) => b.age! + offset;
  const series = players.map((_, i) =>
    timeline.map((col) => value(col.rows[i], metric, band)),
  );
  const observed = series.flat().filter((v): v is number => v != null);
  const step = metric === "rts" ? 5 : metric === "volume" ? 5 : 10;
  const low =
    metric === "rts" ? Math.floor(Math.min(-1, ...observed) / step) * step : 0;
  const high = Math.ceil(Math.max(1, ...observed) / step) * step;
  const left = 35,
    right = 598,
    top = 11,
    bottom = 110;
  const x = (i: number) => left + ((right - left) * i) / (timeline.length - 1);
  const y = (n: number) => top + ((high - n) / (high - low)) * (bottom - top);
  const ticks = [
    ...new Set([high, metric === "rts" ? 0 : (high + low) / 2, low]),
  ];
  const metricNames = {
    rts: "rTS",
    share: t("Shot share", "出手占比"),
    fg: t("FG%", "命中率"),
    volume: t("FGA / 36", "每36分钟出手"),
  };
  const focusIndex = timeline.indexOf(focus);
  const windowStartX = x(start - timeline[0].offset);
  const windowEndX = x(-timeline[0].offset);
  const metricUnit =
    metric === "rts"
      ? "pp"
      : metric === "volume"
        ? t("FGA / 36", "出手 / 36 分钟")
        : "%";
  return (
    <>
      <CareerMixBars
        shifts={shifts}
        onShift={onShift}
        timeline={timeline}
        players={players}
        focusIndex={focusIndex}
        startOffset={start}
        zone={zone}
        onZone={onZone}
        onOffset={setOffset}
        onPick={onPick}
        t={t}
      />
      <SeasonShotPies
        players={players}
        rows={focus.rows}
        years={focus.years}
        phase={t(`Age ${ageAt(focus.offset)}`, `${ageAt(focus.offset)} 岁`)}
        zone={zone}
        onZone={onZone}
        previous={
          focusIndex > 0
            ? () => setOffset(timeline[focusIndex - 1].offset)
            : undefined
        }
        next={
          focusIndex < timeline.length - 1
            ? () => setOffset(timeline[focusIndex + 1].offset)
            : undefined
        }
        t={t}
      />
      <section className="ct-panel pc-trend">
        <div className="ct-panel-head">
          <h2>{t("Efficiency & shot selection", "得分效率与出手趋势")}</h2>
          <select
            value={metric}
            aria-label={t("Trend metric", "趋势指标")}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {(Object.keys(metricNames) as Metric[]).map((k) => (
              <option key={k} value={k}>
                {metricNames[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="pc-chart-legend">
          {players.map((r, i) => (
            <span key={r.id}>
              <i
                className={"pc-line-key key-" + i}
                style={{ color: PLAYER_COLORS[i] }}
              />
              {shortName(r.name)}
            </span>
          ))}
          <small>
            {metric === "share" || metric === "fg" ? names[band] + " · " : ""}
            {metricUnit}
          </small>
        </div>
        <svg
          viewBox="0 0 616 134"
          className="pc-line-chart"
          role="group"
          aria-label={t(
            "Career trends by age with the comparison window shaded",
            "按年龄对齐的生涯走势，底色标出本次观察区间",
          )}
        >
          <rect
            x={windowStartX}
            y={top}
            width={windowEndX - windowStartX}
            height={bottom - top}
            fill="var(--selected)"
          />
          {ticks.map((n) => (
            <g key={n}>
              <line
                x1={left}
                x2={right}
                y1={y(n)}
                y2={y(n)}
                stroke={n === 0 ? "var(--control-line)" : "var(--line)"}
                strokeDasharray={n === 0 ? "4 3" : undefined}
              />
              <text x={left - 7} y={y(n) + 4} textAnchor="end">
                {n}
              </text>
            </g>
          ))}
          <line
            x1={x(focusIndex)}
            x2={x(focusIndex)}
            y1={top}
            y2={bottom}
            stroke="var(--control-line)"
            strokeDasharray="2 3"
          />
          {series.map((line, j) => (
            <g key={j} stroke={PLAYER_COLORS[j]} fill="none">
              <path
                d={line
                  .map((n, i) =>
                    n == null
                      ? ""
                      : (i === 0 || line[i - 1] == null ? "M" : "L") +
                        x(i) +
                        " " +
                        y(n),
                  )
                  .join(" ")}
                strokeWidth="2.5"
                strokeDasharray={j ? "6 3" : undefined}
              />
              {line.map((n, i) =>
                n == null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(n)}
                    r={i === focusIndex ? 4.3 : 2.5}
                    fill={j ? "var(--panel)" : PLAYER_COLORS[j]}
                    strokeWidth="1.8"
                  />
                ),
              )}
            </g>
          ))}
          {timeline.map((col, i) => (
            <g key={col.offset}>
              <text x={x(i)} y={128} textAnchor="middle">
                {ageAt(col.offset)}
              </text>
              <rect
                role="button"
                tabIndex={0}
                aria-label={t(
                  `Inspect age ${ageAt(col.offset)}`,
                  `查看 ${ageAt(col.offset)} 岁赛季`,
                )}
                aria-pressed={focus === col}
                x={
                  x(i) -
                  Math.min(17, (right - left) / (timeline.length - 1) / 2)
                }
                width={Math.min(34, (right - left) / (timeline.length - 1))}
                y={top}
                height={bottom - top + 20}
                fill="transparent"
                onClick={() => setOffset(col.offset)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOffset(col.offset);
                  }
                }}
              >
                <title>
                  {t(`Age ${ageAt(col.offset)}`, `${ageAt(col.offset)} 岁`) +
                    " · " +
                    players
                      .map(
                        (r, j) =>
                          shortName(r.name) +
                          " " +
                          display(series[j][i], metric),
                      )
                      .join(" / ")}
                </title>
              </rect>
            </g>
          ))}
        </svg>
        <div className="pc-readouts">
          {players.map((r, i) => (
            <span key={r.id}>
              <i style={{ background: PLAYER_COLORS[i] }} />
              {shortName(r.name)} ·{" "}
              {focus.years[i] == null
                ? t("No season", "无赛季记录")
                : seasonLabel(focus.years[i])}{" "}
              <b>{display(series[i][focusIndex], metric)}</b>
            </span>
          ))}
        </div>
        <div className="ct-panel-note">
          {metric === "rts"
            ? t(
                "Age on the horizontal axis. Shading marks the comparison window. An rTS of 0 is league average.",
                "横轴为年龄，浅色底纹标出本次观察区间。rTS 为 0 表示当季联盟平均。",
              )
            : t(
                "Age on the horizontal axis. Shading marks the comparison window. Gaps indicate missing records.",
                "横轴为年龄，浅色底纹标出本次观察区间。断线表示缺少数据。",
              )}
        </div>
      </section>
    </>
  );
}
