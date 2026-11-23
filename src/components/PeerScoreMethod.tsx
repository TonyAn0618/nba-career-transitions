import { MIN_ZONE_FGA, type CareerPeer } from "../lib/career-peers";
import type { Translate } from "../lib/types";

export default function PeerScoreMethod({
  match,
  t,
}: {
  match: CareerPeer;
  t: Translate;
}) {
  const { mix, accuracy, volume } = match.components;
  const year = match.history.careerYear;
  return (
    <details className="ap-match-why ap-score-method">
      <summary>{t("How is similarity calculated?", "相似度怎么算？")}</summary>
      <div className="ap-score-method-body">
        <strong>
          {t(
            "Similarity = (shot distribution + zone accuracy + shot volume) ÷ 3",
            "相似度 =（出手分布分 + 分区准度分 + 出手量分）÷ 3",
          )}
        </strong>
        <p className="ap-score-example">
          ({mix.toFixed(1)} + {accuracy.toFixed(1)} + {volume.toFixed(1)}) ÷ 3 ≈{" "}
          {match.score.toFixed(1)}
        </p>
        <p>
          {t(
            `We compare both players through career year ${year}. Two players can favor the same spots while shooting at different accuracy or volume. Equal weights give each aspect one third of the score.`,
            `只比较两人截至生涯第 ${year} 季的表现。即使偏爱同样的出手位置，两人也可能投得不一样准，承担不同的出手量。三项等权，让每种差异各占总分的三分之一。`,
          )}
        </p>
        <dl>
          <dt>{t("Shot distribution", "出手分布")}</dt>
          <dd>
            {t(
              "Add the smaller of the two shot shares in each of the five zones, counting 30% as 30 points. An 80% overlap earns 80 points. This measures how often the players choose the same areas.",
              "五个区域各取两人出手占比的较小值，再求和（30% 计 30 分）。分布重合 80% 就得 80 分，衡量两人有多少出手投在相同区域。",
            )}
          </dd>
          <dt>{t("Zone accuracy", "分区准度")}</dt>
          <dd>
            {t(
              `Score = 100 − Σ(weight × absolute FG% gap in percentage points) ÷ Σ(weight). For each zone, the weight is the smaller estimated attempt count with known accuracy. Both players need at least ${MIN_ZONE_FGA} such attempts there so a handful of shots has little influence.`,
              `得分 = 100 − Σ（权重 × 该区命中率之差的绝对值，以百分点计）÷ Σ权重。权重取两人在该区有命中率记录的估算出手数的较小值，双方各至少 ${MIN_ZONE_FGA} 次才计入。这样，一人很少投的区域对结果影响较小。`,
            )}
          </dd>
          <dt>{t("Shot volume", "出手量")}</dt>
          <dd>
            {t(
              "Score = 100 × lower attempts per 36 minutes ÷ higher attempts per 36 minutes. Equal playing time makes workloads comparable across starters and reserves.",
              "得分 = 100 × 两人每 36 分钟出手量的较小值 ÷ 较大值。先统一上场时间，才能比较首发和替补在场时承担的出手量。",
            )}
          </dd>
        </dl>
        <p>
          <b>
            {t(
              "Each component = (pooled score + weighted season-by-season score) ÷ 2.",
              "每项最终得分 =（累计分 + 逐季加权平均分）÷ 2。",
            )}
          </b>{" "}
          {t(
            `Career averages can hide different paths. We also compare year 1 to year 1, year 2 to year 2, and so on. This pair shares ${match.alignedYears} career ${match.alignedYears === 1 ? "year" : "years"} with zone data. Each comparable year is weighted by the smaller attempt count with complete zone shares. A component with no comparable year uses its pooled score.`,
            `累计分看整体打法，逐季分能区分平均值接近、变化过程却不同的球员。从各自首秀算起，第 1 季对第 1 季，依此类推。这组有 ${match.alignedYears} 个生涯年份能对齐比较。对每个可比年份，权重取两人具有完整分区记录的出手数的较小值。某项没有可比年份时，只用该项累计分。`,
          )}
        </p>
        <p>
          {t(
            "The ranking uses unrounded scores. The peer’s later seasons are reserved for follow-up. The score describes shooting resemblance and cannot predict the chance of a successful transition.",
            "排名按未取整的分数计算。参照球员的后续赛季只用于观察转型结果。相似度衡量投篮打法的接近程度，无法据此估算转型成功率。",
          )}
        </p>
      </div>
    </details>
  );
}
