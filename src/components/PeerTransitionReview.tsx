import { useMemo } from "react";
import { percent, seasonLabel, seasonRange } from "../lib/analysis";
import {
  peerFollowup,
  zoneShifts,
  type FollowupPeriod,
  type FollowupYear,
} from "../lib/peer-followup";
import type { SeasonRow, Translate } from "../lib/types";
import { zoneNames } from "../lib/peer-shot-advice";
import ShotSelectionAdvice from "./ShotSelectionAdvice";
import PeerFollowupTrends from "./PeerFollowupTrends";
import "./peer-transition-review.css";

interface Props {
  anchor: SeasonRow;
  peer: SeasonRow;
  career: readonly SeasonRow[];
  playerCareer: readonly SeasonRow[];
  debut: number;
  matchYear: number;
  selectedYear: number | null;
  onYear: (year: number) => void;
  t: Translate;
}

function yearRange(period: FollowupPeriod, t: Translate) {
  const { firstYear: a, lastYear: b } = period;
  if (a === b) return t(`Year ${a}`, `第${a}季`);
  return t(`Years ${a}–${b}`, `第${a}–${b}季`);
}

function signed(value: number, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  return (
    (rounded < 0 ? "−" : rounded > 0 ? "+" : "") +
    Math.abs(rounded).toFixed(digits)
  );
}

function mixChange(
  pre: FollowupPeriod,
  post: FollowupPeriod,
  shifts: ReturnType<typeof zoneShifts>,
  t: Translate,
) {
  const names = zoneNames(t);
  const gain = shifts[0],
    loss = shifts.at(-1);
  if (!gain || !loss || gain.change < 0.05 || loss.change > -0.05) return null;
  const increase = names[gain.zone],
    decrease = names[loss.zone];
  const before = pre.zonePerGame[gain.zone],
    after = post.zonePerGame[gain.zone];
  return (
    t(
      `The share of ${increase.toLowerCase()} rose ${gain.change.toFixed(1)} pp. The share of ${decrease.toLowerCase()} fell ${Math.abs(loss.change).toFixed(1)} pp.`,
      `${increase}出手占比提高 ${gain.change.toFixed(1)} 个百分点，${decrease}占比下降 ${Math.abs(loss.change).toFixed(1)} 个百分点。`,
    ) +
    (before == null || after == null
      ? ""
      : t(
          ` ${increase} attempts per game went from ${before.toFixed(2)} to ${after.toFixed(2)} (${signed(after - before, 2)}).`,
          `场均${increase}出手从 ${before.toFixed(2)} 次变为 ${after.toFixed(2)} 次（${signed(after - before, 2)} 次/场）。`,
        ))
  );
}

