import { percent, seasonLabel } from "../lib/analysis";
import {
  estimatedZoneAttempts,
  hasSmallZoneSample,
  valueAt,
  type Metric,
} from "../lib/ring-encoding";
import { completeProfile } from "../lib/transitions";
import type { SeasonRow, Translate } from "../lib/types";
import CareerCourts from "./CareerCourts";
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

function seasonAndAge(row: SeasonRow, t: Translate) {
  const season = seasonLabel(row.season);
  return row.age == null
    ? season
    : `${season} · ${t(`Age ${row.age}`, `${row.age} 岁`)}`;
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
  const title =
    selected.age == null
      ? t("Shot distribution", "投篮分布")
      : t(
          `Age ${selected.age} shot distribution`,
          `${selected.age}岁 投篮分布`,
        );
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
  rows,
  comparisonSeasons,
  onCompareSeasons,
  zone,
  onZone,
  names,
  distances,
  metric,
  onMetric,
  t,
}: Omit<ChartProps, "selected"> & {
  rows: SeasonRow[];
  comparisonSeasons: readonly [SeasonRow, SeasonRow];
  onCompareSeasons: (firstYear: number, secondYear: number) => void;
  onZone: (zone: number | null) => void;
  distances: string[];
  metric: Metric;
  onMetric: (metric: Metric) => void;
}) {
  const [first, second] = comparisonSeasons;
  function chooseSeason(index: number, year: number) {
    if (index === 0) {
      onCompareSeasons(
        year,
        year === second.season ? first.season : second.season,
      );
    } else {
      onCompareSeasons(
        year === first.season ? second.season : first.season,
        year,
      );
    }
  }
  const accuracy = metric === "fg";
  const series = comparisonSeasons.map((row, i) => {
    const seasonFg =
      row.fgm != null && row.fga != null && row.fga > 0
        ? row.fgm / row.fga
        : null;
    return {
      label: seasonAndAge(row, t),
      color: i === 0 ? "#85beb2" : "#efbd74",
      values: names.map((_, z) => valueAt(row, metric, z)),
      seasonAccuracy: accuracy ? { fg: seasonFg, ts: row.ts } : undefined,
      lowSample: accuracy
        ? names.map((_, z) => hasSmallZoneSample(row, z))
        : undefined,
    };
  });
  const title = t("Age comparison", "年龄对比");
  return (
    <section id="compare-seasons" className="cr-age-bars" aria-label={title}>
      <div className="cr-heading">
        <h2>{title}</h2>
        {rows.length > 1 && (
          <div
            className="cr-metric"
            role="group"
            aria-label={t("Age comparison metric", "年龄对比指标")}
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
              {t("Shooting accuracy", "命中率")}
            </button>
          </div>
        )}
      </div>
      {rows.length > 1 ? (
        <>
          <div className="cr-age-controls">
            {comparisonSeasons.map((row, i) => (
              <label key={i}>
                <i aria-hidden="true" style={{ background: series[i].color }} />
                {i === 0 ? t("Season A", "赛季 A") : t("Season B", "赛季 B")}
                <select
                  value={row.season}
                  onChange={(e) => chooseSeason(i, Number(e.target.value))}
                >
                  {rows.map((option) => (
                    <option key={option.id} value={option.season}>
                      {seasonAndAge(option, t)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <ZonePairBars
            zones={names}
            distances={distances}
            series={series}
            showLegend={false}
            activeZone={zone}
            t={t}
          />
          <CareerCourts
            first={first}
            second={second}
            zone={zone}
            onClearZone={() => onZone(null)}
            t={t}
          />
        </>
      ) : (
        <p className="cr-mix-missing">
          {t(
            "Season comparison requires two recorded seasons.",
            "至少需要两个有记录的赛季才能对照。",
          )}
        </p>
      )}
    </section>
  );
}
