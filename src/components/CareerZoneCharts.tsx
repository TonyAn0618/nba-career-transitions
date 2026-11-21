import { useState } from "react";
import { percent, seasonLabel } from "../lib/analysis";
import {
  estimatedZoneAttempts,
  hasSmallZoneSample,
  valueAt,
  type Metric,
} from "../lib/ring-encoding";
import { completeProfile } from "../lib/transitions";
import type { SeasonRow, Translate } from "../lib/types";
import { ShotPie } from "./SeasonShotPies";
import { BAND_COLORS } from "./TransitionCharts";
import ZonePairBars from "./ZonePairBars";
import "./career-zone-charts.css";

type ChartProps = {
  selected: SeasonRow;
  zone: number | null;
  names: string[];
  t: Translate;
};

function ageLabel(row: SeasonRow, t: Translate) {
  return row.age == null
    ? seasonLabel(row.season)
    : t(`Age ${row.age}`, `${row.age} 岁`);
}

export function SeasonShotMix({
  selected,
  zone,
  onZone,
  names,
  distances,
  t,
}: ChartProps & {
  onZone: (zone: number | null) => void;
  distances: string[];
}) {
  const age = ageLabel(selected, t);
  const title = t(`${age} · Shot mix`, `${age} · 出手构成`);
  const detail = names.map((_, i) => {
    const count = estimatedZoneAttempts(selected, i);
    return [
      distances[i],
      t("FG%", "命中率") + " " + percent(valueAt(selected, "fg", i)),
      count == null ? "" : t(`≈${count} attempts`, `约 ${count} 次出手`),
    ]
      .filter(Boolean)
      .join(" · ");
  });
  return (
    <section className="cr-details cr-season-mix" aria-label={title}>
      <div className="cr-heading">
        <h2>{title}</h2>
        <span className="cr-season">{seasonLabel(selected.season)}</span>
      </div>
      {selected.fga !== 0 && completeProfile(selected) ? (
        <ShotPie
          row={selected}
          names={names}
          zone={zone}
          onZone={onZone}
          label={title}
          descriptions={names.map(
            (name, i) =>
              name +
              " · " +
              percent(valueAt(selected, "share", i)) +
              " · " +
              detail[i],
          )}
        />
      ) : (
        <p className="cr-mix-missing">
          {selected.fga === 0
            ? t("No attempts", "无出手记录")
            : t("Incomplete zone shares", "五区出手占比不完整")}
        </p>
      )}
      <div className="cr-zone-key">
        {names.map((name, i) => (
          <button
            type="button"
            key={name}
            data-ring-zone={i}
            title={detail[i]}
            aria-pressed={zone === i}
            onClick={() => onZone(zone === i ? null : i)}
          >
            <i style={{ background: BAND_COLORS[i] }} aria-hidden="true" />
            <span>{name}</span>
            <b>{percent(valueAt(selected, "share", i))}</b>
          </button>
        ))}
      </div>
      {zone != null && <p className="cr-zone-readout">{detail[zone]}</p>}
    </section>
  );
}

export function AgeComparison({
  known,
  selected,
  zone,
  names,
  metric,
  onMetric,
  compareYear,
  onCompareYear,
  t,
}: ChartProps & {
  known: SeasonRow[];
  metric: Metric;
  onMetric: (metric: Metric) => void;
  compareYear?: number;
  onCompareYear?: (year: number) => void;
}) {
  const [localYear, setLocalYear] = useState<number>();
  const options = known.filter((row) => row.id !== selected.id);
  const baseline =
    options.find((row) => row.season === (compareYear ?? localYear)) ??
    options.find((row) =>
      row.shares.some(
        (_, i) =>
          valueAt(row, "share", i) != null &&
          valueAt(selected, "share", i) != null,
      ),
    ) ??
    options[0];
  return (
    <section className="cr-age-bars" aria-label={t("Compare ages", "两龄对照")}>
      <div className="cr-heading">
        <h2>{t("Compare ages", "两龄对照")}</h2>
        {baseline && (
          <div className="cr-age-controls">
            <label>
              {t("Reference age", "参照年龄")}
              <select
                aria-label={t(
                  "Reference age for zone comparison",
                  "分区对照的参照年龄",
                )}
                value={baseline.season}
                onChange={(e) =>
                  (onCompareYear ?? setLocalYear)(Number(e.target.value))
                }
              >
                {options.map((row) => (
                  <option value={row.season} key={row.id}>
                    {ageLabel(row, t)} · {seasonLabel(row.season)}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="cr-metric"
              role="group"
              aria-label={t("Age comparison metric", "两龄对照指标")}
            >
              <button
                type="button"
                aria-pressed={metric === "share"}
                onClick={() => onMetric("share")}
              >
                {t("Shot share", "出手占比")}
              </button>
              <button
                type="button"
                aria-pressed={metric === "fg"}
                onClick={() => onMetric("fg")}
              >
                {t("FG%", "命中率")}
              </button>
            </div>
          </div>
        )}
      </div>
      {baseline ? (
        <ZonePairBars
          zones={names}
          series={[baseline, selected].map((row, k) => ({
            label: ageLabel(row, t) + " · " + seasonLabel(row.season),
            color: k === 0 ? "#85beb2" : "#efbd74",
            values: names.map((_, i) => valueAt(row, metric, i)),
            lowSample:
              metric === "fg"
                ? names.map((_, i) => hasSmallZoneSample(row, i))
                : undefined,
          }))}
          activeZone={zone}
          t={t}
        />
      ) : (
        <p className="cr-mix-missing">
          {t(
            "Age comparison needs two recorded seasons.",
            "至少需要两个有记录的赛季才能比较年龄。",
          )}
        </p>
      )}
    </section>
  );
}
