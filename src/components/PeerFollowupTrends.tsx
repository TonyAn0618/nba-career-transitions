import { useId, useState, type CSSProperties } from "react";
import { seasonLabel } from "../lib/analysis";
import type { peerFollowup } from "../lib/peer-followup";
import type { Translate } from "../lib/types";
import "./peer-followup-trends.css";

type Followup = NonNullable<ReturnType<typeof peerFollowup>>;
type Period = NonNullable<Followup["pre"]>;
type Metric = "shares" | "zonePerGame" | "fg";

interface Props {
  analysis: Followup;
  selectedYear: number | null;
  onYear: (year: number) => void;
  t: Translate;
}

function careerRange(first: number, last: number, t: Translate) {
  if (first === last) return t(`Year ${first}`, `第${first}季`);
  return t(`Years ${first}–${last}`, `第${first}–${last}季`);
}

function formatValue(value: number | null, metric: Metric) {
  if (value == null) return "—";
  return metric === "zonePerGame"
    ? value.toFixed(2)
    : (value * 100).toFixed(1) + "%";
}

function formatChange(
  value: number | null,
  baseline: number | null,
  metric: Metric,
  t: Translate,
) {
  if (value == null || baseline == null) return "—";
  const digits = metric === "zonePerGame" ? 2 : 1;
  const diff = Number(
    ((value - baseline) * (metric === "zonePerGame" ? 1 : 100)).toFixed(digits),
  );
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return (
    sign +
    Math.abs(diff).toFixed(digits) +
    (metric === "zonePerGame" ? t(" / game", " 次/场") : t(" pp", " 个百分点"))
  );
}

