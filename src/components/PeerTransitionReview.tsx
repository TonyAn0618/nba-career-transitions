import { useMemo, useState } from "react";
import { percent, seasonLabel, seasonRange } from "../lib/analysis";
import {
  peerFollowup,
  summarizeFollowupPeriod,
  type FollowupPeriod,
  type FollowupYear,
} from "../lib/peer-followup";
import type { SeasonRow, Translate } from "../lib/types";
import { peerShotAdvice } from "../lib/peer-shot-advice";
import PeerFollowupTrends from "./PeerFollowupTrends";
import "./peer-transition-review.css";

interface Props {
  anchor: SeasonRow;
  peer: SeasonRow;
  career: readonly SeasonRow[];
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

function zoneNames(t: Translate) {
  return [
    t("At rim", "篮下"),
    t("Short two", "近两分"),
    t("Mid-range", "中距离"),
    t("Long two", "长两分"),
    t("Three-pointers", "三分"),
  ];
}

function zoneShifts(pre: FollowupPeriod, post: FollowupPeriod) {
  return pre.shares
    .flatMap((v, i) => {
      const w = post.shares[i];
      return v == null || w == null ? [] : [{ zone: i, change: (w - v) * 100 }];
    })
    .sort((a, b) => b.change - a.change);
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
  const target = useMemo(
    () => summarizeFollowupPeriod([anchor], anchor.season - matchYear + 1),
    [anchor, matchYear],
  );
  const [zone, setZone] = useState(4);
  const { pre, post, years } = analysis;
  const zones = zoneNames(t);
  const shifts = pre && post ? zoneShifts(pre, post) : [];
  const advice =
    pre && post
      ? peerShotAdvice(
          target,
          pre,
          post,
          years.at(-1)?.stats ?? null,
          zone,
          zones[zone],
          anchor.name,
          peer.name,
          t,
        )
      : null;
  const share = post?.shares[zone],
    volume = target?.fgaPerGame;
  const observed = advice?.observed,
    scenario = advice?.scenario;
  return (
    <section
      className="pr-review"
      id="peer-transition"
      aria-labelledby="peer-transition-title"
    >
      <header className="pr-head">
        <h3 id="peer-transition-title">
          {t("Transition recommendations", "转型建议")}
        </h3>
        {advice && (
          <label className="pr-zone">
            {t("Shot zone", "关注区域")}
            <select
              value={zone}
              onChange={(e) => setZone(Number(e.target.value))}
              aria-controls="pr-decision-text"
            >
              {zones.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {!pre || !post || !advice ? (
        <p className="ap-empty">
          {t(
            `Keep ${anchor.name}’s current shot mix and select a reference with records both before and after career year ${matchYear}.`,
            `建议 ${anchor.name} 先沿用目前的出手安排，换一位第${matchYear}季前后都有记录的球员作参照。`,
          )}
        </p>
      ) : (
        <>
          <div className="pr-advice">
            <div className="pr-reading">
              <div id="pr-decision-text" aria-live="polite">
                <p className="pr-decision">{advice.action}</p>
                <p>{advice.reason}</p>
              </div>
              <details className="pr-evidence">
                <summary>
                  {t("Evidence and when to reassess", "查看依据与复核条件")}
                </summary>
                <p>
                  {t(
                    `${peer.name} · ${zones[zone]}: ${percent(pre.shares[zone])} → ${percent(post.shares[zone])} of attempts, ${pre.zonePerGame[zone]?.toFixed(2) ?? "—"} → ${post.zonePerGame[zone]?.toFixed(2) ?? "—"} attempts per game.`,
                    `${peer.name} 的${zones[zone]}占比从 ${percent(pre.shares[zone])} 变为 ${percent(post.shares[zone])}，场均出手从 ${pre.zonePerGame[zone]?.toFixed(2) ?? "—"} 变为 ${post.zonePerGame[zone]?.toFixed(2) ?? "—"} 次。`,
                  )}
                </p>
                {pre.rts != null &&
                  post.rts != null &&
                  pre.points36 != null &&
                  post.points36 != null && (
                    <p>
                      {t(
                        `Over the same periods, league-relative TS went from ${signed(pre.rts)} to ${signed(post.rts)} pp and points per 36 from ${pre.points36.toFixed(1)} to ${post.points36.toFixed(1)}.`,
                        `同期相对联盟真实命中率从 ${signed(pre.rts)} 变为 ${signed(post.rts)} 个百分点，每36分钟得分从 ${pre.points36.toFixed(1)} 变为 ${post.points36.toFixed(1)} 分。`,
                      )}
                    </p>
                  )}
                {target?.rts != null && target.points36 != null && (
                  <p>
                    {t(
                      `If testing a change, compare with ${anchor.name}’s ${seasonLabel(anchor.season)} baseline at similar total shot volume. Expand only if league-relative TS improves from ${signed(target.rts)} pp and points per 36 stay at or above ${target.points36.toFixed(1)}.`,
                      `若试调，在总出手量相近时与 ${anchor.name} 的 ${seasonLabel(anchor.season)} 赛季比较。等相对联盟真实命中率高于原来的 ${signed(target.rts)} 个百分点，且每36分钟得分维持在 ${target.points36.toFixed(1)} 分或以上，再扩大调整。`,
                    )}
                  </p>
                )}
                <p>
                  {t(
                    "The benchmark comes from one player. Changes in role or minutes can also affect the observed results.",
                    "参照来自一名球员，角色和上场时间的变化也会影响前后表现。",
                  )}
                </p>
              </details>
            </div>
            <div className="pr-scenario">
              <strong>{t("Attempts per game", "场均出手换算")}</strong>
              {scenario != null &&
              observed != null &&
              share != null &&
              volume != null ? (
                <>
                  <div className="pr-counts">
                    <span>
                      <small>
                        {t(
                          `Actual · year ${matchYear}`,
                          `第${matchYear}季实际`,
                        )}
                      </small>
                      <b>{observed.toFixed(2)}</b>
                    </span>
                    <span className="pr-arrow" aria-hidden="true">
                      →
                    </span>
                    <span>
                      <small>
                        {t("At the reference share", "按参照占比换算")}
                      </small>
                      <b>{scenario.toFixed(2)}</b>
                    </span>
                    <span className="pr-difference">
                      {t(
                        `${signed(scenario - observed, 2)} / game`,
                        `${signed(scenario - observed, 2)} 次/场`,
                      )}
                    </span>
                  </div>
                  <p>
                    {t(
                      `This applies ${peer.name}’s later share (${percent(share)}) to ${anchor.name}’s ${volume.toFixed(2)} attempts per game in ${seasonLabel(anchor.season)}.`,
                      `按 ${anchor.name} 在 ${seasonLabel(anchor.season)} 的场均 ${volume.toFixed(2)} 次总出手，代入 ${peer.name} 后期 ${percent(share)} 的${zones[zone]}占比。`,
                    )}
                  </p>
                </>
              ) : (
                <p>
                  {t(
                    "This zone lacks the data needed to estimate attempts per game.",
                    "所选区域缺少计算场均出手所需的数据。",
                  )}
                </p>
              )}
            </div>
          </div>
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
                    {period.lastYear - period.firstYear + 1 !==
                      period.seasons &&
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
        </>
      )}
    </section>
  );
}
