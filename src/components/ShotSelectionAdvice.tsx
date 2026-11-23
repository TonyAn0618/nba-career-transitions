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
      `${twin}’s main shift was toward ${shots[swap.to.index]}, alongside better league-relative true shooting and at least as many points per 36`,
      `${twin} 后期主要从${from}转向${to}，同期相对联盟效率提高，每36分钟得分也守住了原有水平`,
    );
  if (swap.own)
    return t(
      `his earlier mix featured more ${shots[swap.to.index]}, higher league-relative true shooting and at least as many points per 36`,
      `他过去的出手分布中${from}更少、${to}更多，当时相对联盟效率更高，每36分钟得分也至少与本季持平`,
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

function decisionRules(t: Translate) {
  return {
    trial: {
      title: t("Try a swap", "小幅换投"),
      text: t(
        "The historical mix had higher league-relative true shooting and at least as many points per 36. Try the shift if the player also scores more per attempt in the new zone and the observed volume supports it.",
        "历史上采用这种分布时，相对联盟真实命中率更高，每36分钟得分至少持平。球员本人在新区域的每次出手得分也要有可靠优势，历史出手量要支持这次调整。",
      ),
    },
    review: {
      title: t("Review the swap on film", "先复盘换投机会"),
      text: t(
        "The historical results support a swap, but the player’s scoring advantage is uncertain or very few attempts could shift. Review the possessions first.",
        "历史表现支持换投，但球员自己的得分优势还不明确，或可调整的回合太少。先看录像，确认那些回合有没有更好的选择。",
      ),
    },
    personal: {
      title: t("Keep a strength or review a decline", "保留强项或复盘下滑"),
      text: t(
        "When no swap qualifies, weight each zone’s change in accuracy by current shot volume and shot value. If the largest effect is a gain, keep those looks. If it is a loss, review them.",
        "没有合适的换法时，按本季出手量和每球分值，把各区命中率的变化折算成得分。影响最大的是增益，就保留该区机会。如果是损失，就优先复盘。",
      ),
    },
    records: {
      title: t("Start with the available records", "缺少可比较的变化"),
      text: t(
        "Start with the most frequent recorded shot this season. If no location is recorded, collect that information first.",
        "先看本季出手最多的区域。没有可用的出手位置记录时，先补齐数据。",
      ),
    },
  };
}

function takeaway(
  model: SelectionModel,
  anchor: SeasonRow,
  twin: string | null,
  t: Translate,
): {
  rule: keyof ReturnType<typeof decisionRules>;
  action: string;
  reason: string;
} {
  const player = shortName(anchor.name),
    names = zoneNames(t);
  const { focus, lead } = model;
  const best = model.swaps[0];
  if (best && best.tier !== "scenario") {
    const from = names[best.from.index],
      to = names[best.to.index];
    if (best.tier === "trial") {
      const history = precedent(best, twin, t);
      return {
        rule: "trial",
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
      rule: "review",
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
  if (model.strength) {
    const zone = names[model.strength.index],
      route = model.twinRoute;
    const counterpart =
      twin &&
      route &&
      route.efficiency != null &&
      route.efficiency < 0 &&
      route.scoring != null &&
      route.scoring < 0
        ? t(
            `, while ${twin}’s shift toward ${shots[route.to]} coincided with lower efficiency and scoring per 36`,
            `，而 ${twin} 后期转向${names[route.to]}时，相对联盟效率和每36分钟得分都下降了`,
          )
        : "";
    return {
      rule: "personal",
      action: t(
        `Preserve ${player}’s existing ${shots[model.strength.index]}.`,
        `建议 ${player} 保留目前的${zone}出手机会。`,
      ),
      reason: t(
        `At his current volume, his accuracy gain in this zone adds more points than in any other sampled zone${counterpart}.`,
        `按本季出手量折算，${zone}命中率的进步为他带来的得分增量最大${counterpart}。`,
      ),
    };
  }
  if (focus) {
    const zone = names[focus.index];
    return {
      rule: "personal",
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
      rule: "records",
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
    rule: "records",
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
  const rules = decisionRules(t);
  const appliedRule = rules[conclusion.rule];
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
        <div className="pr-summary-row" aria-live="polite">
          <div id="pr-decision-text">
            <p className="pr-decision">{conclusion.action}</p>
            <p className="pr-reason">{conclusion.reason}</p>
          </div>
          <aside
            className="pr-applied-rule"
            aria-labelledby="pr-applied-rule-title"
          >
            <h4 id="pr-applied-rule-title">
              {t("Rule applied", "本次判断规则")} · {appliedRule.title}
            </h4>
            <p>{appliedRule.text}</p>
          </aside>
        </div>
        <details className="pr-evidence">
          <summary>
            {t("View evidence and decision rules", "查看依据与判断规则")}
          </summary>
          <div className="pr-evidence-body">
            <section className="pr-rules" aria-labelledby="pr-rules-title">
              <h4 id="pr-rules-title">
                {t("How the recommendation is chosen", "建议是怎么选出的？")}
              </h4>
              <p>
                {t(
                  "The highest similarity score selects the default twin. We check the selected twin’s later shot mix and the player’s own mix over the preceding three seasons. A potential swap links the largest fall and rise in shot share, provided attempts also move that way at equal minutes.",
                  "相似度最高的球员是默认参照。系统比较所选 twin 到匹配生涯年为止的出手与此后的出手，也比较球员本季与本人此前最多三季的出手。每次比较都找出占比降幅和升幅最大的两个区域，再核对同等上场时间内出手次数是否也一减一增。",
                )}
              </p>
              <dl>
                {Object.entries(rules).map(([id, rule]) => (
                  <div
                    key={id}
                    className={
                      conclusion.rule === id ? "pr-current-rule" : undefined
                    }
                  >
                    <dt>
                      {rule.title}
                      {conclusion.rule === id && (
                        <small>{t("Applies here", "本次适用")}</small>
                      )}
                    </dt>
                    <dd>{rule.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
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
                          {history
                            ? t(
                                `At the modeled volume, ${history}.`,
                                `按试算幅度，${history}。`,
                              )
                            : t(
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
                  `Each historical period needs all five zone shares and at least ${MIN_HISTORY_FGA} total attempts. For the twin, compare through the matched career year against later seasons recorded by the target season. For the player, compare the current season with the pooled prior three-season window. A trial needs either a positive approximate 95% lower bound on the per-shot scoring difference (using Wilson limits), or an advantage in both the current and separate historical samples. The trial rate is capped by the observed opportunity and available source shots, at one swap every two to ten games. Among routes with equal evidence, prefer the selected twin, then the larger estimated scoring gain at that volume.`,
                  `每段历史都需有五区占比及至少 ${MIN_HISTORY_FGA} 次总出手。对 twin，以匹配生涯年为界，对比此前（含该年）和截至所选球员本季已记录的后续赛季。对本人，考察是否值得回到此前最多三季合计的出手分布。新区域每次出手的得分优势，须在本季与独立历史样本中都出现，或差值的近似 95% 下限大于零（用 Wilson 区间估算）。用观察到的机会量和原区可用出手量限制试行幅度，每两至十场换一次。同等证据下，优先考虑所选 twin 的路线，再比较可行幅度下的估算得分收益。`,
                )}
              </p>
              <p>
                {t(
                  "True shooting = points ÷ [2 × (FGA + 0.44 × FTA)]. League-relative TS is the difference from the season’s league average, in percentage points. Shot difficulty, foul drawing and role changes also affect the observed results.",
                  "真实命中率 = 得分 ÷ [2 ×（总出手 + 0.44 × 罚球次数）]。相对联盟真实命中率是球员与当季联盟平均真实命中率之差，单位为百分点。投篮难度、造犯规能力和角色变化也可能影响前后表现。",
                )}
              </p>
            </details>
          </div>
        </details>
      </div>
    </>
  );
}
