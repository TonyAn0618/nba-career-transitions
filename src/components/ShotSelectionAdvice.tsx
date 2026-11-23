import { useMemo, useState } from "react";
import { percent, seasonLabel, shortName } from "../lib/analysis";
import { MIN_HISTORY_FGA, MIN_ZONE_FGA } from "../lib/career-peers";
import { shotSelectionScenarios, zoneNames } from "../lib/peer-shot-advice";
import type { FollowupPeriod } from "../lib/peer-followup";
import type { SeasonRow, Translate } from "../lib/types";

interface Props {
  anchor: SeasonRow;
  career: readonly SeasonRow[];
  peer?: SeasonRow;
  pre?: FollowupPeriod | null;
  post?: FollowupPeriod | null;
  t: Translate;
}

type SelectionModel = ReturnType<typeof shotSelectionScenarios>;
type Swap = SelectionModel["swaps"][number];

function precedent(swap: Swap, twin: string | null, t: Translate) {
  const names = zoneNames(t),
    to = names[swap.to.index],
    from = names[swap.from.index];
  if (swap.twin && twin)
    return t(
      `${twin} made the same shift as his league-relative true shooting rose and his scoring per 36 held or improved.`,
      `${twin} 后期也从${from}转向${to}，同期相对联盟真实命中率提高，每 36 分钟得分至少持平。`,
    );
  if (swap.own)
    return t(
      `His earlier mix featured more ${shots[swap.to.index]}, higher league-relative true shooting and at least as many points per 36.`,
      `他过去的出手分布中${from}更少、${to}更多，当时相对联盟真实命中率更高，每 36 分钟得分也至少与本季持平。`,
    );
  return null;
}

const shots = [
  "shots at the rim",
  "short twos",
  "mid-range shots",
  "long twos",
  "threes",
];

function pointAmount(value: number, t: Translate) {
  return value < 0.01
    ? t("less than 0.01 points", "不到 0.01 分")
    : t(`about ${value.toFixed(2)} points`, `约 ${value.toFixed(2)} 分`);
}

function takeaway(
  model: SelectionModel,
  anchor: SeasonRow,
  twin: string | null,
  t: Translate,
) {
  const player = shortName(anchor.name),
    names = zoneNames(t);
  const { baseline, tsAtPastAccuracy, strength, focus, lead } = model;
  const best = model.swaps[0];
  if (best && best.tier !== "scenario") {
    const from = names[best.from.index],
      to = names[best.to.index];
    const points = pointAmount(best.edge / best.every, t);
    let ts = "";
    if (baseline != null && best.projected != null) {
      const actual = percent(baseline, 2),
        estimate = percent(best.projected, 2);
      ts =
        actual === estimate
          ? t(
              ", a change of less than 0.01 percentage points in true shooting",
              "，整体真实命中率变化不到 0.01 个百分点",
            )
          : t(
              `, lifting true shooting from ${actual} to ${estimate}`,
              `，整体真实命中率由 ${actual} 估至 ${estimate}`,
            );
    }
    const scenario = t(
      `With shot volume, free throws and zone accuracy held fixed, one swap every ${best.every} games would add ${points} per game${ts}.`,
      `按总出手、罚球和各区准度不变试算，每 ${best.every} 场换投 1 次，平均每场可多得${points}${ts}。`,
    );
    if (best.tier === "trial") {
      const history = precedent(best, twin, t);
      return {
        action: t(
          `Try replacing a few of ${player}’s ${shots[best.from.index]} with ${shots[best.to.index]}.`,
          `${player} 可以把少量${from}换成${to}出手。`,
        ),
        reason: [scenario, history].filter(Boolean).join(t(" ", "")),
      };
    }
    return {
      action: t(
        `Review ${player}’s ${shots[best.from.index]} for possessions where ${shots[best.to.index]} were available.`,
        `先复盘 ${player} 的${from}回合，看看当时有没有${to}机会。`,
      ),
      reason: [
        best.every > 10
          ? t(
              "Comparable seasons offer few chances to make this swap.",
              "历史上能这样换投的回合很少。",
            )
          : t(
              "The estimated scoring advantage per shot is still uncertain.",
              "现有样本还难以确认两区每次出手的得分差距。",
            ),
        scenario,
      ].join(t(" ", "")),
    };
  }
  const personal = strength ?? focus;
  if (personal) {
    const zone = names[personal.index],
      volume = personal.perGame!.toFixed(1);
    const previous = percent(personal.pastFG),
      now = percent(personal.fg);
    const points = pointAmount(Math.abs(personal.gap), t);
    const seasons = personal.pastSeasons;
    const impact = t(
      `At this season’s ${volume} attempts per game, the change from ${previous} over ${seasons} prior ${seasons === 1 ? "season" : "seasons"} to ${now} this season amounts to a ${strength ? "gain" : "loss"} of ${points} per game.`,
      `按本季场均 ${volume} 次${zone}出手算，命中率从此前 ${seasons} 季的 ${previous} ${strength ? "升" : "降"}至 ${now}，相当于每场${strength ? "多" : "少"}得${points}。`,
    );
    let efficiency = "";
    if (baseline != null && tsAtPastAccuracy != null) {
      const actual = percent(baseline, 2),
        estimate = percent(tsAtPastAccuracy, 2);
      efficiency = t(
        `Actual true shooting was ${actual}, compared with an estimated ${estimate} if only this zone returned to its earlier accuracy.`,
        `本季实际真实命中率为 ${actual}，若只将${zone}命中率换回此前水平，则估为 ${estimate}。`,
      );
    }
    return {
      action: strength
        ? t(
            `Preserve ${player}’s existing ${shots[personal.index]}.`,
            `建议 ${player} 保留目前的${zone}出手机会。`,
          )
        : t(
            `Start by reviewing the quality of ${player}’s ${shots[personal.index]}.`,
            `优先复盘 ${player} 的${zone}出手质量。`,
          ),
      reason: [impact, efficiency].filter(Boolean).join(t(" ", "")),
    };
  }
  if (lead)
    return {
      action: t(
        `Start with ${player}’s ${shots[lead.index]} when reviewing his shot choices.`,
        `先从 ${player} 的${names[lead.index]}出手看起。`,
      ),
      reason: t(
        `This was his most frequent zone with about ${Math.round(lead.attempts!)} attempts this season. There is too little comparative evidence to estimate what a change would add.`,
        `本季约有 ${Math.round(lead.attempts!)} 次出手来自这个区域，是记录中最多的。可比较的数据不足，暂时无法估算调整能多得几分。`,
      ),
    };
  return {
    action: t(
      `Record where ${player} shoots before choosing a change.`,
      `先补齐 ${player} 的出手位置，再判断该怎么调整。`,
    ),
    reason: t(
      "This season has no recorded attempts with a positive count in any of the five zones.",
      "本季五个区域都缺少可用于比较的出手记录。",
    ),
  };
}

