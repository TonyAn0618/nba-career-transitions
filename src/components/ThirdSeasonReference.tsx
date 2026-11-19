import { percent, pp, seasonLabel, shortName } from "../lib/analysis";
import {
  leagueComparison,
  type thirdSeasonReference,
} from "../lib/comparison-takeaways";
import { MIN_MATCH_FGA } from "../lib/transition-matches";
import type { Translate } from "../lib/types";

export default function ThirdSeasonReference({
  reference,
  zone,
  t,
}: {
  reference: ReturnType<typeof thirdSeasonReference>;
  zone: string;
  t: Translate;
}) {
  const { cases, eligible, retained, direction } = reference;
  if (!direction) return null;
  const relation = direction > 0 ? t("above", "高于") : t("below", "低于");
  const held = cases.find((c) => c.outcome === "retained");
  const lost = cases.find((c) => c.outcome === "not-retained");
  let summary = eligible
    ? t(
        `Of the ${cases.length} ranked matches, ${eligible} qualified for follow-up. In year 3, ${retained} still had a shot share ${zone} ${relation} their starting share.`,
        `${cases.length} 名匹配球员中有 ${eligible} 人符合追踪条件，其中 ${retained} 人在第 3 季的${zone}出手占比仍${relation}转型前。`,
      )
    : t(
        `None of the ${cases.length} ranked matches qualified for the year 3 comparison.`,
        `${cases.length} 名匹配球员中，没有人符合第 3 季的追踪条件。`,
      );
  if (held && lost) {
    const stayed = shortName(held.name);
    const reverted = shortName(lost.name);
    const efficiency = (rts: number | null) =>
      rts == null
        ? ""
        : t(
            `, with true shooting ${leagueComparison(rts, t)}`,
            `，真实命中率${leagueComparison(rts, t)}`,
          );
    const reversedRelation =
      lost.start === lost.share
        ? t("level with", "持平于")
        : direction > 0
          ? t("below", "低于")
          : t("above", "高于");
    summary = t(
      `Year 3 is comparable for ${eligible} of ${cases.length} matches. ${stayed} was ${relation} his starting share ${zone} (${percent(held.share)})${efficiency(held.rts)}. ${reverted} was ${reversedRelation} his starting share (${percent(lost.share)})${efficiency(lost.rts)}.`,
      `${cases.length} 人中有 ${eligible} 人的第三季可比。${stayed} 的${zone}占比仍${relation}起点（${percent(held.share)}）${efficiency(held.rts)}。${reverted} 的占比${reversedRelation}起点（${percent(lost.share)}）${efficiency(lost.rts)}。`,
    );
  }
  const outcomes = {
    direction: t("Different initial direction", "起止变化方向不同"),
    outside: t("Outside coverage", "超出观察期"),
    absent: t("No season record", "无赛季记录"),
    missing: t("Share or attempts unavailable", "缺少占比或出手数"),
    sample: t(
      `Under ${MIN_MATCH_FGA} attempts`,
      `出手不足 ${MIN_MATCH_FGA} 次`,
    ),
    retained:
      direction > 0
        ? t("Still above start", "仍高于起点")
        : t("Still below start", "仍低于起点"),
    "not-retained":
      direction > 0
        ? t("Below start", "低于起点")
        : t("Above start", "高于起点"),
  };
  return (
    <div className="tm-reference">
      <h3>
        <strong>
          {t("Year 3 shot shares across matches", "匹配候选的第三季出手占比")}
        </strong>
      </h3>
      <p>{summary}</p>
      <p>
        {t(
          `This shot-share comparison counts same-direction shifts with a recorded zone share and at least ${MIN_MATCH_FGA} total attempts in year 3, using only records available by the selected end season. Compare each case with its own starting share.`,
          `这张出手占比对照表只计入与所选球员同向变化、第三季有该区占比且总出手至少 ${MIN_MATCH_FGA} 次的案例。数据截至所选区间结束季，逐人比较第三季和各自转型前的占比。`,
        )}
      </p>
      <div className="tm-reference-table">
        <table>
          <thead>
            <tr>
              {[
                t("Player", "球员"),
                t("Start → end", "起止占比"),
                t("Year 3", "第三季"),
                t("Share", "占比"),
                t("Attempts", "总出手"),
                t("TS vs. league (pp)", "真实命中率相对联盟（pp）"),
                t("Outcome", "判断"),
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.playerId}>
                <th scope="row">{c.name}</th>
                <td>
                  {percent(c.start)} → {percent(c.end)}
                </td>
                <td>{seasonLabel(c.year)}</td>
                <td>{percent(c.share)}</td>
                <td>{c.fga ?? "—"}</td>
                <td>{pp(c.rts)}</td>
                <td>
                  {c.outcome === "not-retained" && c.start === c.share
                    ? t("Back at start", "回到起点")
                    : outcomes[c.outcome]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
