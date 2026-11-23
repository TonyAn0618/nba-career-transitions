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

function precedent(
  swap: Swap,
  season: number,
  twin: string | null,
  t: Translate,
) {
  const names = zoneNames(t);
  const from = names[swap.from.index],
    to = names[swap.to.index];
  if (swap.twin && twin) {
    return t(
      `${twin} later took fewer ${shots[swap.from.index]} and more ${shots[swap.to.index]} at comparable minutes`,
      `${twin} 后期在相同上场时间里减少了${from}、增加了${to}`,
    );
  }
  if (swap.own && swap.ownSeason != null) {
    const when =
      swap.ownSeason === season - 1
        ? t("last season", "上赛季")
        : t(
            `in ${seasonLabel(swap.ownSeason)}`,
            `在 ${seasonLabel(swap.ownSeason)} 赛季`,
          );
    return t(
      `he took fewer ${shots[swap.from.index]} and more ${shots[swap.to.index]} at comparable minutes ${when}`,
      `他${when}在相同上场时间里的${from}更少、${to}更多`,
    );
  }
  return null;
}

const shots = [
  "shots at the rim",
  "short twos",
  "mid-range shots",
  "long twos",
  "threes",
];

function takeaway(
  model: SelectionModel,
  anchor: SeasonRow,
  twin: string | null,
  t: Translate,
) {
  const player = shortName(anchor.name),
    names = zoneNames(t);
  const { focus, lead } = model;
  const best = model.swaps[0];
  if (best && best.tier !== "scenario") {
    const from = names[best.from.index],
      to = names[best.to.index];
    if (best.tier === "trial") {
      const history = precedent(best, anchor.season, twin, t);
      return {
        action: t(
          `Try replacing a few of ${player}’s ${shots[best.from.index]} with ${shots[best.to.index]}.`,
          `${player} 可以把少量${from}换成${to}出手。`,
        ),
        reason: history
          ? t(
              `He scores more per attempt on ${shots[best.to.index]}, and ${history}.`,
              `他的${to}平均每次出手得分更高，${history}。`,
            )
          : t(
              `He scores more per attempt on ${shots[best.to.index]}.`,
              `他的${to}平均每次出手得分更高。`,
            ),
      };
    }
    return {
      action: t(
        `Review ${player}’s ${shots[best.from.index]} for possessions where ${shots[best.to.index]} were available.`,
        `先复盘 ${player} 的${from}回合，看看当时有没有${to}机会。`,
      ),
      reason: best.clear
        ? t(
            "Very few attempts could be moved at the volume seen in comparable seasons.",
            "按以往的出手量看，真正能这样调整的回合很少。",
          )
        : t(
            "Past shot mixes make the change plausible, but the shooting sample is too close to establish an efficiency gain.",
            "以往的出手分布说明这样调整有可能，但两区的得分差距还不足以判断换投会提高效率。",
          ),
    };
  }
  if (focus) {
    const zone = names[focus.index];
    return {
      action: t(
        `Start by reviewing the quality of ${player}’s ${shots[focus.index]}.`,
        `优先复盘 ${player} 的${zone}出手质量。`,
      ),
      reason: t(
        "At his current shot volume, this zone’s drop in accuracy accounts for his largest scoring gap from previous seasons.",
        `按他本季的出手量算，${zone}命中率的回落对得分影响最大。`,
      ),
    };
  }
  if (lead)
    return {
      action: t(
        `Start with ${player}’s ${shots[lead.index]} when reviewing his shot choices.`,
        `先从 ${player} 的${names[lead.index]}出手看起。`,
      ),
      reason: t(
        "This is his most frequent recorded shot. The available data do not yet identify a reliable replacement.",
        "这是他本季出手最多的区域，现有记录还不足以确定哪种出手值得替换。",
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
  const { swaps, zones, baseline, focus } = model;
  const twin = peer ? shortName(peer.name) : null;
  const names = zoneNames(t);
  const conclusion = takeaway(model, anchor, twin, t);
  const best = swaps[0];
  const suggested = best && best.tier !== "scenario" ? best : undefined;
  // Exploring a what-if changes only the evidence, never the scouting conclusion.
  const [comparison, setComparison] = useState<string | null>(null);
  const swap =
    comparison === null ? suggested : swaps.find((s) => s.id === comparison);
  const history = swap ? precedent(swap, anchor.season, twin, t) : null;
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
            {!suggested && focus && (
              <p>
                {t(
                  `This season, ${shots[focus.index]} accounted for ${focus.perGame!.toFixed(1)} attempts per game at ${percent(focus.fg)}. His attempt-weighted accuracy in the preceding three-season window was ${percent(focus.pastFG)}.`,
                  `本季场均${names[focus.index]}出手 ${focus.perGame!.toFixed(1)} 次，命中率 ${percent(focus.fg)}，此前最多三季按出手次数合计为 ${percent(focus.pastFG)}。`,
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
                          {history
                            ? t(
                                `At the modeled volume, ${history}.`,
                                `按试算幅度，${history}。`,
                              )
                            : t(
                                "This is a hypothetical volume change. The available career records show no comparable shift at this scale.",
                                "这是一次假设换投，现有生涯记录中未找到能支持这个幅度的同向变化。",
                              )}
                          {swap.tier === "review" &&
                            !swap.clear &&
                            t(
                              " The zones’ scoring ranges overlap.",
                              " 两区得分的估计范围重叠。",
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
                  `A trial needs non-overlapping approximate 95% Wilson intervals for points per attempt and a comparable mix in the last three seasons or the twin’s before/after periods. Both shares and minute-adjusted counts must support the change, with at least ${MIN_HISTORY_FGA} attempts per period. The trial is limited to the observed volume and one shift every two to ten games. Within each evidence level twin-supported paths come first, followed by estimated scoring gain.`,
                  `建议小幅试行，要求两区每次出手得分的近似 95% Wilson 区间分开，且球员此前三季或参照球员的前后记录支持相应幅度。每段历史至少有 ${MIN_HISTORY_FGA} 次总出手，两区占比和按相同上场时间折算的次数均需同向变化。试算幅度上限为已观察到的机会量，试行范围为每两至十场换一次。同等证据下优先选参照球员有先例的路线，再按估算收益排序。`,
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