function EfficiencyComparison({
  pre,
  post,
  t,
}: {
  pre: FollowupPeriod;
  post: FollowupPeriod;
  t: Translate;
}) {
  const metrics = [
    {
      name: t("True shooting (TS%)", "真实命中率"),
      key: "ts",
      scale: 100,
      unit: "%",
    },
    {
      name: t("TS vs. league (pp)", "相对联盟 TS（百分点）"),
      key: "rts",
      scale: 1,
      unit: "",
    },
    { name: t("Points / game", "场均得分"), key: "ppg", scale: 1, unit: "" },
    {
      name: t("Points / 36 min", "每36分钟得分"),
      key: "points36",
      scale: 1,
      unit: "",
    },
    {
      name: t("Attempts / game", "场均总出手"),
      key: "fgaPerGame",
      scale: 1,
      unit: "",
    },
    {
      name: t("Minutes / game", "场均上场时间"),
      key: "mpg",
      scale: 1,
      unit: "",
    },
  ] as const;
  return (
    <div className="pr-efficiency-table">
      <h4>{t("Scoring and efficiency", "得分与效率")}</h4>
      <table
        aria-label={t(
          "Scoring and efficiency by period",
          "前后两段得分与效率对比",
        )}
      >
        <thead>
          <tr>
            <th scope="col">{t("Metric", "指标")}</th>
            <th scope="col">{yearRange(pre, t)}</th>
            <th scope="col">{yearRange(post, t)}</th>
            <th scope="col">{t("Change", "变化")}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(({ name, key, scale, unit }) => {
            const a = pre[key],
              b = post[key];
            const display = (v: number | null) =>
              v == null
                ? "—"
                : key === "rts"
                  ? signed(v)
                  : (v * scale).toFixed(1) + unit;
            return (
              <tr key={key}>
                <th scope="row">{name}</th>
                <td>{display(a)}</td>
                <td>{display(b)}</td>
                <td>
                  {a == null || b == null
                    ? "—"
                    : signed((b - a) * scale) +
                      (key === "ts" ? t(" pp", " 个百分点") : "")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Describe the pace only between adjacent recorded seasons. A gap cannot establish a one-year change.
function tsTrajectory(years: FollowupYear[], t: Translate) {
  const observations = years.flatMap(({ year, stats }) =>
    stats?.ts == null ? [] : [{ year, ts: stats.ts }],
  );
  if (observations.length < 2)
    return observations.length
      ? t("One season with TS data.", "只有一季有真实命中率记录。")
      : null;
  const first = observations[0],
    last = observations[observations.length - 1];
  const diff = (last.ts - first.ts) * 100;
  if (Math.abs(diff) < 0.05)
    return t(
      `TS changed by less than 0.05 pp between years ${first.year} and ${last.year}.`,
      `第${first.year}季与第${last.year}季的真实命中率相差不足 0.05 个百分点。`,
    );
  const netChange = Math.abs(diff).toFixed(1);
  const headline = t(
    `TS ${diff < 0 ? "fell" : "rose"} ${netChange} pp from year ${first.year} to year ${last.year}.`,
    `第${first.year}至第${last.year}季，真实命中率${diff < 0 ? "下降" : "上升"} ${netChange} 个百分点。`,
  );
  if (observations.length < 3) return headline;
  const changes = observations.slice(1).flatMap((o, i) =>
    o.year === observations[i].year + 1
      ? [
          {
            from: observations[i].year,
            to: o.year,
            delta: (o.ts - observations[i].ts) * 100,
          },
        ]
      : [],
  );
  const movement = changes
    .filter((c) => Math.sign(c.delta) === Math.sign(diff))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  if (!movement) return headline;
  const amount = Math.abs(movement.delta).toFixed(1);
  return (
    headline +
    t(
      ` The largest one-season ${diff < 0 ? "drop" : "gain"} was ${amount} pp between years ${movement.from} and ${movement.to}.`,
      `其中第${movement.from}到第${movement.to}季的${diff < 0 ? "降幅" : "升幅"}最大，为 ${amount} 个百分点。`,
    )
  );
}

function LaterEfficiency({
  years,
  selectedYear,
  onYear,
  t,
}: {
  years: FollowupYear[];
  selectedYear: number | null;
  onYear: Props["onYear"];
  t: Translate;
}) {
  const limit = Math.max(1, ...years.map((y) => y.stats?.ts ?? 0));
  return (
    <div className="pr-annual">
      <h4>{t("Later true shooting by season", "后续逐季真实命中率")}</h4>
      <div className="pr-ts-list">
        {years.map(({ year, season, stats }) => (
          <button
            type="button"
            key={year}
            disabled={!stats}
            aria-pressed={year === selectedYear}
            onClick={() => onYear(year)}
          >
            <span>
              {t(`Year ${year}`, `第${year}季`)}
              <small>
                {seasonLabel(season)}
                {stats?.games != null &&
                  t(` · ${stats.games} games`, ` · ${stats.games}场`)}
              </small>
            </span>
            <span className="pr-ts-track" aria-hidden="true">
              {stats?.ts != null && (
                <i style={{ width: (100 * stats.ts) / limit + "%" }} />
              )}
            </span>
            <b>{percent(stats?.ts ?? null)}</b>
          </button>
        ))}
      </div>
      <p>{tsTrajectory(years, t)}</p>
    </div>
  );
}

export default function PeerTransitionReview({
  anchor,
  peer,
  career,
  playerCareer,
  debut,
  matchYear,
  selectedYear,
  onYear,
  t,
}: Props) {
  const analysis = useMemo(
    () => peerFollowup(career, debut, matchYear),
    [career, debut, matchYear],
  );
  const { pre, post, years } = analysis;
  const known = useMemo(
    () =>
      peerFollowup(
        career.filter((r) => r.season <= anchor.season),
        debut,
        matchYear,
      ),
    [career, debut, matchYear, anchor.season],
  );
  const shifts = pre && post ? zoneShifts(pre, post) : [];
  return (
    <section
      className="pr-review"
      id="peer-transition"
      aria-labelledby="peer-transition-title"
    >
      <ShotSelectionAdvice
        anchor={anchor}
        peer={peer}
        career={playerCareer}
        pre={known.pre}
        post={known.post}
        t={t}
      />
      {!pre || !post ? (
        <p className="ap-empty">
          {t(
            `No before-and-after reference data for ${peer.name} at career year ${matchYear}.`,
            `${peer.name} 在生涯第${matchYear}季前后的记录不足，暂无历史对照。`,
          )}
        </p>
      ) : (
        <div role="group" aria-labelledby="pr-reference-name">
          <header className="pr-reference">
            <strong id="pr-reference-name">
              {t(
                `Historical reference · ${peer.name}`,
                `历史参照 · ${peer.name}`,
              )}
            </strong>
            <p>
              {[pre, post].map((period, i) => (
                <span key={i}>
                  <strong>{yearRange(period, t)}</strong> ·{" "}
                  {seasonRange(
                    debut + period.firstYear - 1,
                    debut + period.lastYear - 1,
                  )}
                  {period.games != null &&
                    t(` · ${period.games} games`, ` · ${period.games}场`)}
                  {period.lastYear - period.firstYear + 1 !== period.seasons &&
                    t(
                      ` · ${period.seasons} recorded seasons`,
                      ` · ${period.seasons}季有记录`,
                    )}
                </span>
              ))}
            </p>
          </header>
          <PeerFollowupTrends
            analysis={analysis}
            selectedYear={selectedYear}
            onYear={onYear}
            t={t}
          />
          <p className="pr-takeaway">{mixChange(pre, post, shifts, t)}</p>
          <div className="pr-outcomes">
            <EfficiencyComparison pre={pre} post={post} t={t} />
            <LaterEfficiency
              years={years}
              selectedYear={selectedYear}
              onYear={onYear}
              t={t}
            />
          </div>
        </div>
      )}
    </section>
  );
}
