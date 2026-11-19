import { useId } from "react";
import type { SeasonRow, Translate } from "../lib/types";
import { completeProfile } from "../lib/transitions";
import { percent, pp, seasonLabel } from "../lib/analysis";

type Props = {
  rows: SeasonRow[];
  selected: SeasonRow;
  onSelect: (row: SeasonRow) => void;
  t: Translate;
};
type Point = { x: number; y: number };

function connectedPaths(
  rows: SeasonRow[],
  point: (row: SeasonRow) => Point | null,
) {
  let previous: SeasonRow | undefined;
  return rows
    .flatMap((row) => {
      const p = point(row);
      const command =
        previous &&
        row.season === previous.season + 1 &&
        row.age === Number(previous.age) + 1
          ? "L"
          : "M";
      previous = p ? row : undefined;
      return p ? [command + p.x + "," + p.y] : [];
    })
    .join(" ");
}

const rim = { x: 52, y: 198 },
  mid = { x: 260, y: 198 },
  three = { x: 156, y: 18 };
function stylePoint(row: SeasonRow): Point | null {
  if (!completeProfile(row)) return null;
  const [a, b, c, d, e] = row.shares as number[];
  const total = a + b + c + d + e;
  return {
    x: ((a + b) * rim.x + (c + d) * mid.x + e * three.x) / total,
    y: ((a + b) * rim.y + (c + d) * mid.y + e * three.y) / total,
  };
}

export default function CareerTrajectory({
  rows,
  selected,
  onSelect,
  t,
}: Props) {
  const titleId = useId(),
    trendId = useId();
  const start = rows[0],
    finish = rows[rows.length - 1];
  const firstAge = start.age ?? 0,
    lastAge = finish.age ?? firstAge;
  const values = rows.flatMap((r) => (r.rts == null ? [] : [r.rts]));
  const bound = Math.max(
    5,
    Math.ceil(Math.max(0, ...values.map(Math.abs)) / 5) * 5,
  );
  const ageX = (age: number | null) =>
    firstAge === lastAge
      ? 226
      : 34 + (((age ?? firstAge) - firstAge) / (lastAge - firstAge)) * 376;
  const y = (value: number) => 92 - (value / bound) * 63;
  const chosenPoint = stylePoint(selected);
  const near =
    selected.shares[0] != null && selected.shares[1] != null
      ? selected.shares[0] + selected.shares[1]
      : null;
  const middle =
    selected.shares[2] != null && selected.shares[3] != null
      ? selected.shares[2] + selected.shares[3]
      : null;
  const ageLabel = (r: SeasonRow) => t("Age " + r.age, r.age + " 岁");
  function dots(point: (r: SeasonRow) => Point | null) {
    return rows.map((row) => {
      const p = point(row);
      if (!p) return null;
      return (
        <g key={row.id} className="at-plot-point" onClick={() => onSelect(row)}>
          <title>
            {ageLabel(row) +
              " · " +
              seasonLabel(row.season) +
              " · rTS " +
              pp(row.rts)}
          </title>
          <circle cx={p.x} cy={p.y} r={8} fill="transparent" />
          <circle
            cx={p.x}
            cy={p.y}
            r={row === selected ? 5.1 : 2.6}
            className={row === selected ? "at-dot at-now" : "at-dot"}
          />
        </g>
      );
    });
  }
  return (
    <section
      className="at-trajectories"
      aria-label={t(
        "Shot mix and scoring efficiency across ages",
        "各年龄的出手结构与得分效率",
      )}
    >
      <div className="at-trajectory-panel">
        <h2>{t("Where the shots moved", "出手重心迁移")}</h2>
        <p>
          {t(
            "Each dot is a season. A dot closer to a corner means more attempts from that region.",
            "每点代表一季。越靠近某个顶点，从该区出手的比例越高。",
          )}
        </p>
        <svg
          className="at-simplex"
          viewBox="0 0 312 226"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>
            {ageLabel(selected)} · {t("Near rim", "近篮")} {percent(near)} ·{" "}
            {t("Mid-range", "中距离")} {percent(middle)} · {t("Three", "三分")}{" "}
            {percent(selected.shares[4])}
          </title>
          <path d="M52 198 L156 18 L260 198 Z" className="at-boundary" />
          <path
            d="M104 108 L208 108 M104 108 L156 198 M208 108 L156 198"
            className="at-grid"
          />
          <text x="156" y="12" textAnchor="middle">
            {t("Three-point", "三分")}
          </text>
          <text x="52" y="218" textAnchor="middle">
            {t("Near rim (<10 ft)", "近篮（10 英尺内）")}
          </text>
          <text x="260" y="218" textAnchor="middle">
            {t("Mid-range", "中距离")}
          </text>
          <path
            d={connectedPaths(rows, stylePoint)}
            className="at-history-line"
          />
          {dots(stylePoint)}
        </svg>
        <div className="at-plot-caption">
          <i />
          {ageLabel(selected)}{" "}
          <span>
            {chosenPoint
              ? t(
                  `Near rim ${percent(near)} · Mid-range ${percent(middle)} · Three ${percent(selected.shares[4])}`,
                  `近篮 ${percent(near)} · 中距离 ${percent(middle)} · 三分 ${percent(selected.shares[4])}`,
                )
              : t("Incomplete five-zone profile", "五区分布记录不完整")}
          </span>
        </div>
      </div>
      <div className="at-trajectory-panel">
        <h2>{t("Efficiency through the years", "效率随年龄的变化")}</h2>
        <p>
          {t(
            "Relative true shooting in percentage points. Zero marks that season’s league average.",
            "纵轴为相对真实命中率（百分点），零线代表该赛季的联盟平均水平。",
          )}
        </p>
        <svg viewBox="0 0 445 189" role="img" aria-labelledby={trendId}>
          <title id={trendId}>
            {ageLabel(selected) + " · rTS " + pp(selected.rts)}
          </title>
          {[-bound, 0, bound].map((n) => (
            <g key={n}>
              <path
                d={`M34 ${y(n)}H411`}
                className={n === 0 ? "at-baseline" : "at-grid"}
              />
              <text x="28" y={y(n) + 3} textAnchor="end">
                {n > 0 ? "+" : ""}
                {n}
              </text>
            </g>
          ))}
          {[
            ...new Set([
              firstAge,
              Math.round((firstAge + lastAge) / 2),
              lastAge,
            ]),
          ].map((age) => (
            <text key={age} x={ageX(age)} y="179" textAnchor="middle">
              {age} {t("yr", "岁")}
            </text>
          ))}
          <path d={`M${ageX(selected.age)} 21V158`} className="at-cursor" />
          <path
            d={connectedPaths(rows, (r) =>
              r.rts == null ? null : { x: ageX(r.age), y: y(r.rts) },
            )}
            className="at-history-line"
          />
          {dots((r) =>
            r.rts == null ? null : { x: ageX(r.age), y: y(r.rts) },
          )}
        </svg>
        <div className="at-plot-caption">
          <i />
          {ageLabel(selected)}{" "}
          <span>
            rTS {pp(selected.rts)} · TS {percent(selected.ts)}
          </span>
        </div>
      </div>
    </section>
  );
}
