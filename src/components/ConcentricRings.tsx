import { useEffect, useId, useRef, useState } from "react";
import { percent, seasonLabel } from "../lib/analysis";
import { colorAt, valueAt, type Metric } from "../lib/ring-encoding";
import type { SeasonRow, Translate } from "../lib/types";
import "./concentric-lens.css";

interface Props {
  ages: number[];
  byAge: ReadonlyMap<number, SeasonRow>;
  selected: SeasonRow;
  metric: Metric;
  zone: number | null;
  names: string[];
  ringLabels: string[];
  t: Translate;
  onSelect: (row: SeasonRow) => void;
}

const innerRadius = 35,
  outerRadius = 102;
function point(r: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function sector(inner: number, outer: number, zone: number, halfAngle = 35.5) {
  const direction = -90 + zone * 72;
  const left = direction - halfAngle,
    right = direction + halfAngle;
  return `M ${point(inner, left)} L ${point(outer, left)} A ${outer} ${outer} 0 0 1 ${point(outer, right)} L ${point(inner, right)} A ${inner} ${inner} 0 0 0 ${point(inner, left)} Z`;
}

interface HoverCell {
  rowId: string;
  zone: number;
  input: "pointer" | "touch";
}

export default function ConcentricRings({
  ages,
  byAge,
  selected,
  metric,
  zone,
  names,
  ringLabels,
  t,
  onSelect,
}: Props) {
  const id = useId().replace(/:/g, "");
  const figure = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<HoverCell | null>(null);
  // A value of -1 indicates age navigation with the existing slider/arrows.
  const [keyboard, setKeyboard] = useState<number | null>(null);
  useEffect(() => {
    const section = figure.current?.closest(".career-rings");
    if (!section) return;
    const inspectControls = () => {
      const el = document.activeElement;
      let next: number | null = null;
      if (
        el instanceof HTMLElement &&
        section.contains(el) &&
        el.matches(":focus-visible")
      ) {
        if (el.closest(".cr-scrubber")) next = -1;
        if (el.matches("button[data-ring-zone]")) {
          next = Number(el.dataset.ringZone);
        }
      }
      setKeyboard(next);
      if (next != null) setHover(null);
    };
    const dropFocus = () => setKeyboard(null);
    const releaseTouch = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !figure.current?.contains(event.target)
      )
        setHover(null);
    };
    section.addEventListener("focusin", inspectControls);
    section.addEventListener("focusout", dropFocus);
    section.addEventListener("keydown", inspectControls);
    document.addEventListener("pointerdown", releaseTouch);
    return () => {
      section.removeEventListener("focusin", inspectControls);
      section.removeEventListener("focusout", dropFocus);
      section.removeEventListener("keydown", inspectControls);
      document.removeEventListener("pointerdown", releaseTouch);
    };
  }, []);

  const index = selected.age == null ? -1 : ages.indexOf(selected.age);
  const width = (outerRadius - innerRadius) / Math.max(ages.length, 1);
  const pad = Math.min(0.55, width * 0.1);
  const direct = hover?.rowId === selected.id ? hover : null;
  const zoneIndex =
    direct?.zone ??
    (keyboard == null ? null : keyboard < 0 ? (zone ?? 0) : keyboard);
  const active = index >= 0 && zoneIndex != null && zoneIndex < names.length;
  const inside = innerRadius + index * width;
  const lensWidth = Math.min(
    outerRadius - innerRadius,
    Math.max(width * 1.7, 17),
  );
  const lensStart = Math.max(
    innerRadius,
    Math.min(outerRadius - lensWidth, inside + width / 2 - lensWidth / 2),
  );
  const value = active ? valueAt(selected, metric, zoneIndex!) : null;
  const [labelX, labelY] = point(
    lensStart + lensWidth / 2,
    -90 + (zoneIndex ?? 0) * 72,
  );
  const metricLabel =
    metric === "share"
      ? t("Attempt share", "出手占比")
      : t("Field goal %", "命中率");
  const missing = t("No data", "无数据");
  const fill = (v: number | null) =>
    v == null ? `url(#${id}-missing)` : colorAt(v);
  const readout = active
    ? t(`Age ${selected.age}`, `${selected.age} 岁`) +
      " · " +
      names[zoneIndex!] +
      " · " +
      metricLabel +
      " " +
      (value == null ? missing : percent(value))
    : "";
  function inspect(
    row: SeasonRow | undefined,
    k: number,
    input: HoverCell["input"],
  ) {
    setKeyboard(null);
    if (!row) {
      setHover(null);
      return;
    }
    setHover((previous) =>
      previous?.rowId === row.id &&
      previous.zone === k &&
      previous.input === input
        ? previous
        : { rowId: row.id, zone: k, input },
    );
    if (row.id !== selected.id) onSelect(row);
  }
  return (
    <figure className="cr-figure cr-concentric" ref={figure}>
      <svg
        viewBox="-145 -124 290 237"
        role="img"
        aria-labelledby={id + "-ring-title " + id + "-ring-desc"}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") setHover(null);
        }}
      >
        <title id={id + "-ring-title"}>
          {selected.name + " · " + t("Career rings", "生涯年轮")}
        </title>
        <desc id={id + "-ring-desc"}>
          {t(
            "Each outward ring advances one year of age. Five sectors show shooting distances. Color measures ",
            "由内向外每圈增加一岁，五个扇区代表出手距离。颜色表示",
          ) +
            metricLabel +
            t(".", "。")}{" "}
          {readout}
        </desc>
        <defs>
          <pattern
            id={id + "-missing"}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(40)"
          >
            <rect width="4" height="4" fill="#243136" />
            <path d="M 0 0 V 4" stroke="#6d797a" strokeWidth="1.4" />
          </pattern>
        </defs>
        <g className="cr-cells" pointerEvents="none">
          {ages.map((age, i) => {
            const row = byAge.get(age),
              r = innerRadius + i * width;
            return (
              <g
                key={age}
                data-age={age}
                className={row ? "cr-ring" : undefined}
              >
                {names.map((name, k) => {
                  const v = valueAt(row, metric, k);
                  return (
                    <path
                      key={k}
                      data-zone={k}
                      d={sector(r + pad, r + width - pad, k)}
                      fill={fill(v)}
                      opacity={zone == null || zone === k ? 1 : 0.47}
                    >
                      <title>
                        {t(`Age ${age}`, `${age} 岁`) +
                          " · " +
                          name +
                          " · " +
                          (v == null ? missing : percent(v))}
                      </title>
                    </path>
                  );
                })}
              </g>
            );
          })}
        </g>
        {index >= 0 && (
          <g pointerEvents="none" className="cr-selected-ring">
            <circle r={inside + 0.2} />
            <circle r={inside + width - 0.2} />
          </g>
        )}
        {active && (
          <g
            className="cr-cell-lens"
            data-lens-age={selected.age}
            data-lens-zone={zoneIndex}
            data-lens-input={direct?.input ?? "keyboard"}
            pointerEvents="none"
            aria-hidden="true"
          >
            <path
              data-original-thickness={width - 2 * pad}
              data-lens-thickness={lensWidth}
              d={sector(lensStart, lensStart + lensWidth, zoneIndex!, 41)}
              fill={fill(value)}
            />
            <text
              x={labelX}
              y={labelY}
              dy=".34em"
              fill={value != null && value >= 0.34 ? "#102521" : "#fff9ee"}
            >
              {value == null ? "—" : percent(value)}
            </text>
          </g>
        )}
        {ringLabels.map((label, i) => {
          const angle = -90 + i * 72,
            [x, y] = point(111, angle),
            [x1, y1] = point(104, angle),
            [x2, y2] = point(108, angle);
          return (
            <g
              key={i}
              className={
                "cr-sector-label" + (zone === i ? " cr-sector-active" : "")
              }
              pointerEvents="none"
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <text
                x={x}
                y={y}
                dy={i === 0 ? -1 : 4}
                textAnchor={i === 0 ? "middle" : i < 3 ? "start" : "end"}
              >
                {label}
              </text>
            </g>
          );
        })}
        <g className="cr-hub" textAnchor="middle" pointerEvents="none">
          <text y="-12" className="cr-hub-label">
            {t("AGE", "年龄")}
          </text>
          <text y="13" className="cr-hub-age">
            {selected.age ?? "—"}
          </text>
          <text y="25" className="cr-hub-season">
            {seasonLabel(selected.season)}
          </text>
        </g>
        {/* Fixed, gap-free hit cells. The enlarged arc never participates in hit testing. */}
        <g
          className="cr-hit-grid"
          onPointerLeave={(e) => {
            if (e.pointerType !== "touch") setHover(null);
          }}
        >
          {ages.map((age, i) => {
            const row = byAge.get(age),
              r = innerRadius + i * width;
            return (
              <g key={age} data-hit-age={age}>
                {names.map((_, k) => (
                  <path
                    key={k}
                    data-hit-zone={k}
                    d={sector(r, r + width, k, 36)}
                    fill="transparent"
                    onPointerMove={(e) => {
                      if (e.pointerType !== "touch") inspect(row, k, "pointer");
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "touch") inspect(row, k, "pointer");
                    }}
                    onClick={(e) =>
                      inspect(
                        row,
                        k,
                        (e.nativeEvent as PointerEvent).pointerType === "touch"
                          ? "touch"
                          : "pointer",
                      )
                    }
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption data-lens-active={active}>
        <span className="cr-lens-readout" aria-live={direct ? "off" : "polite"}>
          {readout}
        </span>
        {!active &&
          t(
            "Age increases outward · Hover or tap to enlarge",
            "由内向外年龄递增 · 悬停或轻触放大",
          )}
      </figcaption>
    </figure>
  );
}
