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
      <summary>
        {t(
          "How is similarity calculated, and why?",
          "相似度怎么算？为什么这样算？",
        )}
      </summary>
      <div className="ap-score-method-body">
        <strong>{t("Why use this score?", "为什么选择这种算法？")}</strong>
        <p>
          {t(
            `To learn from a historical player's transition, we first look for someone with comparable shot choices, accuracy and workload through career year ${year}. Suppose two players shoot equally well from the same spots but take 10 and 20 shots per 36 minutes. At those volumes, raising their three-point share by 10 percentage points means finding one extra three for the first player and two for the second.`,
            `要借鉴一名球员后来的转型，先要看两人截至生涯第 ${year} 季是否面对相近的出手选择。举例说，两人出手分布和分区准度完全一样，但每 36 分钟分别出手 10 次和 20 次。若总出手不变，同样把三分占比提高 10 个百分点，前者只需多找到 1 次三分机会，后者需要 2 次。`,
          )}
        </p>
        <p>
          {t(
            "The NBA’s shot-chart guide compares shooting by location. Miller and colleagues also found that NBA shot locations distinguish offensive player types. That gives us a reason to compare where two players shoot, then check how well each shoots from those same spots.",
            "NBA 官方投篮图按区域比较准度。Miller 等人对 NBA 出手位置的研究也发现，投篮分布能区分球员的进攻类型。因此，找转型参照时，我们先看两人爱从哪里投，再看他们在相同位置是否投得一样准。",
          )}{" "}
          <a
            href="https://jr.nba.com/how-to-read-a-shot-chart/"
            target="_blank"
            rel="noreferrer"
          >
            {t("NBA shot-chart guide", "NBA 投篮图指南")}
          </a>
          {" · "}
          <a
            href="https://proceedings.mlr.press/v32/miller14.html"
            target="_blank"
            rel="noreferrer"
          >
            {t("Miller et al. (2014)", "Miller 等（2014）")}
          </a>
        </p>
        <p>
          {t(
            `The full score is our project’s design. We give shot choice, accuracy and workload one third each, and give career totals and season-by-season comparisons half each to represent both style and its evolution. The ${MIN_ZONE_FGA}-attempt cutoff is also our choice. These weights were not fitted to later outcomes.`,
            `完整评分由本项目设计。我们给出手选择、准度和出手负担各三分之一，让三个问题同等参与判断。累计和逐季表现各占一半，让整体风格和变化过程都能影响排名。分区至少 ${MIN_ZONE_FGA} 次出手也是项目设定。这些权重没有用球员后来的表现拟合。`,
          )}
        </p>
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
        <dl>
          <dt>{t("Shot distribution", "出手分布")}</dt>
          <dd>
            {t(
              "Add the smaller share in each of the five zones, counting 30% as 30 points. Moving 10 of every 100 attempts from long twos to threes leaves 90 in common and scores 90. Measuring overlap counts each relocated shot once.",
              "五区各取两人出手占比的较小值，再求和（30% 计 30 分）。假如每 100 次出手中只把 10 次长两分改投三分，仍有 90 次重合，得 90 分。用重合度，每次换投只算一次。",
            )}{" "}
            {t(
              "This is the histogram intersection formula applied to shot shares.",
              "这一分项把「直方图交集」公式用在了出手占比上。",
            )}{" "}
            <a
              href="https://docs.opencv.org/4.13.0/d8/dc8/tutorial_histogram_comparison.html"
              target="_blank"
              rel="noreferrer"
            >
              {t("OpenCV formula", "OpenCV 公式原文")}
            </a>
          </dd>
          <dt>{t("Zone accuracy", "分区准度")}</dt>
          <dd>
            {t(
              `Score = 100 − Σ(weight × absolute FG% gap in percentage points) ÷ Σ(weight). Absolute gaps keep opposite differences across zones from cancelling out. The smaller estimated attempt count with known FG% sets each zone’s weight. Both players need at least ${MIN_ZONE_FGA} such attempts there, so a handful of shots carries little influence.`,
              `得分 = 100 − Σ（权重 × 命中率差的绝对值，以百分点计）÷ Σ权重。取绝对值，是为了让篮下的准度差和三分的准度差不会正负抵消。权重取两人在该区有命中率记录的估算出手数的较小值，双方各至少 ${MIN_ZONE_FGA} 次才计入，让少量出手对分数的影响更小。`,
            )}
          </dd>
          <dt>{t("Shot volume", "出手量")}</dt>
          <dd>
            {t(
              "Score = 100 × lower attempts per 36 minutes ÷ higher attempts per 36 minutes. Standardizing minutes separates workload from playing time. The ratio captures the relative gap, so the 10 vs. 20 example scores 50 whichever player is selected first.",
              "得分 = 100 × 每 36 分钟出手量的较小值 ÷ 较大值。统一上场时间可以比较在场时的出手负担。用比值衡量相对差距，上例中的 10 次和 20 次无论谁作参照，都得 50 分。",
            )}{" "}
            {t(
              "NBA Stats publishes attempts per 36 minutes.",
              "NBA Stats 也按每 36 分钟列出球员的投篮出手数。",
            )}{" "}
            <a
              href="https://www.nba.com/stats/players/traditional?PerMode=Per36&SeasonType=Regular+Season&dir=A"
              target="_blank"
              rel="noreferrer"
            >
              {t("NBA per-36 table", "NBA 每 36 分钟统计")}
            </a>
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
            `With equal attempts each season, a three-point share rising from 20% to 40% and one falling from 40% to 20% both pool to 30%. We give half the weight to the pooled record for a steadier estimate, and half to matched career years so those opposite paths show up. This pair shares ${match.alignedYears} career ${match.alignedYears === 1 ? "year" : "years"} with zone data. Each comparable year is weighted by the smaller attempt count with complete zone shares. If a component has no comparable year, its pooled score is used alone.`,
            `假设每季出手数相同，一人的三分占比从 20% 升到 40%，另一人从 40% 降到 20%，两季合计都是 30%。累计样本让整体估计更稳，按生涯年份对齐能看见相反的变化方向。各取一半，让整体打法和变化过程在分项里有同等分量。这组有 ${match.alignedYears} 个生涯年份能对齐比较。每年按双方分区记录完整的出手数取较小值加权。某项没有可比年份时，只用累计分。`,
          )}
        </p>
        <p>
          {t(
            "The ranking uses unrounded scores. We select the peer before looking at later seasons so a successful transition cannot make a player look like a better initial match.",
            "排名使用未取整的分数。先匹配，再看后续赛季，这样就不会因为某人转型成功，反过来把他选作当初的参照。分数描述打法的接近程度。",
          )}
        </p>
      </div>
    </details>
  );
}
