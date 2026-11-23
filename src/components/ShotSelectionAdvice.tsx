import { useMemo, useState } from "react";
import { percent, seasonLabel, shortName } from "../lib/analysis";
import { MIN_ZONE_FGA } from "../lib/career-peers";
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
  const [choice, setChoice] = useState("");
  const names = zoneNames(t);
  const { swaps, zones, focus, lead, baseline } = model;
  const usable = zones.filter((z) => z.value).length;
  const best = swaps[0];
  const defaultId = best && best.tier !== "scenario" ? best.id : "focus";
  const selected = choice || defaultId;
  const swap = swaps.find((s) => s.id === selected);
  const player = shortName(anchor.name),
    twin = peer ? shortName(peer.name) : null;
  const label = (tier: string) =>
    tier === "trial"
      ? t("Trial", "可试行")
      : tier === "review"
        ? t("Check film", "待复核")
        : t("What-if", "仅测算");
  const mode = swap
    ? label(swap.tier)
    : focus || lead
      ? t("Film review", "复盘重点")
      : t("Data needed", "待补记录");
  let action: string, reason: string;
  if (swap) {
    const a = names[swap.from.index],
      b = names[swap.to.index];
    const pair = a + " → " + b;
    if (swap.tier === "trial")
      action = t(
        `Try ${pair} for ${player}, one attempt every ${swap.every} games.`,
        `建议 ${player} 每 ${swap.every} 场少投一次${a}，用这次进攻创造一次${b}出手。`,
      );
    else if (swap.tier === "review")
      action = t(
        `Review ${player}’s ${a.toLowerCase()} attempts for possessions where ${b.toLowerCase()} was available.`,
        `先复盘 ${player} 的${a}出手，找出当时也能创造${b}机会的回合。`,
      );
    else
      action = t(
        `What if ${player} moved one ${a.toLowerCase()} attempt to ${b.toLowerCase()} every ${swap.every} games?`,
        `假设 ${player} 每 ${swap.every} 场把一次${a}出手换成${b}，效率会怎样？`,
      );
    const support = [];
    if (swap.own && swap.ownSeason)
      support.push(
        t(
          `${player}’s ${seasonLabel(swap.ownSeason)} season`,
          `${player} 自己的 ${seasonLabel(swap.ownSeason)} 赛季`,
        ),
      );
    if (swap.twin && twin)
      support.push(t(`${twin}’s later shot mix`, `${twin} 转型后的出手分布`));
    const precedent = support.length
      ? t(
          `That volume shift appears in ${support.join(" and ")} after adjusting for minutes.`,
          `按相同上场时间换算，${support.join("和")}${support.length > 1 ? "都" : ""}出现过这个幅度的出手组合。`,
        )
      : t(
          "Recent career records provide no comparable shift at a usable volume.",
          "在可用的近期生涯记录中，尚未找到达到试行幅度的同向变化。",
        );
    reason =
      precedent +
      " " +
      (swap.tier === "review"
        ? swap.clear
          ? t(
              "The source offers fewer than one shot to shift every ten games.",
              "可调整的出手不足每十场一次。",
            )
          : t(
              "The zone scoring ranges overlap, so the efficiency advantage still needs checking.",
              "两区得分估计范围重叠，效率优势仍需核实。",
            )
        : t(
            `The two zones yield ${swap.from.value!.points.toFixed(2)} and ${swap.to.value!.points.toFixed(2)} points per attempt.`,
            `每次出手平均得分分别为 ${swap.from.value!.points.toFixed(2)} 和 ${swap.to.value!.points.toFixed(2)} 分。`,
          ));
  } else if (focus) {
    const z = names[focus.index];
    action = t(
      `Review the quality of ${player}’s ${z.toLowerCase()} looks first.`,
      `优先复盘 ${player} 的${z}机会，看受干扰的出手是否挤占了更好的机会。`,
    );
    reason = t(
      `At ${focus.perGame!.toFixed(1)} shots per game, accuracy is ${percent(focus.fg)} against ${percent(focus.pastFG)} over available prior seasons. At today's volume, this zone accounts for the largest scoring gap from personal history.`,
      `本季场均${z}出手 ${focus.perGame!.toFixed(1)} 次，命中率 ${percent(focus.fg)}，此前最多三季合计为 ${percent(focus.pastFG)}。按本季出手量换算，这是与本人过往表现相比得分落差最大的区域。`,
    );
  } else if (lead) {
    action = t(
      `Start with ${player}’s ${names[lead.index].toLowerCase()} looks when reviewing shot quality.`,
      `先看 ${player} 的${names[lead.index]}出手，记录哪些回合还有其他可选机会。`,
    );
    reason = t(
      `This is the highest-volume recorded zone this season (about ${Math.round(lead.attempts!)} shots). ${usable} of five zones have enough observations to compare conversion. There is no supported swap to prioritize.`,
      `这是本季记录中出手最多的区域（约 ${Math.round(lead.attempts!)} 次）。五区有 ${usable} 区样本可用于比较，现有记录还不足以指定可试行的换投路线。`,
    );
  } else {
    action = t(
      `Collect ${player}’s shot locations before choosing which attempts to replace.`,
      `先补齐 ${player} 的出手位置，再判断哪类出手值得调整。`,
    );
    reason = t(
      "The records show no positive zone attempt count this season. The coverage table distinguishes zero attempts from missing data.",
      "本季没有记录到次数大于零的分区出手。下方五区明细列出了零出手与缺失记录。",
    );
  }
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
            "怎样调整出手，提高真实命中率？",
          )}
        </h3>
        {swaps.length > 0 && (
          <label className="pr-zone">
            {t("Compare paths", "比较方案")}
            <select
              value={selected}
              onChange={(e) => setChoice(e.target.value)}
              aria-controls="pr-decision-text pr-ts-scenario"
            >
              <option value="focus">
                {t("Player shooting review", "个人出手复盘")}
              </option>
              {swaps.map((s) => (
                <option key={s.id} value={s.id}>
                  {label(s.tier)} · {names[s.from.index]} → {names[s.to.index]}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <div className="pr-advice">
        <div className="pr-reading" id="pr-decision-text" aria-live="polite">
          <strong className="pr-mode">{mode}</strong>
          <p className="pr-decision">{action}</p>
          <p>{reason}</p>
          {swap?.twin &&
            twin &&
            pre?.rts != null &&
            post?.rts != null &&
            post.rts <= pre.rts && (
              <p>
                {t(
                  `${twin}’s league-relative efficiency did not improve across the two periods. Track actual TS before expanding this trial.`,
                  `${twin} 同期的相对联盟效率并未提高。可先跟踪实际真实命中率，再决定是否扩大调整。`,
                )}
              </p>
            )}
        </div>
        <div className="pr-scenario" id="pr-ts-scenario" aria-live="polite">
          {swap &&
          baseline != null &&
          swap.projected != null &&
          !missingTotals.length ? (
            <>
              <strong>{t("Estimated true shooting", "真实命中率估算")}</strong>
              <div className="pr-counts">
                <span>
                  <small>{t("Actual season", "本季实际")}</small>
                  <b>{percent(baseline, 2)}</b>
                </span>
                <span className="pr-arrow">→</span>
                <span>
                  <small>{t("At modeled volume", "按所选幅度估算")}</small>
                  <b>{percent(swap.projected, 2)}</b>
                </span>
              </div>
              <p>
                {t(
                  `One swap per ${swap.every} games at fixed total attempts, free throws and zone accuracy. The difficulty of extra looks may change the result.`,
                  `每 ${swap.every} 场换投一次，总出手、罚球及两区命中率保持不变。新增机会的难度会影响实际收益。`,
                )}
              </p>
            </>
          ) : (
            <>
              <strong>
                {t("Season evidence", "本季依据")} ·{" "}
                {seasonLabel(anchor.season)}
              </strong>
              <div className="pr-counts">
                <span>
                  <small>{t("True shooting", "真实命中率")}</small>
                  <b>{percent(baseline)}</b>
                </span>
                <span>
                  <small>
                    {t("Zones with usable accuracy", "可比较命中率的区域")}
                  </small>
                  <b>{usable} / 5</b>
                </span>
              </div>
              <p>
                {missingTotals.length
                  ? t(
                      `An overall efficiency projection needs ${missingTotals.join(", ")}.`,
                      `估算整体效率还需要有效的${missingTotals.join("、")}记录。`,
                    )
                  : !peer
                    ? t(
                        "Personal records are available even without an eligible historical twin.",
                        "当前没有符合匹配条件的 twin，个人出手依据仍可查看。",
                      )
                    : !post
                      ? t(
                          `${twin} has no recorded follow-up by this season.`,
                          `截至本季，${twin} 尚无可用的后续记录。`,
                        )
                      : t(
                          "Open the five-zone breakdown to see shot volume and the seasons behind each estimate.",
                          "展开五区明细可查看出手量和命中率的取样范围。",
                        )}
              </p>
            </>
          )}
        </div>
      </div>
      <details className="pr-evidence pr-zone-audit">
        <summary>
          {t(
            "Evidence, all five zones and missing data",
            "查看依据、五区明细与缺失原因",
          )}
        </summary>
        <table>
          <thead>
            <tr>
              {[
                t("Zone", "区域"),
                t("Season FGA", "本季出手（约）"),
                t("FG% used", "取样命中率"),
                t("Evidence", "样本情况"),
              ].map((v) => (
                <th key={v}>{v}</th>
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
                    ? t("Up to three seasons", "最近最多三季")
                    : t("This season", "本季")}{" "}
                  · {Math.round(z.n)} {t("attempts", "次")}
                  {!z.value && t(" · insufficient", " · 样本不足")}
                  {z.attempts != null &&
                    z.attempts > 0 &&
                    z.fg == null &&
                    t(" · season accuracy missing", " · 本季命中率缺记录")}
                  {z.value &&
                    z.perGame == null &&
                    t(" · season volume unknown", " · 本季场均量缺记录")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {t(
            `Prefer this season’s accuracy. For a zone with fewer than ${MIN_ZONE_FGA} usable attempts, pool up to two previous seasons by attempts. A zone needs ${MIN_ZONE_FGA} for a swap estimate. Two-point counts are estimated from distance shares.`,
            `优先用本季命中率。区域不足 ${MIN_ZONE_FGA} 次时按出手数合并此前最多两季。合计仍不足 ${MIN_ZONE_FGA} 次的区域只展示记录。两分区域出手数由距离占比估算。`,
          )}
        </p>
        <p>
          {t(
            "Trial routes require separated 95% Wilson ranges for points per attempt and a comparable shot mix in the player’s prior three seasons or the selected twin’s before/after records. Each comparison needs 200 total attempts per period. Both zone shares and attempts at comparable minutes must move together. Trial volume is capped at the observed shift and one shot every two games, with a minimum of one every ten games. Within each evidence level, prefer a twin-supported path, then the highest estimated scoring gain.",
            "试行要求每次出手得分的近似 95% Wilson 区间分开，并且球员此前三季之一有过类似组合，或所选 twin 前后出现同向变化。历史对照每段至少 200 次总出手，两区占比和按相同上场时间折算的次数都要同向。一条路线最多每两场换投一次，也不能超过观察到的幅度。不足每十场一次只列为复核或测算。同等证据下优先选 twin 有先例的路线，再按可实现幅度下的估算收益排序。",
          )}
        </p>
        {swap && (
          <p>
            {t(
              `The new looks must convert above ${percent(swap.from.value!.points / (swap.to.index === 4 ? 3 : 2))} to gain points at fixed free throws. TS = points ÷ [2 × (FGA + 0.44 × FTA)].`,
              `若罚球不变，新增${names[swap.to.index]}机会的命中率需要高于 ${percent(swap.from.value!.points / (swap.to.index === 4 ? 3 : 2))} 才有得分收益。真实命中率 = 得分 ÷ [2 ×（总出手 + 0.44 × 罚球次数）]。`,
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
                `${twin}: league-relative TS ${pre.rts.toFixed(1)} → ${post.rts.toFixed(1)} pp, points per 36 ${pre.points36.toFixed(1)} → ${post.points36.toFixed(1)}. Its use here is to check available volume.`,
                `${twin} 前后两段的相对联盟真实命中率为 ${pre.rts.toFixed(1)} → ${post.rts.toFixed(1)} 个百分点，每36分钟得分为 ${pre.points36.toFixed(1)} → ${post.points36.toFixed(1)}。这里用他的出手变化核对机会量。`,
              )}
            </p>
          )}
      </details>
    </>
  );
}
