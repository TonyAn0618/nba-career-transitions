import { useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { percent, seasonLabel } from "../lib/analysis";
import type { SeasonRow, Translate } from "../lib/types";
import "./career-rings.css";

type Metric = "share" | "fg";

type Props = {
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
const innerRadius = 35;
const outerRadius = 102;
const tealScale = [
  [45, 75, 75],
  [61, 128, 124],
  [99, 175, 161],
  [157, 210, 186],
  [225, 237, 202],
];

function colorAt(value: number) {
  const position = Math.max(0, Math.min(1, value)) * (tealScale.length - 1);
  const stop = Math.min(Math.floor(position), tealScale.length - 2);
  const rgb = tealScale[stop].map((channel, i) =>
    Math.round(
      channel + (tealScale[stop + 1][i] - channel) * (position - stop),
    ),
  );
  return `rgb(${rgb.join(",")})`;
}

function valueAt(row: SeasonRow | undefined, metric: Metric, zone: number) {
  if (!row || row.fga === 0) return null;
  if (metric === "fg" && row.shares[zone] === 0) return null;
  const value = (metric === "share" ? row.shares : row.fg)[zone];
  return value != null && value >= 0 && value <= 1 ? value : null;
}

function polar(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return [radius * Math.cos(radians), radius * Math.sin(radians)];
}

function ringSector(inside: number, outside: number, sector: number) {
  const mid = -90 + sector * 72;
  const a = mid - 35.5,
    b = mid + 35.5;
  return [
    "M",
    ...polar(inside, a),
    "L",
    ...polar(outside, a),
    "A",
    outside,
    outside,
    0,
    0,
    1,
    ...polar(outside, b),
    "L",
    ...polar(inside, b),
    "A",
    inside,
    inside,
    0,
    0,
    0,
    ...polar(inside, a),
    "Z",
  ].join(" ");
}

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
  const id = useId().replace(/:/g, "");
  const known = rows
    .filter((row): row is DatedSeason => Number.isInteger(row.age))
    .sort((a, b) => a.age - b.age || a.season - b.season);
  const byAge = new Map(known.map((row) => [row.age, row]));
  const first = known[0]?.age ?? 0,
    last = known.at(-1)?.age ?? first;
  const ages = known.length
    ? Array.from({ length: last - first + 1 }, (_, i) => first + i)
    : [];
  const width = (outerRadius - innerRadius) / Math.max(1, ages.length);
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
  function selectAge(age: number, skipGaps = false) {
    let row = byAge.get(age);
    if (!row && skipGaps) {
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
  return (
    <section
      className="career-rings"
      aria-label={t("Career shot profile by age", "各年龄的生涯投篮分布")}
    >
      <div className="cr-overview">
        <div className="cr-heading">
          <h2>{t("Career rings", "生涯年轮")}</h2>
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
        <figure className="cr-figure">
          <svg
            viewBox="-150 -125 300 240"
            role="img"
            aria-labelledby={id + "-ring-title " + id + "-ring-desc"}
          >
            <title id={id + "-ring-title"}>
              {selected.name + " · " + t("Career rings", "生涯年轮")}
            </title>
            <desc id={id + "-ring-desc"}>
              {t(
                "Each outward ring advances one year of age. The five sectors are shooting distances. Color measures ",
                "由内向外每一圈增加一岁，五个扇区代表出手距离。颜色表示",
              ) +
                metricLabel +
                "."}
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
                <path d="M 0 0 V 4" stroke="#6d797a" strokeWidth="1.4" />
              </pattern>
            </defs>
            {ages.map((age, ageIndex) => {
              const row = byAge.get(age);
              const inside = innerRadius + ageIndex * width;
              const pad = Math.min(0.55, width * 0.1);
              return (
                <g
                  key={age}
                  data-age={age}
                  onPointerMove={(e) => {
                    if (e.pointerType === "mouse") selectAge(age);
                  }}
                  onClick={() => selectAge(age)}
                  className={row ? "cr-ring" : undefined}
                >
                  {names.map((name, k) => {
                    const value = valueAt(row, metric, k);
                    return (
                      <path
                        key={k}
                        d={ringSector(inside + pad, inside + width - pad, k)}
                        fill={
                          value == null ? `url(#${id}-missing)` : colorAt(value)
                        }
                        opacity={zone == null || zone === k ? 1 : 0.47}
                      >
                        <title>
                          {t(`Age ${age}`, `${age} 岁`) +
                            " · " +
                            name +
                            " · " +
                            (value == null
                              ? t("No data", "无数据")
                              : percent(value))}
                        </title>
                      </path>
                    );
                  })}
                </g>
              );
            })}
            {activeAge != null && byAge.has(activeAge) && (
              <g pointerEvents="none" className="cr-selected-ring">
                <circle r={innerRadius + (activeAge - first) * width + 0.2} />
                <circle
                  r={innerRadius + (activeAge - first + 1) * width - 0.2}
                />
              </g>
            )}
            {ringLabels.map((label, i) => {
              const angle = -90 + i * 72;
              const [x, y] = polar(111, angle);
              const [x1, y1] = polar(104, angle);
              const [x2, y2] = polar(108, angle);
              return (
                <g
                  key={i}
                  className={
                    "cr-sector-label" + (zone === i ? " cr-sector-active" : "")
                  }
                >
                  <line x1={x1} y1={y1} x2={x2} y2={y2} />
                  <text
                    x={x}
                    y={y}
                    dy={i === 0 ? -1 : 4}
                    textAnchor={i === 0 ? "middle" : i < 3 ? "start" : "end"}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            <g className="cr-hub" textAnchor="middle">
              <text y="-12" className="cr-hub-label">
                {t("AGE", "年龄")}
              </text>
              <text y="13" className="cr-hub-age">
                {activeAge ?? "—"}
              </text>
              <text y="25" className="cr-hub-season">
                {season}
              </text>
            </g>
          </svg>
          <figcaption>
            {t(
              "Each ring is one year older. Hover or tap to select an age.",
              "由内向外，年龄递增。移动鼠标或轻触年轮可切换年龄。",
            )}
          </figcaption>
        </figure>
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
            onChange={(e) => selectAge(Number(e.target.value), true)}
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
