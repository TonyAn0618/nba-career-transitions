import { useId } from "react";
import { courtRegions, type CourtRegionStat } from "../lib/court-regions";
import type { Translate } from "../lib/types";
import "./peer-region-court.css";

type PeerMode = "accuracy" | "frequency";
interface LegendProps {
  mode: PeerMode;
  minShots: number;
  t: Translate;
}

interface CourtProps extends LegendProps {
  name: string;
  stats: Map<string, CourtRegionStat>;
  league: Record<string, number[]>;
  full: boolean;
  activeRegion: string | null;
  pinnedRegion: string | null;
  onHover: (id: string | null) => void;
  onPin: (id: string | null) => void;
}

const empty = { attempts: 0, made: 0, share: null, fg: null };
const noShots = "#e7e6e2";
const neutral = "#d9d9d3";
const high = "#ff782e";
const average = "#ffd600";
const low = "#45b5ed";
const frequencyBands = [
  { min: 0.3, color: "#8a3014", ink: "#fff", text: "≥30%" },
  { min: 0.2, color: "#d65d22", ink: "#211007", text: "20–<30%" },
  { min: 0.1, color: "#ff9957", ink: "#211007", text: "10–<20%" },
  { min: 0.05, color: "#ffc897", ink: "#211007", text: "5–<10%" },
  { min: 0, color: "#ffead5", ink: "#211007", text: "<5%" },
];

function paint(
  mode: PeerMode,
  stat: CourtRegionStat,
  baseline: number[] | undefined,
  min: number,
  hatch: string,
) {
  const ink = "#192020";
  if (!stat.attempts) return { fill: noShots, ink, labelUnderlay: noShots };
  if (mode === "frequency") {
    const band = frequencyBands.find((b) => (stat.share ?? 0) >= b.min)!;
    return { fill: band.color, ink: band.ink, labelUnderlay: band.color };
  }
  if (stat.attempts < min || !baseline || !baseline[1]) {
    return { fill: `url(#${hatch})`, ink, labelUnderlay: neutral };
  }
  const [made, attempts] = baseline;
  const difference = 20 * (stat.made * attempts - made * stat.attempts);
  const fivePoints = stat.attempts * attempts;
  const fill =
    difference > fivePoints ? high : difference < -fivePoints ? low : average;
  return { fill, ink, labelUnderlay: fill };
}

function Basket({ far }: { far?: boolean }) {
  return (
    <g transform={far ? "translate(0 94) rotate(180)" : undefined}>
      <path d="M-22 0 V14.1978 A23.75 23.75 0 0 0 22 14.1978 V0 M-8 0 V19 H8 V0 M-6 19 A6 6 0 0 0 6 19 M-4 5.25 A4 4 0 0 0 4 5.25" />
      <path className="peer-region-hoop" d="M-3 4 H3 M0 4 V4.5" />
      <circle className="peer-region-hoop" cx="0" cy="5.25" r=".75" />
    </g>
  );
}

