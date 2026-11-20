import { useEffect, useEffectEvent, useId, useRef } from "react";
import { percent, seasonLabel } from "../lib/analysis";
import { colorAt, valueAt, type Metric } from "../lib/ring-encoding";
import type { SeasonRow, Translate } from "../lib/types";
import "./season-dial.css";

interface Props {
  ages: number[];
  byAge: ReadonlyMap<number, SeasonRow>;
  selected: SeasonRow;
  metric: Metric;
  zone: number | null;
  names: string[];
  t: Translate;
  onSelect: (row: SeasonRow) => void;
}

// Angles run clockwise from twelve o'clock. The break separates the career endpoints.
const startAngle = 18;
const sweep = 324;
const overview = { inner: 90, outer: 114 };
const lens = { inner: 32, outer: 84 };
const hitInner = 87;
const hitOuter = 135;

function point(r: number, degrees: number) {
  const theta = (degrees * Math.PI) / 180;
  return [r * Math.sin(theta), -r * Math.cos(theta)];
}

function arc(r: number, a: number, b: number, clockwise: boolean) {
  return `A ${r} ${r} 0 ${Math.abs(b - a) > 180 ? 1 : 0} ${clockwise ? 1 : 0} ${point(r, b).join(" ")}`;
}

function sector(inner: number, outer: number, a: number, b: number) {
  return `M ${point(outer, a).join(" ")} ${arc(outer, a, b, true)} L ${point(inner, b).join(" ")} ${arc(inner, b, a, false)} Z`;
}

function AgeWedge({
  row,
  metric,
  zone,
  names,
  a,
  b,
  enlarged,
  hatch,
}: {
  row: SeasonRow | undefined;
  metric: Metric;
  zone: number | null;
  names: string[];
  a: number;
  b: number;
  enlarged?: boolean;
  hatch: string;
}) {
  const { inner, outer } = enlarged ? lens : overview;
  const bandWidth = (outer - inner) / names.length;
  return (
    <g
      className={enlarged ? "sd-lens-bands" : "sd-age-bands"}
      data-dial-age={row?.age}
    >
      {names.map((name, i) => {
        const value = valueAt(row, metric, i);
        const r = inner + bandWidth * i;
        return (
          <path
            key={i}
            opacity={zone == null || zone === i ? 1 : 0.57}
            d={sector(r + 0.21, r + bandWidth - 0.21, a, b)}
            fill={value == null ? hatch : colorAt(value)}
          >
            <title>{name + " · " + percent(value)}</title>
          </path>
        );
      })}
    </g>
  );
}