export default function ShotSelectionAdvice({
  anchor,
  career,
  peer,
  pre,
  post,
  t,
}: Props) {
  const model = useMemo(
    () => shotSelectionScenarios(anchor, career, pre, post),
    [anchor, career, pre, post],
  );
  const { swaps, zones, baseline } = model;
  const personalZone = model.strength ?? model.focus;
  const twin = peer ? shortName(peer.name) : null;
  const names = zoneNames(t);
  const conclusion = takeaway(model, anchor, twin, t);
  const best = swaps[0];
  const suggested = best && best.tier !== "scenario" ? best : undefined;
  // Exploring a what-if changes only the evidence, never the scouting conclusion.
  const [comparison, setComparison] = useState<string | null>(null);
  const swap =
    comparison === null ? suggested : swaps.find((s) => s.id === comparison);
  const history = swap ? precedent(swap, twin, t) : null;
  const missingTotals = [
    anchor.games == null || anchor.games <= 0
      ? t("games played", "出场数")
      : null,
    anchor.fga == null || anchor.fga <= 0
      ? t("field goal attempts", "总出手")
      : null,
    anchor.fta == null ? t("free throws", "罚球次数") : null,
    anchor.points == null ? t("points", "总得分") : null,
  ].filter(Boolean);
  return (
    <>
      <header className="pr-head">
        <h3 id="peer-transition-title">
          {t(
            "Shot selection for higher true shooting",
            "提高真实命中率的出手建议",
          )}
        </h3>
      </header>
      <div className="pr-summary">
        <div id="pr-decision-text" aria-live="polite">
          <p className="pr-decision">{conclusion.action}</p>
          <p className="pr-reason">{conclusion.reason}</p>
        </div>
        <details className="pr-evidence">
          <summary>{t("View evidence", "查看依据")}</summary>
          <div className="pr-evidence-body">
            {!swap && baseline != null && (
              <p>
                {t(
                  `Season true shooting: ${percent(baseline, 2)}.`,
                  `本季实际真实命中率为 ${percent(baseline, 2)}。`,
                )}
              </p>
            )}
            {!suggested && personalZone && (
              <p>
                {t(
                  `This season, ${shots[personalZone.index]} accounted for ${personalZone.perGame!.toFixed(1)} attempts per game at ${percent(personalZone.fg)}, against ${percent(personalZone.pastFG)} over the available prior three seasons. At today's volume the difference is ${(-personalZone.gap).toFixed(2)} points per game.`,
                  `本季场均${names[personalZone.index]}出手 ${personalZone.perGame!.toFixed(1)} 次，命中率从此前最多三季合计的 ${percent(personalZone.pastFG)} 变为 ${percent(personalZone.fg)}。用本季出手量折算，场均投篮得分${personalZone.gap > 0 ? "减少" : "增加"}约 ${Math.abs(personalZone.gap).toFixed(2)} 分。`,
                )}
              </p>
            )}
            {!peer && (
              <p>
                {t(
                  "This player has no eligible historical twin. The analysis uses his own records.",
                  "这名球员没有符合条件的历史参照，判断来自他本人的出手记录。",
                )}
              </p>
            )}
            {twin && !post && (
              <p>
                {t(
                  `${twin} has no follow-up data by the selected season.`,
                  `截至本季，${twin} 尚无可用的后续记录。`,
                )}
              </p>
            )}
            {model.personalRoute &&
              model.personalRoute.efficiency != null &&
              model.personalRoute.scoring != null && (
                <p>
                  {t(
                    `Compared with this season, the player’s previous three-season mix had fewer ${shots[model.personalRoute.from]} and more ${shots[model.personalRoute.to]}. Earlier minus current: ${model.personalRoute.efficiency.toFixed(1)} pp in league-relative TS and ${model.personalRoute.scoring.toFixed(1)} points per 36.`,
                    `与本季相比，他此前最多三季合计的出手分布里，${names[model.personalRoute.from]}占比的降幅和${names[model.personalRoute.to]}占比的升幅最大。用过往减本季，相对联盟真实命中率相差 ${model.personalRoute.efficiency.toFixed(1)} 个百分点，每36分钟得分相差 ${model.personalRoute.scoring.toFixed(1)} 分。`,
                  )}
                </p>
              )}
            {swaps.length > 0 && (
              <div className="pr-calculator">
                <label className="pr-zone">
                  {t("Estimate a swap", "换投试算")}
                  <select
                    aria-controls="pr-ts-scenario"
                    value={swap?.id ?? ""}
                    onChange={(e) => setComparison(e.target.value)}
                  >
                    {!suggested && (
                      <option value="">
                        {t("Choose two zones", "选择换投区域")}
                      </option>
                    )}
                    {swaps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {names[s.from.index]} → {names[s.to.index]}
                        {s.id === suggested?.id
                          ? t(" · discussed above", " · 正文所述")
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div id="pr-ts-scenario" aria-live="polite">
                  {swap && (
                    <>
                      {baseline != null &&
                        swap.projected != null &&
                        !missingTotals.length && (
                          <p className="pr-estimate">
                            {t(
                              `Swapping one attempt every ${swap.every} games would move estimated true shooting from ${percent(baseline, 2)} to ${percent(swap.projected, 2)}.`,
                              `假设每 ${swap.every} 场换投一次，真实命中率由 ${percent(baseline, 2)} 估至 ${percent(swap.projected, 2)}。`,
                            )}
                          </p>
                        )}
                      <p>
                        {t(
                          `Points per attempt are ${swap.from.value!.points.toFixed(2)} for ${shots[swap.from.index]} and ${swap.to.value!.points.toFixed(2)} for ${shots[swap.to.index]}. The estimate holds total attempts, free throws and zone accuracy fixed.`,
                          `${names[swap.from.index]}每次出手平均得 ${swap.from.value!.points.toFixed(2)} 分，${names[swap.to.index]}为 ${swap.to.value!.points.toFixed(2)} 分。估算按总出手、罚球及分区命中率不变计算。`,
                        )}
                      </p>
                      {swap.id !== suggested?.id && (
                        <p>
                          {history ??
                            t(
                              "This is a what-if estimate. The full historical criteria for a trial are not met.",
                              "这组换投只用于试算，现有记录尚未同时满足主要出手变化、历史表现和可调整幅度的试行条件。",
                            )}
                          {swap.tier === "review" &&
                            !swap.clear &&
                            t(
                              " The scoring advantage is uncertain.",
                              " 分区得分优势尚不确定。",
                            )}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            {!!missingTotals.length && (
              <p>
                {t(
                  `An overall efficiency estimate still needs valid ${missingTotals.join(", ")}.`,
                  `估算整体效率还需要有效的${missingTotals.join("、")}记录。`,
                )}
              </p>
            )}
            {twin &&
              pre?.rts != null &&
              post?.rts != null &&
              pre.points36 != null &&
              post.points36 != null && (
                <p>
                  {t(
                    `${twin}’s league-relative true shooting moved from ${pre.rts.toFixed(1)} to ${post.rts.toFixed(1)} percentage points and points per 36 from ${pre.points36.toFixed(1)} to ${post.points36.toFixed(1)}.`,
                    `${twin} 转型前后的相对联盟真实命中率从 ${pre.rts.toFixed(1)} 变为 ${post.rts.toFixed(1)} 个百分点，每36分钟得分从 ${pre.points36.toFixed(1)} 变为 ${post.points36.toFixed(1)}。`,
                  )}
                </p>
              )}
            <table>
              <caption>
                {t("Five shooting zones", "五区出手记录")} ·{" "}
                {seasonLabel(anchor.season)}
              </caption>
              <thead>
                <tr>
                  {[
                    t("Zone", "区域"),
                    t("Season attempts (approx.)", "本季出手（约）"),
                    t("FG% used", "取样命中率"),
                    t("Sample", "样本"),
                  ].map((v) => (
                    <th scope="col" key={v}>
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.index}>
                    <th scope="row">{names[z.index]}</th>
                    <td>
                      {z.attempts == null
                        ? t("Missing", "缺记录")
                        : Math.round(z.attempts)}
                    </td>
                    <td>{percent(z.rate)}</td>
                    <td>
                      {z.pooled
                        ? t("Up to three seasons", "最多三季")
                        : t("This season", "本季")}{" "}
                      · {Math.round(z.n)} {t("shots", "次")}
                      {!z.value && t(" · insufficient", " · 样本不足")}
                      {z.attempts != null &&
                        z.attempts > 0 &&
                        z.fg == null &&
                        t(" · season accuracy missing", " · 本季命中率缺记录")}
                      {z.value &&
                        z.perGame == null &&
                        t(" · season volume missing", " · 本季场均量缺记录")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="pr-method">
              <summary>{t("Calculation and limits", "计算方法与限制")}</summary>
              <p>
                {t(
                  `The model uses points per attempt (FG% × 2 or 3). Zones with fewer than ${MIN_ZONE_FGA} usable attempts borrow up to two prior seasons, weighted by attempts. Zones still below the threshold appear only in the table. Two-point counts are estimated from distance shares.`,
                  `每次出手得分用命中率乘以两分或三分。某区本季不足 ${MIN_ZONE_FGA} 次时，按出手量合并此前最多两季。合计仍不足的区域只展示记录。两分出手数由距离占比估算。`,
                )}
              </p>
              <p>
                {t(
                  `First identify the largest share decrease and increase across all five zones in the same historical comparison. Both minute-adjusted attempt rates must agree, with at least ${MIN_HISTORY_FGA} total attempts per period. Compare the selected twin before and after the matched career year, or the player's current mix with up to three earlier seasons pooled. The comparison mix must have higher league-relative TS and no decline in points per 36. Keep only a positive points-per-shot edge for the player. For a trial, it must also appear in separate current and past samples, or have a positive approximate 95% lower bound for the difference using Wilson limits. Trial volume is capped by the observed shift, at one swap every two to ten games. Prefer the selected twin among supported trials. When no route is supported, compare each zone’s accuracy change at current volume and highlight the largest gain or loss. A historical association does not establish causation.`,
                  `先用五区占比找出同一段历史中降幅和升幅最大的两个区域，再核对相同上场时间下的出手次数是否同向。每段历史至少 ${MIN_HISTORY_FGA} 次总出手。参照取匹配生涯年前后，也可将本人此前最多三季合计与本季比较。只有对应阶段相对联盟效率更高、每36分钟得分至少持平，且这组换投对球员本人每次出手的估算得分有利，才考虑借鉴。在本季和此前独立样本中均有得分优势，或差值的近似 95% 下限（按 Wilson 区间计算）大于零，才建议试行。幅度不超过实际观察到的变化，每两至十场换投一次。同等证据下优先采用所选参照。缺少可借鉴路线时，按本季出手量比较各区命中率变化对应的得分增减，取影响最大的一项。这些历史变化可能也受到角色和防守等因素的影响。`,
                )}
              </p>
              <p>
                {t(
                  "True shooting = points ÷ [2 × (FGA + 0.44 × FTA)]. The quality of the extra looks and changes in foul drawing affect the actual outcome.",
                  "真实命中率 = 得分 ÷ [2 ×（总出手 + 0.44 × 罚球次数）]。新机会的防守强度及造犯规能力会影响实际结果。",
                )}
              </p>
            </details>
          </div>
        </details>
      </div>
    </>
  );
}
