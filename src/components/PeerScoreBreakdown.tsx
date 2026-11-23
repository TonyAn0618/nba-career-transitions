import { MIN_ZONE_FGA, type CareerPeer } from "../lib/career-peers";
import type { Translate } from "../lib/types";

export default function PeerScoreBreakdown({
  selected,
  t,
}: {
  selected: CareerPeer;
  t: Translate;
}) {
  const { components, alignedYears, history } = selected;
  return (
    <div className="ap-score-breakdown">
      <p>
        {t(
          `Through career year ${history.careerYear} · Each measure counts for one third.`,
          `截至生涯第 ${history.careerYear} 季 · 以下三项各占三分之一`,
        )}
      </p>
      <dl>
        <div>
          <dt>{t("Shot distribution", "出手分布")}</dt>
          <dd>{components.mix.toFixed(1)}</dd>
        </div>
        <div>
          <dt>{t("Accuracy by zone", "分区准度")}</dt>
          <dd>{components.accuracy.toFixed(1)}</dd>
        </div>
        <div>
          <dt>{t("Attempts per 36 min", "每 36 分钟出手量")}</dt>
          <dd>{components.volume.toFixed(1)}</dd>
        </div>
      </dl>
      <p>
        {t(
          "Two players can favor the same spots but differ in accuracy or workload. A close match shoots from similar spots, with similar accuracy, at a similar volume.",
          "即使两人偏爱同样的出手位置，场上角色也可能不同。要成为高分参照，两人还要在相近的出手负担下投出相近的准度。",
        )}
      </p>
      <details className="ap-match-why">
        <summary>
          {t("How the score is calculated", "这三项分数怎么算？")}
        </summary>
        <ul>
          <li>
            <b>{t("Distribution. ", "出手分布　")}</b>
            {t(
              "Take the smaller shot share in each of the five zones and add them. An 80% overlap scores 80 out of 100.",
              "在五个区域分别取两人出手占比的较小值，再相加。合计重合 80%，这一项就得 80 分。",
            )}
          </li>
          <li>
            <b>{t("Accuracy. ", "分区准度　")}</b>
            {t(
              `Start at 100 and subtract the weighted average FG% gap in percentage points. Each zone needs at least ${MIN_ZONE_FGA} estimated attempts with FG% for each player. The smaller attempt count sets its weight, so a rarely used zone has less influence.`,
              `用 100 减去各区命中率差距（百分点）的加权平均值。只计两人都有命中率记录、且各自估算至少出手 ${MIN_ZONE_FGA} 次的区域。权重取两人出手数的较小值，避免少量出手左右结果。`,
            )}
          </li>
          <li>
            <b>{t("Volume. ", "出手量　")}</b>
            {t(
              "Divide the lower attempts per 36 minutes by the higher and multiply by 100. Using equal minutes makes workloads comparable across starters and reserves.",
              "每 36 分钟出手量取较小值除以较大值，再乘 100。换算到相同上场时间，才能比较首发和替补的出手负担。",
            )}
          </li>
        </ul>
        <p>
          {t(
            `Each measure gives half its weight to the pooled record and half to season-by-season comparisons. This distinguishes players with similar averages who took different paths. The two careers overlap for ${alignedYears} ${alignedYears === 1 ? "comparable year" : "comparable years"}. Each year is weighted by the smaller of the two attempt counts with complete zone shares. A measure with no comparable year uses its pooled score alone.`,
            `每项分数一半看截至匹配季的累计表现，一半看相同生涯年份的逐季表现，以区分平均值相近、变化过程却不同的球员。这组有 ${alignedYears} 个可对齐的年份。每年按两人具有完整分区记录的出手数取较小值加权。某项没有可比年份时，只用该项累计分。`,
          )}
        </p>
        <p>
          {t(
            "The full-precision average of the three scores determines the ranking. The peer’s later seasons are reserved for follow-up. Shooting similarity alone cannot estimate the chance of a successful transition.",
            "排名按三项未取整分数的平均值计算。参照球员后续赛季只用于观察转型结果。这个分数衡量投篮打法的相似程度，无法据此估算转型成功率。",
          )}
        </p>
      </details>
    </div>
  );
}
