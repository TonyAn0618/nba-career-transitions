import { percent } from "../lib/analysis";
import type { Translate } from "../lib/types";
import "./zone-pair-bars.css";

interface ZoneSeries {
  label: string;
  values: (number | null)[];
  color: string;
  lowSample?: boolean[];
  seasonAccuracy?: { fg: number | null; ts: number | null };
}

interface Props {
  zones: string[];
  distances?: string[];
  series: ZoneSeries[];
  showLegend?: boolean;
  activeZone?: number | null;
  t: Translate;
}

function RateValue({ value, t }: { value: number | null; t: Translate }) {
  if (value != null) return percent(value);
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="zp-reader">{t("Unavailable", "暂无数据")}</span>
    </>
  );
}

function SeasonRateMark({
  metric,
  value,
  axisMax,
}: {
  metric: "FG" | "TS";
  value: number;
  axisMax: number;
}) {
  const kind = metric.toLowerCase();
  return (
    <span
      className={`zp-rate-mark zp-${kind}-mark`}
      style={{ width: (value / axisMax) * 100 + "%" }}
    >
      <i className={`zp-${kind}-bar`} aria-hidden="true" />
      <span className="zp-end-label">
        {metric} {percent(value)}
      </span>
    </span>
  );
}

export default function ZonePairBars({
  zones,
  distances,
  series,
  activeZone,
  t,
  showLegend = true,
}: Props) {
  const hasSmallSample = series.some((s) => s.lowSample?.some(Boolean));
  const hasSeasonAccuracy = series.some((s) => s.seasonAccuracy);
  const maxValue = Math.max(
    1,
    ...series.flatMap((s) => [
      ...s.values.map((v) => v ?? 0),
      s.seasonAccuracy?.fg ?? 0,
      s.seasonAccuracy?.ts ?? 0,
    ]),
  );
  const axisMax = Math.ceil(maxValue * 2) / 2;
  return (
    <div className="zone-pairs">
      {showLegend && (
        <div className="zp-legend" aria-hidden="true">
          {series.map((s, j) => (
            <span key={j}>
              <i style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {hasSeasonAccuracy && (
        <div className="zp-legend zp-metric-legend">
          <span>
            <i className="zp-fg-key" aria-hidden="true" />
            {t("Field goal percentage (FG%)", "投篮命中率（FG%）")}
          </span>
          <span>
            <i className="zp-ts-key" aria-hidden="true" />
            {t("True shooting percentage (TS%)", "真实命中率（TS%）")}
          </span>
        </div>
      )}
      <div className="zp-axis" aria-hidden="true">
        <span>0%</span>
        <span>{percent(axisMax / 2, 0)}</span>
        <span>{percent(axisMax, 0)}</span>
      </div>
      <ul className="zp-groups">
        {hasSeasonAccuracy && (
          <li className="zp-season-accuracy">
            <strong>{t("Overall", "全季")}</strong>
            {series.map(({ seasonAccuracy, label, color }) => {
              if (!seasonAccuracy) return null;
              const { fg, ts } = seasonAccuracy;
              return (
                <div key={label} className="zp-nested-row">
                  <div className="zp-season-caption">
                    <span style={{ color }}>{label}</span>
                    {fg == null && (
                      <span>
                        FG <RateValue value={null} t={t} />
                      </span>
                    )}
                    {ts == null && (
                      <span>
                        TS <RateValue value={null} t={t} />
                      </span>
                    )}
                  </div>
                  <div className="zp-bars">
                    <div className="zp-nested-track" style={{ color }}>
                      {fg != null && (
                        <SeasonRateMark
                          metric="FG"
                          value={fg}
                          axisMax={axisMax}
                        />
                      )}
                      {ts != null && (
                        <SeasonRateMark
                          metric="TS"
                          value={ts}
                          axisMax={axisMax}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </li>
        )}
        {zones.map((zone, i) => (
          <li className={activeZone === i ? "zp-active" : undefined} key={zone}>
            <strong>
              {zone}
              {distances?.[i] && (
                <span className="zp-distance">{distances[i]}</span>
              )}
            </strong>
            <div className="zp-bars">
              {series.map((s, j) => {
                const value = s.values[i] ?? null;
                return (
                  <div className="zp-row" key={j}>
                    <span className="zp-reader">{s.label} </span>
                    <i
                      aria-hidden="true"
                      style={{
                        width: ((value ?? 0) / axisMax) * 100 + "%",
                        backgroundColor: s.color,
                      }}
                    />
                    <span className="zp-value">
                      <RateValue value={value} t={t} />
                      {s.lowSample?.[i] && value != null ? "*" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {hasSmallSample && (
        <small>
          {t(
            "* Fewer than 25 estimated attempts in this zone.",
            "* 该区估算出手少于 25 次。",
          )}
        </small>
      )}
    </div>
  );
}
