import { Fragment, useId } from "react";
import { percent } from "../lib/analysis";
import type { Translate } from "../lib/types";

interface RadarSeries {
  label: string;
  color: string;
  peer: boolean;
  values: (number | null)[];
  lowSample?: boolean[];
}

// Five distance zones clockwise from the rim. Each axis runs from 0 to 100%.
const center = { x: 176, y: 120 };
const spokes = [
  { labelX: 176, labelY: 11 },
  { labelX: 302, labelY: 73 },
  { labelX: 235, labelY: 208 },
  { labelX: 117, labelY: 208 },
  { labelX: 50, labelY: 73 },
].map((label, i) => {
  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
  return { ...label, dx: 88 * Math.cos(angle), dy: 88 * Math.sin(angle) };
});

function point(axis: number, value: number) {
  return {
    x: center.x + spokes[axis].dx * value,
    y: center.y + spokes[axis].dy * value,
  };
}

function valueLabel(series: RadarSeries, axis: number) {
  return percent(series.values[axis]) + (series.lowSample?.[axis] ? "*" : "");
}

export default function PeerZoneRadar({
  zones,
  series,
  metric,
  title,
  t,
}: {
  zones: string[];
  series: RadarSeries[];
  metric: string;
  title: string;
  t: Translate;
}) {
  const id = useId();
  if (!series.some((s) => s.values.some((v) => v != null))) {
    return (
      <p className="ap-empty">
        {t("No zone data available.", "暂无投篮分区数据。")}
      </p>
    );
  }
  const smallSample = series.some((s) => s.lowSample?.some(Boolean));
  const sampleNote = t(
    "* Fewer than 25 estimated attempts in this zone.",
    "* 该区估算出手少于 25 次。",
  );
  const description = zones
    .map(
      (zone, i) =>
        `${zone} · ${series.map((s) => s.label + " " + (s.values[i] == null ? t("unavailable", "暂无数据") : valueLabel(s, i))).join(" / ")}`,
    )
    .join(". ");
  return (
    <div className="ap-radar">
      <svg
        viewBox="0 0 352 229"
        role="img"
        aria-labelledby={id + "-title"}
        aria-describedby={id + "-desc"}
      >
        <title id={id + "-title"}>
          {title +
            " · " +
            metric +
            " · " +
            t("Shot profile radar", "投篮雷达图")}
        </title>
        <desc id={id + "-desc"}>
          {description + (smallSample ? ". " + sampleNote : "")}
        </desc>
        <g className="ap-radar-grid">
          {[0.25, 0.5, 0.75, 1].map((tick) => (
            <polygon
              key={tick}
              points={spokes
                .map((_, i) => {
                  const { x, y } = point(i, tick);
                  return x + "," + y;
                })
                .join(" ")}
            />
          ))}
          {spokes.map((_, i) => {
            const { x, y } = point(i, 1);
            return <line key={i} x1={center.x} y1={center.y} x2={x} y2={y} />;
          })}
        </g>
        {series.map((s) => {
          const points = s.values.map((value, i) =>
            value == null ? null : point(i, value),
          );
          return (
            <g
              key={s.peer ? "peer" : "player"}
              className={"ap-radar-series" + (s.peer ? " peer" : "")}
              style={{ color: s.color }}
            >
              {points.every((p) => p !== null) ? (
                <polygon
                  points={points.map((p) => p.x + "," + p.y).join(" ")}
                />
              ) : (
                points.map((p, i) => {
                  const next = points[(i + 1) % points.length];
                  return (
                    p &&
                    next && (
                      <line key={i} x1={p.x} y1={p.y} x2={next.x} y2={next.y} />
                    )
                  );
                })
              )}
              {points.map(
                (p, i) =>
                  p &&
                  (s.peer ? (
                    <rect
                      key={i}
                      x={p.x - 3}
                      y={p.y - 3}
                      width={6}
                      height={6}
                    />
                  ) : (
                    <circle key={i} cx={p.x} cy={p.y} r={2.6} />
                  )),
              )}
            </g>
          );
        })}
        {[0.5, 1].map((tick) => (
          <text
            key={tick}
            className="ap-radar-tick"
            textAnchor="middle"
            x={center.x}
            y={center.y + spokes[2].dy * tick + 10}
          >
            {percent(tick, 0)}
          </text>
        ))}
        {spokes.map(({ labelX, labelY }, i) => (
          <g key={i} textAnchor="middle">
            <text className="ap-radar-zone" x={labelX} y={labelY}>
              {zones[i]}
            </text>
            <text className="ap-radar-values" x={labelX} y={labelY + 15}>
              {series.map((s, j) => (
                <Fragment key={s.peer ? "peer" : "player"}>
                  {j > 0 && <tspan className="ap-radar-divider"> / </tspan>}
                  <tspan fill={s.color}>{valueLabel(s, i)}</tspan>
                </Fragment>
              ))}
            </text>
          </g>
        ))}
      </svg>
      {smallSample && <small>{sampleNote}</small>}
    </div>
  );
}