export function PeerRegionCourt({
  name,
  mode,
  stats,
  league,
  full,
  minShots,
  activeRegion,
  pinnedRegion,
  onHover,
  onPin,
  t,
}: CourtProps) {
  const hatch = useId();
  const total = [...stats.values()].reduce((sum, s) => sum + s.attempts, 0);
  const regions = courtRegions
    .filter((r) => full || r.id !== "backcourt")
    .map((r) => {
      const stat = stats.get(r.id) ?? empty;
      const percent = mode === "accuracy" ? stat.fg : stat.share;
      const percentage =
        percent == null ? "—" : (percent * 100).toFixed(1) + "%";
      const counts =
        mode === "accuracy"
          ? `${stat.made}/${stat.attempts}`
          : `${stat.attempts}/${total}`;
      return {
        ...r,
        percentage,
        counts,
        ...paint(mode, stat, league[r.id], minShots, hatch),
      };
    });
  const active = regions.find((r) => r.id === activeRegion);
  const length = full ? 94 : 47;
  return (
    <svg
      className="peer-region-court"
      viewBox={`-25.25 -.25 50.5 ${length + 0.5}`}
      role="group"
      aria-label={
        name +
        " · " +
        t(
          mode === "accuracy"
            ? "Field goal percentage by region"
            : "Attempt share by region",
          mode === "accuracy" ? "分区命中率" : "分区出手占比",
        )
      }
    >
      <defs>
        <pattern
          id={hatch}
          width="1"
          height="1"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="1" height="1" fill={neutral} />
          <path d="M0 0 V1" stroke="#b4b4ac" strokeWidth=".21" />
        </pattern>
      </defs>
      {regions.map((r) => {
        const area = t(...r.name);
        const metric =
          mode === "accuracy"
            ? t("FG%", "命中率")
            : t("Attempt share", "出手占比");
        const ratio =
          mode === "accuracy"
            ? t("makes/attempts", "命中数/出手数")
            : t("region/recorded attempts", "本区出手/有坐标出手");
        const label = `${area} · ${metric} ${r.percentage} · ${ratio} ${r.counts}`;
        const pin = () => onPin(r.id === pinnedRegion ? null : r.id);
        return (
          <path
            key={r.id}
            className="peer-region-area"
            d={r.path}
            fill={r.fill}
            data-region={r.id}
            data-state={
              r.fill === noShots
                ? "empty"
                : r.fill.startsWith("url(")
                  ? "unrated"
                  : undefined
            }
            role="button"
            tabIndex={0}
            aria-label={name + " · " + label}
            aria-pressed={r.id === pinnedRegion}
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") onHover(r.id);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") onHover(null);
            }}
            onFocus={() => onHover(r.id)}
            onBlur={() => onHover(null)}
            onClick={pin}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                if (!e.repeat) pin();
              } else if (e.key === "Escape") {
                onHover(null);
                onPin(null);
              }
            }}
          >
            <title>{label}</title>
          </path>
        );
      })}
      <g className="peer-region-lines" aria-hidden="true">
        <rect x="-25" y="0" width="50" height={length} />
        <Basket />
        {full ? (
          <>
            <Basket far />
            <path d="M-25 47 H25" />
            <circle cy="47" r="6" />
          </>
        ) : (
          <path d="M-6 47 A6 6 0 0 1 6 47" />
        )}
      </g>
      {active && (
        <g className="peer-region-highlight" aria-hidden="true">
          <path d={active.path} />
          <path className="inner" d={active.path} />
        </g>
      )}
      {regions.map((r) => {
        const corner = r.id.endsWith("-corner");
        const [x, y] = r.label;
        const cornerClass = corner
          ? " is-corner" +
            (x < 0 ? " left" : " right") +
            (r.counts.length > 6 ? " long-count" : "")
          : "";
        const fit = (label: string, font: number) =>
          corner
            ? `scale(${Math.min(1, 2.73 / (label.length * font * 0.6))} 1)`
            : undefined;
        return (
          <g
            className={"peer-region-label" + cornerClass}
            key={r.id}
            transform={`translate(${x} ${y})`}
            fill={r.ink}
            stroke={r.labelUnderlay}
            aria-hidden="true"
          >
            <g className="peer-region-label-position">
              <text
                className="peer-region-pct"
                y="-.15"
                transform={fit(r.percentage, 1.48)}
              >
                {r.percentage}
              </text>
              <text
                className="peer-region-count"
                y="1.35"
                transform={fit(r.counts, 1.25)}
              >
                {r.counts}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function PeerRegionLegend({
  mode,
  minShots,
  career = false,
  t,
}: LegendProps & { career?: boolean }) {
  const entries =
    mode === "accuracy"
      ? [
          { color: high, text: t("Above league average", "高于联盟平均") },
          { color: average, text: t("Near league average", "联盟平均附近") },
          {
            color: low,
            text: t("Below league average", "低于联盟平均"),
          },
        ]
      : [...frequencyBands]
          .reverse()
          .map((b) => ({ color: b.color, text: b.text }));
  return (
    <div className="peer-region-legend">
      <strong>
        {mode === "accuracy"
          ? career
            ? t(
                "League FG% in the same region across covered seasons · near average within ±5 pp",
                "有坐标赛季的联盟同区命中率 · 平均附近为 ±5 个百分点",
              )
            : t(
                "Same season and region · near average within ±5 pp",
                "同季联盟同区命中率 · 平均附近为 ±5 个百分点",
              )
          : t("Share of recorded attempts", "占有坐标出手的比例")}
      </strong>
      <div className="peer-region-keys">
        {mode === "frequency" && (
          <span>
            <i style={{ background: noShots }} />
            0%
          </span>
        )}
        {entries.map((b) => (
          <span key={b.text}>
            <i style={{ background: b.color }} />
            {b.text}
          </span>
        ))}
        {mode === "accuracy" && (
          <>
            <span className="peer-region-unrated-key">
              <i className="peer-region-hatch" />
              {minShots === 1
                ? t("League rate unavailable", "无联盟数据")
                : t(
                    `<${minShots} attempts or no league rate`,
                    `少于 ${minShots} 次出手或无联盟数据`,
                  )}
            </span>
            <span className="peer-region-empty-key">
              <i style={{ background: noShots }} />
              {t("No attempts", "无出手")}
            </span>
          </>
        )}
      </div>
      <small>
        {mode === "accuracy"
          ? t("FG% · makes / attempts", "命中率 · 命中数 / 出手数")
          : t(
              "Attempt share · region attempts / recorded attempts",
              "出手占比 · 本区出手数 / 有坐标出手数",
            )}
      </small>
    </div>
  );
}
