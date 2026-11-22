import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  percent,
  PLAYER_COLORS,
  seasonLabel,
  shortName,
} from "../lib/analysis";
import { completeProfile } from "../lib/transitions";
import type { SeasonRow, Translate } from "../lib/types";
import { BAND_COLORS, bandNames } from "./TransitionCharts";

type Props = {
  players: SeasonRow[];
  rows: readonly (SeasonRow | undefined)[];
  years: readonly (number | null)[];
  phase: string;
  zone: number | null;
  onZone: (index: number | null) => void;
  previous?: () => void;
  next?: () => void;
  t: Translate;
};

function point(turn: number, radius: number) {
  const angle = (turn - 0.25) * 2 * Math.PI;
  return [60 + radius * Math.cos(angle), 60 + radius * Math.sin(angle)];
}

export function ShotPie({
  row,
  names,
  zone,
  onZone,
  label,
  descriptions,
}: {
  row: SeasonRow;
  names: string[];
  zone: Props["zone"];
  onZone: Props["onZone"];
  label: string;
  descriptions?: string[];
}) {
  // Each published share is rounded. Scale the geometry to one full turn.
  const shares = row.shares.map((v) => v!);
  const total = shares.reduce((sum, v) => sum + v, 0);
  let start = 0;
  return (
    <svg
      className="pc-pie"
      viewBox="0 0 120 120"
      role="group"
      aria-label={label}
    >
      {shares.map((share, index) => {
        if (!share) return null;
        const size = share / total,
          end = start + size;
        const from = point(start, 56),
          to = point(end, 56);
        const [x, y] = point(start + size / 2, 37);
        const path =
          "M 60 60 L " +
          from.join(" ") +
          " A 56 56 0 " +
          (size > 0.5 ? 1 : 0) +
          " 1 " +
          to.join(" ") +
          " Z";
        start = end;
        const toggle = () => onZone(zone === index ? null : index);
        return (
          <g
            key={index}
            className="pc-slice"
            role="button"
            tabIndex={0}
            aria-pressed={zone === index}
            aria-label={names[index] + " · " + percent(share)}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            }}
            opacity={zone == null || zone === index ? 1 : 0.3}
          >
            <title>
              {descriptions?.[index] ??
                label + " · " + names[index] + " " + percent(share)}
            </title>
            {size >= 1 ? (
              <circle cx="60" cy="60" r="56" fill={BAND_COLORS[index]} />
            ) : (
              <path d={path} fill={BAND_COLORS[index]} />
            )}
            {size >= 0.125 && (
              <text
                x={size >= 1 ? 60 : x}
                y={size >= 1 ? 60 : y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={index < 2 ? "#fff" : "#101b23"}
              >
                {percent(share)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function SeasonShotPies({
  players,
  rows,
  years,
  phase,
  zone,
  onZone,
  previous,
  next,
  t,
}: Props) {
  const names = bandNames(t);
  const valid = rows.map((row) =>
    row && completeProfile(row) ? row : undefined,
  );
  return (
    <section
      className="ct-panel pc-pies"
      aria-label={t(
        "Shot mix in the selected seasons",
        "所选赛季的双人出手构成",
      )}
    >
      <div className="pc-pies-heading">
        <h2>{t("Selected season · shot mix", "所选赛季 · 五区出手构成")}</h2>
        <div className="pc-phase-stepper">
          <button
            disabled={!previous}
            onClick={previous}
            aria-label={t("Previous season", "上一季")}
          >
            <ChevronLeft size={16} />
          </button>
          <span aria-live="polite">{phase}</span>
          <button
            disabled={!next}
            onClick={next}
            aria-label={t("Next season", "下一季")}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="pc-pie-pair">
        {players.map((p, i) => {
          const row = valid[i],
            year = years[i] == null ? "" : seasonLabel(years[i]);
          return (
            <figure
              key={p.playerId}
              className={i === 0 ? "pc-pie-first" : "pc-pie-second"}
            >
              <figcaption>
                <b style={{ color: PLAYER_COLORS[i] }}>{shortName(p.name)}</b>
                <span>{year}</span>
              </figcaption>
              {row ? (
                <ShotPie
                  row={row}
                  names={names}
                  zone={zone}
                  onZone={onZone}
                  label={p.name + " · " + year}
                />
              ) : (
                <div className="pc-pie-missing">
                  {rows[i]
                    ? t("Incomplete split", "五区占比不完整")
                    : t("No season data", "无赛季数据")}
                </div>
              )}
            </figure>
          );
        })}
        <table
          className="pc-pie-values"
          aria-label={t(
            "Five-zone shares for both players",
            "两人的五区出手占比",
          )}
        >
          <thead>
            <tr>
              <th scope="col">{shortName(players[0].name)}</th>
              <th scope="col">{t("Distance", "距离")}</th>
              <th scope="col">{shortName(players[1].name)}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name, i) => (
              <tr
                key={name}
                className={zone === i ? "pc-selected-band" : undefined}
              >
                <td>{percent(valid[0]?.shares[i] ?? null)}</td>
                <th scope="row">
                  <button
                    onClick={() => onZone(zone === i ? null : i)}
                    aria-pressed={zone === i}
                  >
                    <i style={{ background: BAND_COLORS[i] }} />
                    {name}
                  </button>
                </th>
                <td>{percent(valid[1]?.shares[i] ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
