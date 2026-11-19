import { ShiftMarkers, type ShiftActions } from "./CareerShifts";
import CareerWindow from "./CareerWindow";
import { percent, pp, seasonLabel } from "../lib/analysis";
import { completeProfile } from "../lib/transitions";
import type { SeasonRow, Translate } from "../lib/types";

export const BAND_COLORS = [
  "#597292",
  "#4e746c",
  "#b5a8bd",
  "#dcc7a2",
  "#d99a80",
];
export function bandNames(t: Translate) {
  return [
    "0–3 ft",
    "3–10 ft",
    "10–16 ft",
    t("16 ft–3P", "16 ft–三分线"),
    t("3-point", "三分"),
  ];
}
type ChartProps = {
  rows: SeasonRow[];
  a: SeasonRow;
  b: SeasonRow;
  t: Translate;
};

export function DietHistory({
  shifts,
  onShift,
  rows,
  a,
  b,
  t,
  onPick,
}: ChartProps & ShiftActions & { onPick: (row: SeasonRow) => void }) {
  const first = rows[0].season,
    last = rows[rows.length - 1].season;
  const lookup = new Map(rows.map((r) => [r.season, r]));
  const names = bandNames(t);
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return (
    <section
      className="ct-panel ct-history"
      aria-label={t("Career shot mix", "生涯出手分布")}
    >
      <div className="ct-panel-head">
        <h2>{t("Career shot mix", "生涯出手分布")}</h2>
        <span>{t("Share of attempts", "占全部出手")}</span>
      </div>
      <div className="ct-legend">
        {names.map((name, i) => (
          <span key={name}>
            <i style={{ background: BAND_COLORS[i] }} />
            {name}
          </span>
        ))}
      </div>
      <CareerWindow windowKey={a.id + "/" + b.id} t={t}>
        <div
          className="ct-history-plot"
          style={{ minWidth: years.length * 64 + 40 }}
        >
          <div className="ct-pct-axis" data-window-gutter>
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div
            className={"ct-columns" + (shifts.length ? " with-shifts" : "")}
            style={{
              gridTemplateColumns:
                "repeat(" + years.length + ", minmax(55px,1fr))",
            }}
          >
            <ShiftMarkers
              shifts={shifts}
              onShift={onShift}
              firstYear={first}
              firstColumn={1}
              t={t}
            />
            <span
              className="pc-window-bracket"
              style={{
                gridRow: shifts.length ? 2 : 1,
                gridColumn: `${a.season - first + 1} / span ${b.season - a.season + 1}`,
              }}
            >
              {t("Comparison window", "本次观察区间")}
            </span>
            {years.map((year) => {
              const row = lookup.get(year);
              const inWindow = year >= a.season && year <= b.season;
              return (
                <div
                  key={year}
                  className={"ct-column" + (inWindow ? " pc-in-window" : "")}
                >
                  {row ? (
                    <button
                      className="ct-stack"
                      aria-label={
                        t("Compare season ending ", "比较截至此年的赛季 ") +
                        year
                      }
                      title={
                        seasonLabel(year) +
                        " · " +
                        row.team +
                        " · " +
                        t("3-point share ", "三分占比 ") +
                        percent(row.shares[4])
                      }
                      onClick={() => onPick(row)}
                    >
                      {completeProfile(row) &&
                        row.shares.map((v, k) => (
                          <span
                            key={k}
                            style={{ flexGrow: v!, background: BAND_COLORS[k] }}
                          />
                        ))}
                    </button>
                  ) : (
                    <div
                      className="ct-gap"
                      title={t("No season record", "该赛季无记录")}
                    />
                  )}
                  <small>{seasonLabel(year)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </CareerWindow>
      <div className="ct-panel-note">
        {t(
          "Select a season to compare adjacent recorded seasons.",
          "点选赛季柱可比较相邻的两个有记录赛季。",
        )}
        {rows.some((r) => !completeProfile(r)) &&
          t(
            " Hatching marks an incomplete split.",
            " 斜纹表示五区记录不完整。",
          )}
      </div>
    </section>
  );
}

export function EfficiencyHistory({ rows, a, b, t }: ChartProps) {
  const values = rows.flatMap((r) => (r.rts == null ? [] : [r.rts]));
  const low = Math.min(-5, Math.floor(Math.min(0, ...values) / 5) * 5);
  const high = Math.max(5, Math.ceil(Math.max(0, ...values) / 5) * 5);
  const first = rows[0].season,
    last = rows[rows.length - 1].season;
  const x = (year: number) => 43 + ((year - first) / (last - first)) * 470;
  const y = (v: number) => 18 + ((high - v) / (high - low)) * 103;
  let previous: SeasonRow | undefined;
  const line = rows
    .map((r) => {
      if (r.rts == null) {
        previous = undefined;
        return "";
      }
      const command = previous && previous.season === r.season - 1 ? "L" : "M";
      previous = r;
      return command + x(r.season) + " " + y(r.rts);
    })
    .join(" ");
  return (
    <section className="ct-panel ct-efficiency">
      <div className="ct-panel-head">
        <h2>{t("Scoring efficiency across seasons", "生涯得分效率")}</h2>
        <span>rTS · pp</span>
      </div>
      <div className="ct-rts-readouts">
        {[a, b].map((r) => (
          <div key={r.id}>
            <span>{seasonLabel(r.season)}</span>
            <strong>{pp(r.rts)}</strong>
          </div>
        ))}
      </div>
      <svg
        className="ct-line"
        viewBox="0 0 540 147"
        role="img"
        aria-label={t(
          "Relative true shooting across the career, with a league-average zero line",
          "逐季相对真实命中率，零线代表同期联盟平均值",
        )}
      >
        {[high, 0, low].map((v) => (
          <g key={v}>
            <line
              x1="42"
              x2="514"
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? "var(--control-line)" : "var(--line)"}
              strokeDasharray={v === 0 ? "4 3" : undefined}
            />
            <text x="33" y={y(v) + 4} textAnchor="end">
              {v > 0 ? "+" : ""}
              {v}
            </text>
          </g>
        ))}
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {rows
          .filter((r) => r.rts != null)
          .map((r) => {
            const chosen = r === a || r === b;
            return (
              <g key={r.id}>
                <title>{seasonLabel(r.season) + " · " + pp(r.rts)}</title>
                <circle
                  cx={x(r.season)}
                  cy={y(r.rts!)}
                  r={chosen ? 5 : 2.3}
                  fill={
                    r === b
                      ? "var(--player-orange)"
                      : r === a
                        ? "var(--player-blue)"
                        : "var(--accent)"
                  }
                  stroke={chosen ? "white" : "none"}
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        {[first, Math.round((first + last) / 2), last]
          .filter((v, i, all) => all.indexOf(v) === i)
          .map((year) => (
            <text key={year} x={x(year)} y="143" textAnchor="middle">
              {year}
            </text>
          ))}
      </svg>
      <div className="ct-panel-note">
        {t(
          "0 = league average that season. Values are percentage points.",
          "0 为当季联盟平均值，正值表示球员真实命中率高于联盟。",
        )}
      </div>
    </section>
  );
}
