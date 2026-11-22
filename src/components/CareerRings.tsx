import type { SeasonRow, Translate } from "../lib/types";
import "./career-rings.css";

import { tealScale, type Metric, type RingLayout } from "../lib/ring-encoding";
import SeasonDial from "./SeasonDial";
import ConcentricRings from "./ConcentricRings";
import { AgeComparison, SeasonShotMix } from "./CareerZoneCharts";

type Props = {
  pinned: boolean;
  onPinned: (value: boolean) => void;
  layout: RingLayout;
  onLayout: (value: RingLayout) => void;
  metric: Metric;
  onMetric: (value: Metric) => void;
  comparisonSeasons: readonly [SeasonRow, SeasonRow];
  onCompareSeasons: (firstYear: number, secondYear: number) => void;
  rows: SeasonRow[];
  selected: SeasonRow;
  onSelect: (row: SeasonRow) => void;
  zone: number | null;
  onZone: (zone: number | null) => void;
  t: Translate;
};

type DatedSeason = SeasonRow & { age: number };

export default function CareerRings({
  pinned,
  onPinned,
  layout,
  onLayout,
  rows,
  selected,
  onSelect,
  zone,
  onZone,
  metric,
  onMetric,
  comparisonSeasons,
  onCompareSeasons,
  t,
}: Props) {
  function previewAge(row: SeasonRow) {
    if (!pinned && row.id !== selected.id) onSelect(row);
  }
  function togglePin(row: SeasonRow) {
    onPinned(!pinned || row.id !== selected.id);
    if (row.id !== selected.id) onSelect(row);
  }
  const known = rows
    .filter((row): row is DatedSeason => Number.isInteger(row.age))
    .sort((a, b) => a.age - b.age || a.season - b.season);
  const byAge = new Map(known.map((row) => [row.age, row]));
  const first = known[0]?.age ?? 0,
    last = known.at(-1)?.age ?? first;
  const ages = known.length
    ? Array.from({ length: last - first + 1 }, (_, i) => first + i)
    : [];
  const names = [
    t("Rim", "篮下"),
    t("Short 2", "近两分"),
    t("Mid-range", "中距离"),
    t("Long 2", "长两分"),
    t("3PT", "三分"),
  ];
  const distances = [
    t("0–3 ft", "0–3 英尺"),
    t("3–10 ft", "3–10 英尺"),
    t("10–16 ft", "10–16 英尺"),
    t("16 ft to arc", "16 英尺至三分线"),
    t("Beyond arc", "三分线外"),
  ];
  const metricLabel =
    metric === "share"
      ? t("Attempt share", "出手占比")
      : t("Field goal %", "命中率");
  const layouts = [
    ["rings", t("Concentric rings", "同心年轮")],
    ["dial", t("Season dial", "圆周放大")],
    ["both", t("Compare both", "双图对照")],
  ] as const;
  return (
    <section
      id="career-rings"
      className={layout === "both" ? "career-rings cr-dual" : "career-rings"}
      aria-label={t("Career shot profile by age", "各年龄的生涯投篮分布")}
    >
      <div
        className="cr-overview"
        onKeyDown={(event) => {
          if (event.key === "Escape") onPinned(false);
        }}
      >
        <div className="cr-ring-controls">
          <div className="cr-heading">
            <h2>{t("Career shot profile", "生涯投篮图")}</h2>
            <div
              className="cr-metric"
              role="group"
              aria-label={t("Color rings by", "年轮颜色指标")}
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
          <div
            className="cr-layout-switch"
            role="group"
            aria-label={t("Age chart layout", "年龄图布局")}
          >
            {layouts.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={layout === value}
                onClick={() => onLayout(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cr-legend" aria-label={metricLabel + " 0–100%"}>
            <span>{metricLabel}</span>
            <span>0%</span>
            <i
              aria-hidden="true"
              style={{
                background: `linear-gradient(to right, ${tealScale.map((c) => `rgb(${c.join(",")})`).join(",")})`,
              }}
            />
            <span>100%</span>
            <span className="cr-unavailable">
              <i aria-hidden="true" />
              {t("No data", "无数据")}
            </span>
          </div>
        </div>
        <div className="cr-plots">
          {layout !== "dial" && (
            <div className="cr-plot">
              {layout === "both" && <h3>{layouts[0][1]}</h3>}
              <ConcentricRings
                ages={ages}
                byAge={byAge}
                selected={selected}
                metric={metric}
                zone={zone}
                ringLabels={names}
                names={names}
                t={t}
                pinned={pinned}
                onPreview={previewAge}
                onPin={togglePin}
              />
            </div>
          )}
          {layout !== "rings" && (
            <div className="cr-plot">
              {layout === "both" && <h3>{layouts[1][1]}</h3>}
              <SeasonDial
                ages={ages}
                byAge={byAge}
                selected={selected}
                metric={metric}
                zone={zone}
                names={names}
                t={t}
                pinned={pinned}
                onPreview={previewAge}
                onPin={togglePin}
              />
            </div>
          )}
        </div>
      </div>
      <SeasonShotMix
        selected={selected}
        zone={zone}
        onZone={onZone}
        names={names}
        distances={distances}
        t={t}
      />
      <AgeComparison
        rows={rows}
        comparisonSeasons={comparisonSeasons}
        onCompareSeasons={onCompareSeasons}
        zone={zone}
        onZone={onZone}
        names={names}
        distances={distances}
        metric={metric}
        onMetric={onMetric}
        t={t}
      />
    </section>
  );
}