function ZoneTrend({
  values,
  baseline,
  maximum,
  relative,
  selectedIndex,
}: {
  values: (number | null)[];
  baseline: number | null;
  maximum: number;
  relative: boolean;
  selectedIndex: number;
}) {
  // The same vertical domain is used in all five rows. A missing year breaks the path.
  const x = (i: number) => 100 * (i + 0.5);
  const y = (v: number) =>
    relative && baseline != null
      ? 22.5 - (18 * (v - baseline)) / maximum
      : 40 - (32 * v) / maximum;
  const width = values.length * 100;
  const path = values
    .map((v, i) =>
      v == null
        ? ""
        : (i > 0 && values[i - 1] != null ? "L" : "M") + x(i) + " " + y(v),
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} 45`}
      preserveAspectRatio="none"
      className="pf-zone-plot"
      aria-hidden="true"
    >
      {baseline != null && (
        <path className="pf-zone-reference" d={`M0 ${y(baseline)} H${width}`} />
      )}
      <path className="pf-zone-line" d={path} />
      {values.map((v, i) =>
        v == null ? null : (
          <path
            key={i}
            className={
              "pf-zone-dot" + (i === selectedIndex ? " is-selected" : "")
            }
            d={`M${x(i)} ${y(v)}h0.01`}
          />
        ),
      )}
    </svg>
  );
}

export default function PeerFollowupTrends({
  analysis,
  selectedYear,
  onYear,
  t,
}: Props) {
  const [metric, setMetric] = useState<Metric>("shares");
  const title = useId();
  const { pre, post, years } = analysis;
  if (!pre || !post || !years.length) return null;
  const labels: Record<Metric, string> = {
    shares: t("Attempt share", "出手占比"),
    zonePerGame: t("Attempts per game", "场均出手"),
    fg: t("Zone FG%", "分区命中率"),
  };
  const regions = [
    t("At rim", "篮下"),
    t("Short two", "近两分"),
    t("Mid-range", "中距离"),
    t("Long two", "长两分"),
    t("Three", "三分"),
  ];
  const distances = [
    "0–3 ft",
    "3–10 ft",
    "10–16 ft",
    t("16 ft to arc", "16 ft 至三分线"),
    null,
  ];
  const read = (period: Period | null, zone: number) =>
    period?.[metric][zone] ?? null;
  function valueLabel(period: Period | null, zone: number) {
    const value = read(period, zone);
    const attempts = period?.zoneAttempts[zone];
    const lowSample =
      metric === "fg" && value != null && attempts != null && attempts < 25;
    return formatValue(value, metric) + (lowSample ? "*" : "");
  }
  const periods = [pre, ...years.map((s) => s.stats), post];
  const hasLowSample =
    metric === "fg" &&
    periods.some((p) =>
      p?.zoneAttempts.some((n, i) => n != null && n < 25 && p.fg[i] != null),
    );
  const relative = regions.every(
    (_, i) =>
      read(pre, i) != null ||
      years.every(({ stats }) => read(stats, i) == null),
  );
  const peak = Math.max(
    0,
    ...years.flatMap(({ stats }) =>
      regions.map((_, i) => {
        const value = read(stats, i);
        return value == null
          ? 0
          : relative
            ? Math.abs(value - read(pre, i)!)
            : value;
      }),
    ),
    ...(relative ? [] : pre[metric].map((v) => v ?? 0)),
  );
  const maximum =
    metric === "zonePerGame"
      ? Math.max(0.5, Math.ceil(peak * 2) / 2)
      : Math.max(0.02, Math.ceil(peak * 50) / 50);
  const selectedIndex = years.findIndex(({ year }) => year === selectedYear);
  return (
    <section className="pf-zone-trends" aria-labelledby={title}>
      <div className="pf-zone-tools">
        <h4 id={title}>{t("Shooting by zone", "各区域投篮走势")}</h4>
        <div
          className="ap-switch"
          role="group"
          aria-label={t("Zone trend metric", "分区走势指标")}
        >
          {(["shares", "zonePerGame", "fg"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="pf-zone-scale">
        <span>
          {relative
            ? t("Lines show change from earlier · ±", "折线为较前期变化 · ±")
            : t("Vertical scale 0–", "纵轴 0–")}
          {metric === "zonePerGame"
            ? maximum + t(" attempts/game", " 次/场")
            : Math.round(maximum * 100) +
              (relative ? t(" pp", " 个百分点") : "%")}
        </span>
        <span className="pf-reference-key">
          <i aria-hidden="true" />
          {t("Earlier period", "前期水平")}
        </span>
        {metric === "zonePerGame" && (
          <span>
            {t(
              "Two-point zones use estimated attempts",
              "两分区域的出手次数为估算值",
            )}
          </span>
        )}
      </div>
      <div
        className="pf-zone-scroll"
        role="region"
        aria-label={t("Season trends by shooting zone", "分区赛季走势")}
        tabIndex={0}
      >
        <table
          className="pf-zone-table"
          style={{ "--pf-years": years.length } as CSSProperties}
        >
          <caption className="pf-sr">{labels[metric]}</caption>
          <colgroup>
            <col className="pf-zone-col" />
            <col className="pf-before-col" />
            {years.map((s) => (
              <col key={s.year} />
            ))}
            <col className="pf-after-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t("Shot zone", "出手区域")}</th>
              <th scope="col" className="pf-before">
                {t("Earlier", "前期")}
                <small>{careerRange(pre.firstYear, pre.lastYear, t)}</small>
              </th>
              {years.map(({ year, season, stats }) => (
                <th
                  key={year}
                  scope="col"
                  className={
                    "pf-year-head" +
                    (year === selectedYear ? " is-selected" : "")
                  }
                >
                  {stats ? (
                    <button
                      type="button"
                      aria-pressed={year === selectedYear}
                      onClick={() => onYear(year)}
                      aria-label={t(
                        `View career year ${year}, ${seasonLabel(season)}`,
                        `查看第${year}季（${seasonLabel(season)}）`,
                      )}
                    >
                      {careerRange(year, year, t)}
                      <small>{seasonLabel(season)}</small>
                    </button>
                  ) : (
                    <>
                      {careerRange(year, year, t)}
                      <small>{t("No record", "无记录")}</small>
                    </>
                  )}
                </th>
              ))}
              <th scope="col" className="pf-after">
                {t("Later · change", "后期 · 较前期")}
                <small>{careerRange(post.firstYear, post.lastYear, t)}</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {regions.map((name, zone) => {
              const before = read(pre, zone),
                after = read(post, zone),
                values = years.map(({ stats }) => read(stats, zone));
              return (
                <tr key={zone}>
                  <th scope="row">
                    {name}
                    {distances[zone] && <small>{distances[zone]}</small>}
                  </th>
                  <td className="pf-before">{valueLabel(pre, zone)}</td>
                  <td className="pf-year-series" colSpan={years.length}>
                    <ZoneTrend
                      baseline={before}
                      values={values}
                      maximum={maximum}
                      relative={relative}
                      selectedIndex={selectedIndex}
                    />
                    <div className="pf-year-values">
                      {years.map(({ year, stats }, i) => {
                        const value = valueLabel(stats, zone);
                        const detail =
                          name +
                          " · " +
                          careerRange(year, year, t) +
                          " · " +
                          labels[metric] +
                          " " +
                          value +
                          " · " +
                          t("vs. earlier", "较前期") +
                          " " +
                          formatChange(values[i], before, metric, t);
                        return stats ? (
                          <button
                            type="button"
                            key={year}
                            className={
                              year === selectedYear ? "is-selected" : undefined
                            }
                            aria-pressed={year === selectedYear}
                            title={detail}
                            aria-label={detail}
                            onClick={() => onYear(year)}
                          >
                            {value}
                          </button>
                        ) : (
                          <span key={year}>—</span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="pf-after">
                    <b>{valueLabel(post, zone)}</b>
                    <small
                      title={t("Change from earlier period", "相对前期的变化")}
                    >
                      {formatChange(after, before, metric, t)}
                    </small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasLowSample && (
        <small className="pf-sample-note">
          {t(
            "* Fewer than 25 attempts in this zone (estimated for two-point zones).",
            "* 该区域出手少于 25 次，两分区域按估算出手数判断。",
          )}
        </small>
      )}
    </section>
  );
}
