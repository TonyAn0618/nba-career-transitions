import { ChevronDown } from "lucide-react";
import { percent, pp, seasonLabel, shortName } from "../lib/analysis";
import {
  followupReading,
  largestChangeGap,
  sharedCounterpart,
  type thirdSeasonReference,
} from "../lib/comparison-takeaways";
import type { TwinFollowup } from "../lib/paired-career";
import {
  metricChange,
  pointsPer36,
  scoutingReading,
  twinPerformance,
} from "../lib/twin-performance";
import { MIN_MATCH_FGA } from "../lib/transition-matches";
import type { SeasonRow, Translate } from "../lib/types";
import ThirdSeasonReference from "./ThirdSeasonReference";
import { bandNames } from "./TransitionCharts";

function numberText(value: number | null, signed = false) {
  if (value == null) return "—";
  const rounded = Number(value.toFixed(1));
  return (signed && rounded > 0 ? "+" : "") + rounded.toFixed(1);
}

function heldText(held: boolean | null, t: Translate) {
  return held == null
    ? ""
    : held
      ? t("· held", "· 延续")
      : t("· changed", "· 未延续");
}

function evidenceStatus(
  r: ReturnType<typeof twinPerformance>["later"][number],
  t: Translate,
) {
  if (!r.observable) return t("Outside coverage", "超出观察期");
  if (!r.row) return t("No record", "无赛季记录");
  if (r.fga == null) return t("Attempts unavailable", "出手数缺失");
  if (r.fga < MIN_MATCH_FGA) return t("Small sample", "小样本，仅展示");
  if (r.efficiencyHeld == null || r.scoringHeld == null)
    return t("Metric unavailable", "指标资料不全");
  return t("Included", "纳入判读");
}

