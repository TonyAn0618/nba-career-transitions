import { useId, useState } from "react";
import { seasonRange } from "../lib/analysis";
import {
  MIN_ZONE_FGA,
  type CareerPeer,
  type CareerProfile,
} from "../lib/career-peers";
import type { Metric } from "../lib/ring-encoding";
import type { SeasonRow, Translate } from "../lib/types";
import PeerZoneRadar from "./PeerZoneRadar";
import "./peer-shooting-comparison.css";

export function PeerMatchRadar({
  anchor,
  target,
  selected,
  t,
}: {
  anchor: SeasonRow;
  target: CareerProfile;
  selected: CareerPeer;
  t: Translate;
}) {
  const [metric, setMetric] = useState<Metric>("fg");
  const headingId = useId();
  const year = target.careerYear;
  const title = t(`Shooting through year ${year}`, `前 ${year} 季投篮对比`);
  const zones = [
    t("At rim", "篮下"),
    t("Short two", "近两分"),
    t("Mid-range", "中距离"),
    t("Long two", "长两分"),
    t("Three", "三分"),
  ];
  const labels = {
    fg: t("FG% by zone", "分区命中率"),
    share: t("Shot share", "出手占比"),
  };
  const players = [
    { name: anchor.name, history: target, color: "var(--ap-player)" },
    {
      name: selected.baseline.name,
      history: selected.history,
      color: "var(--ap-peer)",
    },
  ];
  const series = players.map(({ name, history, color }, index) => ({
    label: name,
    color,
    peer: index === 1,
    values: metric === "fg" ? history.fg : history.shares,
    lowSample:
      metric === "fg"
        ? history.fgAttempts.map(
            (n, i) => n < MIN_ZONE_FGA && history.fg[i] != null,
          )
        : undefined,
  }));

  return (
    <section className="ap-match-radar" aria-labelledby={headingId}>
      <div className="ap-match-radar-head">
        <h4 id={headingId}>{title}</h4>
        <div
          className="ap-switch"
          role="group"
          aria-label={t("Matching profile metric", "匹配投篮指标")}
        >
          {(["fg", "share"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={choice === metric}
              onClick={() => setMetric(choice)}
            >
              {labels[choice]}
            </button>
          ))}
        </div>
      </div>
      <ul className="ap-radar-legend">
        {players.map(({ name, history, color }, index) => (
          <li
            key={index}
            title={seasonRange(history.firstSeason, history.lastSeason)}
          >
            <i
              className={index === 1 ? "ap-radar-key peer" : "ap-radar-key"}
              style={{ color }}
              aria-hidden="true"
            />
            <span>{name}</span>
            {history.shotSeasons < year && (
              <small>
                {t(
                  `${history.shotSeasons} seasons with zone data`,
                  `${history.shotSeasons} 季有分区记录`,
                )}
              </small>
            )}
          </li>
        ))}
      </ul>
      <PeerZoneRadar
        zones={zones}
        series={series}
        metric={labels[metric]}
        title={title}
        t={t}
      />
    </section>
  );
}
