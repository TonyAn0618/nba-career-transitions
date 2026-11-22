import { useMemo, useState } from "react";
import { percent, seasonLabel, seasonRange } from "../lib/analysis";
import {
  peerFollowup,
  summarizeFollowupPeriod,
  type FollowupPeriod,
  type FollowupYear,
} from "../lib/peer-followup";
import type { SeasonRow, Translate } from "../lib/types";
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

function guidance(
  pre: FollowupPeriod,
  post: FollowupPeriod,
  last: FollowupPeriod | null,
  referenceName: string,
  t: Translate,
) {
  if (post.seasons === 1)
    return t(
      `Only one later season is recorded for ${referenceName}. More seasons are needed to assess whether the efficiency held up.`,
      `${referenceName} 目前只有一季后续记录，长期效率仍需更多赛季来判断。`,
    );
  if (
    pre.rts == null ||
    post.rts == null ||
    pre.points36 == null ||
    post.points36 == null
  )
    return t(
      `The available records for ${referenceName} do not cover both league-relative efficiency and scoring per 36 minutes.`,
      `${referenceName} 的相对联盟效率或每36分钟得分记录不完整，暂时难以判断这套打法能否维持得分。`,
    );
  const efficiency = Number((post.rts - pre.rts).toFixed(1)),
    production = Number((post.points36 - pre.points36).toFixed(1));
  if (efficiency > 0 && production >= 0) {
    if (last?.rts != null && last.rts < pre.rts)
      return t(
        `${referenceName} sustained scoring per 36 minutes as league-relative efficiency rose. In the final recorded season, relative efficiency slipped below its earlier level.`,
        `${referenceName} 后期的相对联盟效率提高，每36分钟得分也得以维持。最后一个有记录的赛季，相对效率又降到了前期水平以下。`,
      );
    return t(
      `${referenceName} sustained scoring per 36 minutes as league-relative efficiency rose. This shot mix is worth a limited trial.`,
      `${referenceName} 后期的相对联盟效率提高，每36分钟得分也得以维持。这种出手调整值得小幅试行。`,
    );
  }
  if (efficiency <= 0 && production < 0)
    return t(
      `${referenceName}’s later scoring per 36 minutes fell and league-relative TS did not improve. The case offers little support for adopting that mix to sustain scoring efficiency.`,
      `${referenceName} 后期每36分钟得分下降，相对联盟的真实命中率也没有提高。仅凭这段经历，还难以判断采用相同的出手比例能否维持得分效率。`,
    );
  if (efficiency > 0)
    return t(
      `${referenceName} gained league-relative efficiency as scoring per 36 minutes fell. This mix may suit a smaller scoring role.`,
      `${referenceName} 后期的相对联盟效率提高，每36分钟得分下降。如果能接受较低的得分产量，这种取舍才值得考虑。`,
    );
  return t(
    `${referenceName} sustained scoring per 36 minutes while league-relative TS did not improve. The useful precedent is how the player maintained scoring volume.`,
    `${referenceName} 维持了每36分钟得分，相对联盟效率的提升则不明显。这个案例可用来观察如何保持得分产量。`,
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
  const cut = shifts.length === zones.length ? shifts.at(-1) : undefined;
  const targetShare = cut ? target?.shares[cut.zone] : null;
  const peerShare = cut ? post?.shares[cut.zone] : null;
  const share = post?.shares[zone],
    observed = target?.zonePerGame[zone],
    volume = target?.fgaPerGame;
  const scenario = share != null && volume != null ? share * volume : null;
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
      </header>
      {!pre || !post ? (
        <p className="ap-empty">
          {t(
            `No later regular-season record is available for ${peer.name} after career year ${matchYear}.`,
            `本库没有 ${peer.name} 第${matchYear}季之后的常规赛记录。`,
          )}
        </p>
      ) : (
        <>
          <div className="pr-advice">
            <div className="pr-reading">
              {cut &&
                cut.change < -0.05 &&
                targetShare != null &&
                peerShare != null && (
                  <p>
                    {t(
                      `In year ${matchYear}, ${anchor.name} took ${percent(targetShare)} of shots in this zone (${zones[cut.zone].toLowerCase()}). ${peer.name} cut this area the most, reaching ${percent(peerShare)} of attempts in the later period.`,
                      `第${matchYear}季，${anchor.name} 的${zones[cut.zone]}出手占比为 ${percent(targetShare)}。${peer.name} 缩减最多的是这个区域，后期占比为 ${percent(peerShare)}。`,
                    )}
                  </p>
                )}
              <p>
                {guidance(pre, post, years.at(-1)?.stats ?? null, peer.name, t)}
              </p>
            </div>
            <div className="pr-scenario">
              <div className="pr-scenario-head">
                <strong>{t("Attempts per game", "场均出手换算")}</strong>
                <select
                  aria-label={t(
                    "Zone for shot-volume calculation",
                    "换算出手区域",
                  )}
                  value={zone}
                  onChange={(e) => setZone(Number(e.target.value))}
                >
                  {zones.map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
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
                    {anchor.ts != null &&
                      t(
                        ` Track ${anchor.name}’s TS against that season’s ${percent(anchor.ts)}.`,
                        `试行时可对照该季 ${percent(anchor.ts)} 的真实命中率。`,
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
