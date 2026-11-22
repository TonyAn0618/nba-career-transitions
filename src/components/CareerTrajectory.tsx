import { useId } from "react";
import type { SeasonRow, Translate } from "../lib/types";
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

export default function CareerTrajectory({
  rows,
  selected,
  onSelect,
  t,
}: Props) {
  const trendId = useId();
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
  const ageLabel = (r: SeasonRow) => t("Age " + r.age, r.age + " 岁");
  const efficiencyPoint = (row: SeasonRow) =>
    row.rts == null ? null : { x: ageX(row.age), y: y(row.rts) };

  const dots = rows.map((row) => {
    const p = efficiencyPoint(row);
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
  return (
    <section className="at-trajectory-panel" aria-labelledby={trendId}>
      <div>
        <h2 id={trendId}>
          {t("Scoring efficiency by age", "得分效率随年龄的变化")}
        </h2>
        <p>
          {t(
            "Relative TS · 0 = league average",
            "相对真实命中率（百分点） · 0 为当季联盟平均",
          )}
        </p>
        <div className="at-plot-caption">
          <i /> {ageLabel(selected)}{" "}
          <span>
            rTS {pp(selected.rts)} · TS {percent(selected.ts)}
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 445 189"
        role="img"
        aria-label={ageLabel(selected) + " · rTS " + pp(selected.rts)}
      >
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
          ...new Set([firstAge, Math.round((firstAge + lastAge) / 2), lastAge]),
        ].map((age) => (
          <text key={age} x={ageX(age)} y="179" textAnchor="middle">
            {age} {t("yr", "岁")}
          </text>
        ))}
        <path d={`M${ageX(selected.age)} 21V158`} className="at-cursor" />
        <path
          d={connectedPaths(rows, efficiencyPoint)}
          className="at-history-line"
        />
        {dots}
      </svg>
    </section>
  );
}
