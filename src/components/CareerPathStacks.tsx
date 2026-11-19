import { useEffect, useRef, useState } from "react";
import {
  percent,
  PLAYER_COLORS,
  seasonLabel,
  shortName,
} from "../lib/analysis";
import { pathObservation, type StyleMatch } from "../lib/style-paths";
import type { SeasonRow, Translate } from "../lib/types";
import { BAND_COLORS, bandNames } from "./TransitionCharts";

export default function CareerPathStacks({
  anchor,
  match,
  careers,
  offset,
  earliestOffset,
  zone,
  onSelect,
  onZone,
  t,
}: {
  anchor: SeasonRow;
  match?: StyleMatch;
  careers: Map<string, SeasonRow[]>;
  offset: number;
  earliestOffset: number;
  zone: number | null;
  onSelect: (offset: number) => void;
  onZone: (zone: number | null) => void;
  t: Translate;
}) {
  const [expanded, setExpanded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const bases = match ? [anchor, match.baseline] : [anchor];
  const earliest = Math.min(
    -3,
    ...bases.flatMap((base) =>
      (careers.get(base.playerId) ?? []).map((r) => r.season - base.season),
    ),
  );
  const first = expanded ? earliest : earliestOffset;
  const offsets = Array.from({ length: 4 - first }, (_, i) => first + i);
  const names = bandNames(t);
  const sameAge = !match || match.baseline.age === anchor.age;
  useEffect(() => {
    const container = scroller.current;
    const column = container?.querySelector<HTMLElement>(
      ".path-season-column.selected",
    );
    if (container && column) {
      const relativeLeft =
        column.getBoundingClientRect().left -
        container.getBoundingClientRect().left;
      container.scrollLeft +=
        relativeLeft - (container.clientWidth - column.clientWidth) / 2;
    }
  }, [offset, first]);
  return (
    <section
      className="path-panel path-stack-panel"
      aria-label={t("Career shot mix", "生涯出手分布")}
    >
      <div className="path-heading">
        <h2>
          {t("Career shot mix", "生涯出手分布")} ·{" "}
          {sameAge
            ? t("Aligned by age", "按年龄对齐")
            : t("Aligned by reference", "按参考季对齐")}
        </h2>
        <button
          className="path-history-toggle"
          aria-pressed={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? t("Recent seasons", "收起早期赛季")
            : t("Full history", "展开早期赛季")}
        </button>
      </div>
      <div className="path-stack-legend">
        <button aria-pressed={zone == null} onClick={() => onZone(null)}>
          {t("All zones", "全部分区")}
        </button>
        {names.map((name, i) => (
          <button
            key={name}
            aria-pressed={zone === i}
            onClick={() => onZone(zone === i ? null : i)}
          >
            <i style={{ background: BAND_COLORS[i] }} />
            {name}
          </button>
        ))}
        <span>{t("Each column = 100%", "每根柱合计100%")}</span>
      </div>
      <div className="path-stack-scroller" ref={scroller}>
        <div
          className="path-stack-content"
          style={{ minWidth: `${96 + offsets.length * 72}px` }}
        >
          <div
            className="path-stack-axis"
            style={{
              gridTemplateColumns: `88px repeat(${offsets.length}, minmax(0, 1fr))`,
            }}
          >
            <span>
              {sameAge ? t("Age", "年龄") : t("Year from ref.", "距参考季")}
            </span>
            {offsets.map((o) => (
              <span key={o} className={o === 0 ? "reference" : ""}>
                {sameAge ? anchor.age! + o : o > 0 ? `+${o}` : o}
                {o === 0 && <small>{t("Reference", "参考季")}</small>}
              </span>
            ))}
          </div>
          {bases.map((base, side) => (
            <div
              className="path-stack-row"
              key={base.id}
              style={{
                gridTemplateColumns: `88px repeat(${offsets.length}, minmax(0, 1fr))`,
              }}
            >
              <div
                className="path-stack-name"
                style={{ color: PLAYER_COLORS[side] }}
              >
                <b>{shortName(base.name)}</b>
                <small>100%</small>
                <small>0%</small>
              </div>
              {offsets.map((o) => {
                const observation = pathObservation(
                  base,
                  careers.get(base.playerId) ?? [],
                  o,
                  anchor.season,
                );
                const complete =
                  observation.row?.shares.every((n) => n != null) ?? false;
                const total =
                  observation.row?.shares.reduce<number>(
                    (sum, n) => sum + (n ?? 0),
                    0,
                  ) ?? 0;
                const available = complete && total > 0;
                const status =
                  observation.status === "outside"
                    ? t("After reference date", "参考时点之后")
                    : t("No record", "无记录");
                return (
                  <button
                    key={o}
                    className={`path-season-column ${o === offset ? "selected" : ""} ${o === 0 ? "reference" : ""}`}
                    aria-label={`${base.name} · ${seasonLabel(observation.year)} · ${t("inspect", "查看")}`}
                    aria-pressed={o === offset}
                    onClick={() => onSelect(o)}
                  >
                    <span
                      className={`path-season-stack ${available ? "" : "missing"} ${observation.status === "sample" ? "sample" : ""}`}
                    >
                      {available ? (
                        observation.row!.shares.map((share, i) => (
                          <span
                            key={i}
                            style={{
                              height: `${(share! / total) * 100}%`,
                              background: BAND_COLORS[i],
                              opacity: zone == null || zone === i ? 1 : 0.2,
                            }}
                          >
                            <span>
                              {share! >= 0.13 || (zone === i && share! >= 0.07)
                                ? percent(share)
                                : ""}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="path-stack-missing">{status}</span>
                      )}
                    </span>
                    <span className="path-season-caption">
                      {seasonLabel(observation.year)}
                      {observation.status === "sample" && (
                        <small>{t("<200 FGA", "<200次出手")}</small>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="path-footnote">
        {t(
          "Select a season to link views. Hatching: missing or after reference date. <200: small sample.",
          "点选赛季联动。斜纹：缺失或参考时点之后；<200：小样本。",
        )}
      </p>
    </section>
  );
}
