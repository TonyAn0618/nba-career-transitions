import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { percent, seasonLabel } from "../lib/analysis";
import type { SeasonRow, Translate } from "../lib/types";
import "./career-rings.css";

import {
  valueAt,
  tealScale,
  type Metric,
  type RingLayout,
} from "../lib/ring-encoding";
import SeasonDial from "./SeasonDial";
import ConcentricRings from "./ConcentricRings";

type Props = {
  layout: RingLayout;
  onLayout: (value: RingLayout) => void;
  metric: Metric;
  onMetric: (value: Metric) => void;
  compareYear?: number;
  onCompareYear?: (year: number) => void;
  rows: SeasonRow[];
  selected: SeasonRow;
  onSelect: (row: SeasonRow) => void;
  zone: number | null;
  onZone: (zone: number | null) => void;
  t: Translate;
};

type DatedSeason = SeasonRow & { age: number };
function estimatedAttempts(row: SeasonRow, index: number) {
  const share = row.shares[index];
  if (row.fga === 0) return 0;
  return row.fga == null || share == null ? null : Math.round(row.fga * share);
}

function TwoAgeComparison({
  known,
  selected,
  zone,
  names,
  compareYear,
  onCompareYear,
  t,
}: Pick<Props, "selected" | "zone" | "compareYear" | "onCompareYear" | "t"> & {
  known: DatedSeason[];
  names: string[];
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
  if (!baseline)
    return (
      <p className="cr-comparison-empty">
        {t(
          "Age comparison needs two recorded seasons.",
          "至少需要两个有记录的赛季才能比较年龄。",
        )}
      </p>
    );
  const shifts = names.map((_, i) => {
    const start = valueAt(baseline, "share", i),
      end = valueAt(selected, "share", i);
    return start == null || end == null ? null : (end - start) * 100;
  });
  let largest: number | null = null;
  for (const [i, shift] of shifts.entries()) {
    if (
      shift != null &&
      (largest == null || Math.abs(shift) > Math.abs(shifts[largest]!))
    )
      largest = i;
  }
  const focus = zone ?? largest;
  const low =
    focus == null
      ? []
      : [baseline, selected].flatMap((row) => {
          const n = estimatedAttempts(row, focus);
          return n != null && n < 25
            ? [
                t(
                  `≈${n} attempts at age ${row.age}`,
                  `${row.age} 岁约 ${n} 次出手`,
                ),
              ]
            : [];
        });
  return (
    <section
      className="cr-comparison"
      aria-label={t("Two-age comparison", "两龄对照")}
    >
      <div className="cr-comparison-head">
        <h3>{t("Compare ages", "两龄对照")}</h3>
        <label>
          {t("From", "参照年龄")}{" "}
          <select
            aria-label={t(
              "Reference age for zone comparison",
              "分区对照的参照年龄",
            )}
            value={baseline.season}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (onCompareYear) onCompareYear(next);
              else setLocalYear(next);
            }}
          >
            {options.map((row) => (
              <option value={row.season} key={row.id}>
                {t(`Age ${row.age}`, `${row.age} 岁`)} ·{" "}
                {seasonLabel(row.season)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {focus == null ? (
        <p className="cr-comparison-empty">
          {t(
            "The two seasons have no shared zone values.",
            "两季缺少可比的分区数据。",
          )}
        </p>
      ) : (
        <table className="cr-delta-table">
          <thead>
            <tr>
              <th scope="col">
                <b>{names[focus]}</b>
                <small>
                  {zone == null
                    ? t("Largest share change", "出手占比变化最大")
                    : t("Selected zone", "所选区域")}
                </small>
              </th>
              <th scope="col">
                {t(`Age ${baseline.age}`, `${baseline.age} 岁`)}
              </th>
              <th scope="col">
                {t(`Age ${selected.age}`, `${selected.age} 岁`)}
              </th>
              <th scope="col">{t("Δ pp", "Δ 百分点")}</th>
            </tr>
          </thead>
          <tbody>
            {(["share", "fg"] as const).map((key) => {
              const start = valueAt(baseline, key, focus),
                end = valueAt(selected, key, focus);
              const delta =
                start == null || end == null
                  ? null
                  : Number(((end - start) * 100).toFixed(1));
              return (
                <tr key={key}>
                  <th scope="row">
                    {key === "fg"
                      ? t("FG%", "命中率")
                      : t("Shot share", "出手占比")}
                  </th>
                  <td>{percent(start)}</td>
                  <td>{percent(end)}</td>
                  <td>
                    {delta == null
                      ? "—"
                      : (delta > 0 ? "+" : "") + delta.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {low.length > 0 && (
        <p className="cr-small-sample">
          {t("Small sample · ", "小样本 · ")}
          {low.join(" / ")}
        </p>
      )}
    </section>
  );
}

function ValueCell({ value }: { value: number | null }) {
  return (
    <td className="cr-value-cell">
      <span>{percent(value)}</span>
      <i className="cr-track" aria-hidden="true">
        {value != null && <i style={{ width: `${value * 100}%` }} />}
      </i>
    </td>
  );
}

export default function CareerRings({
  layout,
  onLayout,
  rows,
  selected,
  onSelect,
  zone,
  onZone,
  metric,
  onMetric,
  compareYear,
  onCompareYear,
  t,
}: Props) {
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
    t("At the rim", "篮下"),
    t("Short two", "近距离两分"),
    t("Mid-range", "中距离"),
    t("Long two", "长两分"),
    t("Three-pointer", "三分"),
  ];
  const distances = [
    t("0–3 ft", "0–3 英尺"),
    t("3–10 ft", "3–10 英尺"),
    t("10–16 ft", "10–16 英尺"),
    t("16 ft to arc", "16 英尺至三分线"),
    t("Beyond arc", "三分线外"),
  ];
  const ringLabels = [
    t("0–3 ft", "0–3 英尺"),
    t("3–10 ft", "3–10 英尺"),
    t("10–16 ft", "10–16 英尺"),
    t("Long 2", "长两分"),
    t("3PT", "三分"),
  ];
  const metricLabel =
    metric === "share"
      ? t("Attempt share", "出手占比")
      : t("Field goal %", "命中率");
  const season = seasonLabel(selected.season);
  const index = known.findIndex((row) => row.id === selected.id);
  const activeAge = selected.age;
  const counts = names.map((_, i) => estimatedAttempts(selected, i));
  const lowVolume = counts.some((n) => n != null && n < 25);
  function selectAge(age: number) {
    let row = byAge.get(age);
    if (!row) {
      row =
        age > (activeAge ?? first)
          ? known.find((r) => r.age >= age)
          : known
              .slice()
              .reverse()
              .find((r) => r.age <= age);
    }
    if (row && row.id !== selected.id) onSelect(row);
  }
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
      <div className="cr-overview">
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
                ringLabels={ringLabels}
                names={names}
                t={t}
                onSelect={onSelect}
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
                onSelect={onSelect}
              />
            </div>
          )}
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
      <div className="cr-details">
        <div className="cr-heading">
          <h2>{t("Shooting by distance", "各区域投篮表现")}</h2>
          <span className="cr-season">{season}</span>
        </div>
        <table className="cr-stats">
          <thead>
            <tr>
              <th scope="col">{t("Select zone", "选择区域")}</th>
              <th scope="col">{t("Shot share", "出手占比")}</th>
              <th scope="col">{t("FG%", "命中率")}</th>
              <th scope="col">{t("≈ FGA", "约出手数")}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name, i) => {
              const volume = counts[i];
              const sparse = volume != null && volume < 25;
              return (
                <tr key={i} className={zone === i ? "cr-focused" : undefined}>
                  <th scope="row">
                    <button
                      type="button"
                      aria-pressed={zone === i}
                      onClick={() => onZone(zone === i ? null : i)}
                      title={t(
                        "Highlight this zone across views",
                        "在各视图中突出该区域",
                      )}
                    >
                      <b>{name}</b>
                      <small>{distances[i]}</small>
                    </button>
                  </th>
                  <ValueCell value={valueAt(selected, "share", i)} />
                  <ValueCell value={valueAt(selected, "fg", i)} />
                  <td className="cr-count">
                    {volume ?? "—"}
                    {sparse && (
                      <sup
                        title={t(
                          "Fewer than 25 estimated attempts",
                          "估计出手少于 25 次",
                        )}
                      >
                        *
                      </sup>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="cr-note">
          {t(
            "Attempts estimated from season totals and published shares.",
            "区域出手数按赛季总出手与公布占比估算。",
          )}
          {lowVolume &&
            t(" * Fewer than 25 attempts.", " * 估计出手少于 25 次。")}
        </p>
        <TwoAgeComparison
          key={selected.playerId}
          known={known}
          selected={selected}
          zone={zone}
          names={names}
          compareYear={compareYear}
          onCompareYear={onCompareYear}
          t={t}
        />
      </div>
      {known.length > 0 && (
        <div className="cr-scrubber">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => onSelect(known[index - 1])}
            aria-label={t("Previous observed age", "上一个有记录的年龄")}
          >
            <ChevronLeft size={17} />
          </button>
          <span className="cr-end-age">{t(`Age ${first}`, `${first} 岁`)}</span>
          <input
            type="range"
            aria-label={t("Explore seasons by age", "按年龄浏览赛季")}
            aria-valuetext={
              activeAge == null
                ? season
                : t(`Age ${activeAge}, ${season}`, `${activeAge} 岁，${season}`)
            }
            min={first}
            max={last}
            step="1"
            value={activeAge ?? first}
            disabled={known.length < 2}
            onChange={(e) => selectAge(Number(e.target.value))}
          />
          <span className="cr-end-age">{t(`Age ${last}`, `${last} 岁`)}</span>
          <button
            type="button"
            disabled={index >= known.length - 1}
            onClick={() => onSelect(known[index + 1])}
            aria-label={t("Next observed age", "下一个有记录的年龄")}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      )}
    </section>
  );
}
