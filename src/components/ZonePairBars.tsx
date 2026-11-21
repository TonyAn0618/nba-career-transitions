import { percent } from "../lib/analysis";
import type { Translate } from "../lib/types";
import "./zone-pair-bars.css";

interface ZoneSeries {
  label: string;
  values: (number | null)[];
  color: string;
  lowSample?: boolean[];
}

interface Props {
  zones: string[];
  series: ZoneSeries[];
  activeZone?: number | null;
  t: Translate;
}

export default function ZonePairBars({ zones, series, activeZone, t }: Props) {
  const hasSmallSample = series.some((s) => s.lowSample?.some(Boolean));
  return (
    <div className="zone-pairs">
      <div className="zp-legend" aria-hidden="true">
        {series.map((s, j) => (
          <span key={j}>
            <i style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="zp-axis" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <ul className="zp-groups">
        {zones.map((zone, i) => (
          <li className={activeZone === i ? "zp-active" : undefined} key={zone}>
            <strong>{zone}</strong>
            <div className="zp-bars">
              {series.map((s, j) => {
                const value = s.values[i] ?? null;
                return (
                  <div className="zp-row" key={j}>
                    <span className="zp-reader">{s.label} </span>
                    <i
                      aria-hidden="true"
                      style={{
                        width: (value ?? 0) * 100 + "%",
                        backgroundColor: s.color,
                      }}
                    />
                    <span className="zp-value">
                      {value == null ? (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="zp-reader">
                            {t("Unavailable", "暂无数据")}
                          </span>
                        </>
                      ) : (
                        percent(value)
                      )}
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