export default function ComparisonTakeaway({
  pairs,
  changes,
  band,
  followup,
  reference,
  t,
}: {
  pairs: [SeasonRow, SeasonRow][];
  changes: (number | null)[][];
  band: number;
  followup: TwinFollowup;
  reference: ReturnType<typeof thirdSeasonReference>;
  t: Translate;
}) {
  const names = pairs.map(([, end]) => shortName(end.name));
  const labels =
    names[0] === names[1] ? pairs.map(([, end]) => end.name) : names;
  const zones = [
    t("at the rim", "篮下"),
    t("in the short paint", "近筐两分"),
    t("from mid-range", "中距离两分"),
    t("on long twos", "长两分"),
    t("from three", "三分"),
  ];
  const distances = bandNames(t);
  const counterpart = sharedCounterpart(changes[0], changes[1], band);
  const difference = largestChangeGap(changes[0], changes[1]);
  const [target, peer] = pairs;
  const performance = twinPerformance(
    peer[0],
    peer[1],
    followup.map((stage) => stage[1]),
  );
  const { result, action } = scoutingReading(
    target,
    peer,
    labels,
    band,
    zones[band],
    performance,
    t,
  );
  return (
    <section className="tm-takeaway" aria-labelledby="takeaway-heading">
      <h2 id="takeaway-heading">{t("Scouting recommendation", "球探建议")}</h2>
      <div className="tm-reading" aria-live="polite" aria-atomic="true">
        <p className="tm-outlook">{result}</p>
        <p className="tm-diagnosis">{action}</p>
      </div>
      <details className="tm-evidence">
        <summary>
          {t("View evidence", "查看依据")}{" "}
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="tm-evidence-body">
          <h3>
            {t(
              "Efficiency and scoring before and after the shift",
              "转型前后，效率和产量如何变化",
            )}
          </h3>
          <div className="tm-reference-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("Player", "球员")}</th>
                  <th scope="col">{t("Seasons", "起止赛季")}</th>
                  <th scope="col">
                    {t("TS vs. league (pp)", "相对真实命中率（百分点）")}
                  </th>
                  <th scope="col">{t("Change (pp)", "效率变化（百分点）")}</th>
                  <th scope="col">
                    {t("Points per 36 min", "每 36 分钟得分")}
                  </th>
                  <th scope="col">{t("Change (points)", "产量变化（分）")}</th>
                </tr>
              </thead>
              <tbody>
                {[peer, target].map(([from, to]) => (
                  <tr key={to.id}>
                    <th scope="row">{to.name}</th>
                    <td>
                      {seasonLabel(from.season)} → {seasonLabel(to.season)}
                    </td>
                    <td>
                      {numberText(from.rts, true)} → {numberText(to.rts, true)}
                    </td>
                    <td>{numberText(metricChange(from.rts, to.rts), true)}</td>
                    <td>
                      {numberText(pointsPer36(from))} →{" "}
                      {numberText(pointsPer36(to))}
                    </td>
                    <td>
                      {numberText(
                        metricChange(pointsPer36(from), pointsPer36(to)),
                        true,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>
            {t(
              `${peer[1].name} in the next three seasons`,
              `${peer[1].name} 的后三季追踪`,
            )}
          </h3>
          <div className="tm-reference-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("Season", "赛季")}</th>
                  <th scope="col">
                    {distances[band]} · {t("share", "占比")}
                  </th>
                  <th scope="col">
                    {t("TS vs. league (pp)", "相对真实命中率（百分点）")}
                  </th>
                  <th scope="col">
                    {t("Efficiency vs. start", "效率较转型前")}
                  </th>
                  <th scope="col">
                    {t("Points per 36 min", "每 36 分钟得分")}
                  </th>
                  <th scope="col">{t("Scoring vs. start", "产量较转型前")}</th>
                  <th scope="col">{t("Attempts", "总出手")}</th>
                  <th scope="col">{t("Evidence", "判读范围")}</th>
                </tr>
              </thead>
              <tbody>
                {performance.later.map((r) => (
                  <tr key={r.offset}>
                    <th scope="row">{seasonLabel(r.year)}</th>
                    <td>{percent(r.row?.shares[band] ?? null)}</td>
                    <td>{numberText(r.rts, true)}</td>
                    <td>
                      {numberText(r.efficiencyDelta, true)}{" "}
                      {heldText(r.efficiencyHeld, t)}
                    </td>
                    <td>{numberText(r.rate)}</td>
                    <td>
                      {numberText(r.scoringDelta, true)}{" "}
                      {heldText(r.scoringHeld, t)}
                    </td>
                    <td>{r.fga ?? "—"}</td>
                    <td>{evidenceStatus(r, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {t(
              "Relative true shooting is the player’s TS% minus the league TS% that season, in percentage points. Points per 36 minutes is points × 36 ÷ minutes played. Changes use unrounded values and are reported to one decimal place.",
              "相对真实命中率是球员真实命中率减去当季联盟均值，单位为百分点。每 36 分钟得分等于总得分 × 36 ÷ 上场分钟数。变化量用原始值相减后保留一位小数。",
            )}
          </p>
          <p>
            {t(
              `Each follow-up season is compared with the twin’s pre-shift season. A rise, fall or tie is retained if its direction matches the initial change at the displayed precision. A full three-season conclusion requires all three seasons to qualify. Each metric needs its own data and at least ${MIN_MATCH_FGA} total attempts that year. The historical cutoff is ${seasonLabel(target[1].season)}.`,
              `每季都与 twin 的转型前赛季比较。上升、下降或持平的方向与起止变化一致，就记为该季延续。只有连续三个赛季都符合才判为全程延续。各指标分别判断，当季总出手至少 ${MIN_MATCH_FGA} 次且对应数据齐全才纳入。历史记录截至所选区间结束季 ${seasonLabel(target[1].season)}。`,
            )}
          </p>
          <h3>{t("The matched intervals", "两人的转型区间")}</h3>
          <div className="tm-reference-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("Player", "球员")}</th>
                  <th scope="col">{t("Seasons", "赛季")}</th>
                  <th scope="col">
                    {distances[band]} · {t("share", "出手占比")}
                  </th>
                  {counterpart != null && (
                    <th scope="col">
                      {distances[counterpart]} · {t("share", "出手占比")}
                    </th>
                  )}
                  <th scope="col">
                    {distances[band]} · {t("FG accuracy", "命中率")}
                  </th>
                  <th scope="col">
                    {t("End TS vs. league", "结束季真实命中率相对联盟")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pairs.map(([a, b], i) => (
                  <tr key={b.id}>
                    <th scope="row">{b.name}</th>
                    <td>
                      {seasonLabel(a.season)} → {seasonLabel(b.season)}
                    </td>
                    <td>
                      {percent(a.shares[band])} → {percent(b.shares[band])} (
                      {pp(changes[i][band])})
                    </td>
                    {counterpart != null && (
                      <td>
                        {percent(a.shares[counterpart])} →{" "}
                        {percent(b.shares[counterpart])}
                      </td>
                    )}
                    <td>
                      {percent(a.fg[band])} → {percent(b.fg[band])}
                    </td>
                    <td>{pp(b.rts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {difference && (
            <p>
              {t(
                `The greatest difference in how their shares changed was ${zones[difference.band]}, at ${difference.gap.toFixed(1)} pp.`,
                `两人的${zones[difference.band]}占比变幅差距最大，相差 ${difference.gap.toFixed(1)} 个百分点。`,
              )}
            </p>
          )}
          <h3>{t("Follow-up for this pair", "两人后三季的记录")}</h3>
          {pairs.map(([a, b], side) => (
            <p key={b.id}>
              <b>{labels[side]}</b>
              {" · "}
              {followupReading(
                a.shares[band]!,
                band,
                followup.map((stage) => stage[side]),
                t,
              )}
            </p>
          ))}
          <ThirdSeasonReference
            reference={reference}
            zone={zones[band]}
            t={t}
          />
        </div>
      </details>
    </section>
  );
}