export default function SeasonDial({
  ages,
  byAge,
  selected,
  metric,
  zone,
  names,
  t,
  onSelect,
}: Props) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const angleStep = sweep / Math.max(1, ages.length);
  const chosen = ages.indexOf(selected.age ?? NaN);
  const angle = startAngle + (chosen + 0.5) * angleStep;
  // The inset has larger radial AND angular marks, while the overview never moves.
  const expandedSpan = Math.min(sweep, Math.max(66, angleStep * 1.45));
  const hatch = `url(#${id}-missing)`;
  const stride = Math.max(1, Math.ceil(ages.length / 8));
  const labels = ages
    .map((_, i) => i)
    .filter(
      (i) =>
        i === 0 ||
        i === ages.length - 1 ||
        (i % stride === 0 && (ages.length - 1 - i) * angleStep >= 22),
    );

  function readAt(clientX: number, clientY: number, precise: boolean) {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm || !ages.length) return false;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const radius = Math.hypot(p.x, p.y);
    if (radius < hitInner || radius > hitOuter) return false;
    const degrees = ((Math.atan2(p.x, -p.y) * 180) / Math.PI + 360) % 360;
    if (degrees < startAngle || degrees >= startAngle + sweep) return false;
    const offset = (degrees - startAngle) / angleStep;
    const i = Math.floor(offset);
    if (!precise && chosen >= 0 && Math.abs(i - chosen) === 1) {
      const boundary = Math.max(i, chosen);
      if (
        Math.abs(offset - boundary) * angleStep <
        Math.min(1.1, angleStep * 0.08)
      )
        return false;
    }
    const row = byAge.get(ages[i]);
    if (row && selected.id !== row.id) onSelect(row);
    return true;
  }

  const readTouch = useEffectEvent(readAt);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Chromium may ignore touch-action on an SVG stroke and claim the drag as page panning.
    // Only a gesture that starts on the angular rail belongs to this chart.
    let finger: number | null = null;
    function start(event: TouchEvent) {
      if (finger != null || event.touches.length !== 1) return;
      const touch = event.changedTouches[0];
      if (touch && readTouch(touch.clientX, touch.clientY, true)) {
        finger = touch.identifier;
        if (event.cancelable) event.preventDefault();
      }
    }
    function move(event: TouchEvent) {
      if (finger == null) return;
      const touch = Array.from(event.changedTouches).find(
        (t) => t.identifier === finger,
      );
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      readTouch(touch.clientX, touch.clientY, false);
    }
    function end(event: TouchEvent) {
      if (Array.from(event.changedTouches).some((t) => t.identifier === finger))
        finger = null;
    }
    svg.addEventListener("touchstart", start, { passive: false });
    svg.addEventListener("touchmove", move, { passive: false });
    svg.addEventListener("touchend", end);
    svg.addEventListener("touchcancel", end);
    return () => {
      svg.removeEventListener("touchstart", start);
      svg.removeEventListener("touchmove", move);
      svg.removeEventListener("touchend", end);
      svg.removeEventListener("touchcancel", end);
    };
  }, []);

  return (
    <figure className="season-dial">
      <svg
        ref={svgRef}
        viewBox="-144 -143 288 286"
        role="img"
        aria-labelledby={id + "-title " + id + "-desc"}
      >
        <title id={id + "-title"}>
          {selected.name +
            " · " +
            t("Season dial", "圆周放大") +
            " · " +
            seasonLabel(selected.season)}
        </title>
        <desc id={id + "-desc"}>
          {t(
            "Ages run clockwise along the rim. The enlarged inner wedge shows the selected season. Distance increases from the rim zone on the innermost band to three-pointers on the outermost band.",
            "沿外缘顺时针逐岁排列，内侧放大所选赛季。从最内层到最外层依次是篮下、近距离两分、中距离、长两分和三分。",
          )}
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
            <path d="M 0 0 V 4" stroke="#768582" strokeWidth="1.4" />
          </pattern>
        </defs>
        {ages.map((age, i) => {
          const a = startAngle + i * angleStep + 0.45,
            b = startAngle + (i + 1) * angleStep - 0.45;
          return (
            <AgeWedge
              key={age}
              row={byAge.get(age)}
              metric={metric}
              zone={zone}
              names={names}
              a={a}
              b={b}
              hatch={hatch}
            />
          );
        })}
        {chosen >= 0 && (
          <g className="sd-focus" pointerEvents="none">
            <path
              d={sector(
                overview.inner - 0.5,
                overview.outer + 0.6,
                angle - angleStep / 2 + 0.35,
                angle + angleStep / 2 - 0.35,
              )}
              className="sd-focus-outline"
            />
            <path
              d={`M ${point(overview.inner, angle - angleStep / 2 + 0.35).join(" ")} L ${point(lens.outer, angle - expandedSpan / 2).join(" ")} M ${point(overview.inner, angle + angleStep / 2 - 0.35).join(" ")} L ${point(lens.outer, angle + expandedSpan / 2).join(" ")}`}
              className="sd-focus-guide"
            />
            <AgeWedge
              row={selected}
              metric={metric}
              zone={zone}
              names={names}
              a={angle - expandedSpan / 2}
              b={angle + expandedSpan / 2}
              hatch={hatch}
              enlarged
            />
            <path
              d={sector(
                lens.inner,
                lens.outer,
                angle - expandedSpan / 2,
                angle + expandedSpan / 2,
              )}
              className="sd-lens-outline"
            />
          </g>
        )}
        {labels.map((i) => {
          const mid = startAngle + (i + 0.5) * angleStep;
          const [x, y] = point(126, mid),
            [x1, y1] = point(116, mid),
            [x2, y2] = point(120, mid);
          return (
            <g
              key={i}
              className={"sd-age-label" + (i === chosen ? " sd-current" : "")}
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <text x={x} y={y}>
                {ages[i]}
              </text>
            </g>
          );
        })}
        {ages.length > 1 && (
          <g className="sd-direction" aria-hidden="true">
            <path
              d={`M ${point(103, startAngle - 12).join(" ")} ${arc(103, startAngle - 12, startAngle - 3, true)}`}
            />
            <path
              d={`M ${point(105.5, startAngle - 5.4).join(" ")} L ${point(103, startAngle - 3).join(" ")} L ${point(100.5, startAngle - 5.4).join(" ")}`}
            />
          </g>
        )}
        <g textAnchor="middle" className="sd-hub">
          <text y="-13" className="sd-hub-label">
            {t("AGE", "年龄")}
          </text>
          <text y="11" className="sd-hub-age">
            {selected.age ?? "—"}
          </text>
          <text y="23" className="sd-hub-season">
            {seasonLabel(selected.season)}
          </text>
        </g>
        <circle
          className="sd-age-hit"
          r={(hitInner + hitOuter) / 2}
          strokeWidth={hitOuter - hitInner}
          onPointerDown={(event) => {
            if (event.button !== 0 || event.pointerType === "touch") return;
            if (event.pointerType !== "mouse")
              event.currentTarget.setPointerCapture(event.pointerId);
            readAt(event.clientX, event.clientY, true);
          }}
          onPointerMove={(event) => {
            if (
              event.pointerType === "mouse" ||
              (event.pointerType === "pen" &&
                event.currentTarget.hasPointerCapture(event.pointerId))
            )
              readAt(event.clientX, event.clientY, false);
          }}
        />
      </svg>
      <figcaption>
        <span className="sd-hint">
          {t(
            "Move clockwise along the rim. Read the bands from inner to outer.",
            "沿外缘顺时针选龄，下列色带读数由内至外。",
          )}
        </span>
        <dl className="sd-readout">
          {names.map((name, i) => {
            const value = valueAt(selected, metric, i);
            const color =
              value == null
                ? "repeating-linear-gradient(130deg,#243136 0 2px,#84928e 2px 3px)"
                : colorAt(value);
            return (
              <div
                key={i}
                className={zone === i ? "sd-readout-selected" : undefined}
              >
                <i aria-hidden="true" style={{ background: color }} />
                <dt>{name}</dt>
                <dd>{percent(value)}</dd>
              </div>
            );
          })}
        </dl>
      </figcaption>
    </figure>
  );
}
