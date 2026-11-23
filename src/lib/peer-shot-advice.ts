import { shortName } from "./analysis.ts";
import { MIN_ZONE_FGA } from "./career-peers.ts";
import type { FollowupPeriod } from "./peer-followup.ts";
import type { Translate } from "./types.ts";

export function peerShotAdvice(
  target: FollowupPeriod | null,
  pre: FollowupPeriod,
  post: FollowupPeriod,
  last: FollowupPeriod | null,
  zone: number,
  zoneName: string,
  targetName: string,
  peerName: string,
  t: Translate,
) {
  const observed = target?.zonePerGame[zone] ?? null;
  const total = target?.fgaPerGame;
  const share = post.shares[zone];
  const scenario = total != null && share != null ? total * share : null;
  const player = shortName(targetName);
  const peer = shortName(peerName);
  const area = zoneName.toLowerCase();
  const location = [
    "at the rim",
    "on short twos",
    "from mid-range",
    "on long twos",
    "from three",
  ][zone];
  const hold = t(
    `Keep ${player}’s current shot volume ${location}.`,
    `建议 ${player} 维持目前的${area}出手量。`,
  );
  let action = hold;
  let reason: string;
  const delta =
    scenario != null && observed != null ? scenario - observed : null;
  if (delta == null) {
    reason = t(
      "Check the player’s attempts per game and the reference player’s zone share before setting a volume target.",
      "先补齐该区的场均出手和参照球员的后期占比，再设定调整目标。",
    );
  } else if (Math.abs(delta) < 0.5) {
    reason = t(
      `At ${player}’s volume, the gap from ${peer}’s later mix is less than one attempt every two games.`,
      `按 ${player} 的总出手量换算，与 ${peer} 后期比例的差距每两场还不到一投。`,
    );
  } else {
    const more = delta > 0;
    const amount = Number(Math.abs(delta).toFixed(1));
    const change = t(
      `about ${amount} ${more ? "more" : "fewer"} attempts per game`,
      `每场${more ? "多投" : "少投"}约 ${amount} 次`,
    );
    action = t(
      `Keep ${player}’s current volume ${location} for now. Hold off on ${change}.`,
      `建议 ${player} 维持目前的${area}出手量，暂缓${change}。`,
    );
    const beforeCount = pre.zonePerGame[zone],
      afterCount = post.zonePerGame[zone];
    const beforeShare = pre.shares[zone];
    if (
      post.seasons < 2 ||
      [target, pre, post].some(
        (p) => (p?.zoneAttempts[zone] ?? 0) < MIN_ZONE_FGA,
      )
    ) {
      reason = t(
        `Cross-check another historical peer. A trial needs at least two later seasons and ${MIN_ZONE_FGA} attempts from this zone in each comparison period.`,
        `可换一位历史参照再核对。试行建议至少需要两季后续记录，且目标赛季和参照球员前后两段在该区都至少有 ${MIN_ZONE_FGA} 次出手。`,
      );
    } else if (
      pre.rts == null ||
      post.rts == null ||
      pre.points36 == null ||
      post.points36 == null ||
      target?.rts == null ||
      target.points36 == null ||
      beforeCount == null ||
      afterCount == null ||
      beforeShare == null ||
      share == null
    ) {
      reason = t(
        "Choose a comparison with recorded zone volume, league-relative TS and points per 36 to check whether it preserved scoring.",
        "换一组该区出手量、相对联盟真实命中率和每36分钟得分都完整的比较，再评估是否值得调整。",
      );
    } else {
      const efficiency = Number((post.rts - pre.rts).toFixed(1));
      const scoring = Number((post.points36 - pre.points36).toFixed(1));
      const shareDirection = Math.sign(
        Number(((share - beforeShare) * 100).toFixed(1)),
      );
      const countDirection = Math.sign(
        Number((afterCount - beforeCount).toFixed(2)),
      );
      const direction = Math.sign(delta);
      if (shareDirection === direction && countDirection === -direction) {
        const outcome =
          efficiency <= 0 && scoring < 0
            ? t(
                ", while scoring per 36 fell and league-relative TS did not improve",
                "，同期每36分钟得分下降，相对联盟效率也未提高",
              )
            : "";
        reason = t(
          `${peer}’s share of shots from this zone ${more ? "rose" : "fell"} even as the actual attempts per game ${more ? "fell" : "rose"}${outcome}.`,
          `${peer} 后期的${area}占比${more ? "上升" : "下降"}，场均${area}出手却${more ? "减少" : "增加"}${outcome}。`,
        );
      } else if (shareDirection !== direction || countDirection !== direction) {
        reason = t(
          `${peer}’s share and attempts per game did not both move in the proposed direction. Look for a peer who actually made that change.`,
          `${peer} 的${area}占比和场均${area}出手没有同时朝这个方向变化，宜再找一位实际这样调过的球员作参照。`,
        );
      } else if (efficiency > 0 && scoring >= 0) {
        if (
          last?.rts != null &&
          last.points36 != null &&
          last.rts >= pre.rts &&
          last.points36 >= pre.points36
        ) {
          action = t(
            `Try a small shift toward ${more ? "more" : "fewer"} attempts ${location} for ${player}, keeping total attempts steady.`,
            `建议 ${player} 在总出手量相近时，先用少数回合试行${more ? "增加" : "减少"}${area}出手。`,
          );
          reason = t(
            `${peer} made the same adjustment, improved league-relative TS and maintained points per 36 across the later period. Both were still at or above baseline in the last recorded season.`,
            `${peer} 同向调整后，后期整体相对效率提高、每36分钟得分守住前期水平，末季两项也都守住了基线。`,
          );
        } else {
          reason = t(
            `${peer} improved pooled relative TS and maintained scoring, but the final season does not confirm both held. Check another peer before extending a trial.`,
            `${peer} 后期整体效率提高、每36分钟得分得以维持，末季记录却不足以确认两项都守住了前期水平，可再核对另一位参照。`,
          );
        }
      } else if (efficiency > 0) {
        reason = t(
          `${peer} improved league-relative TS as points per 36 fell. Consider that trade-off only if a smaller scoring role is acceptable.`,
          `${peer} 后期相对联盟效率提高，每36分钟得分却下降，只有在球队能接受得分产量减少时才值得试行。`,
        );
      } else {
        reason = t(
          `${peer} made that adjustment, but league-relative TS did not improve and points per 36 ${scoring < 0 ? "fell" : "held up"}.`,
          `${peer} 虽做了同向调整，相对联盟效率并未提高，每36分钟得分${scoring < 0 ? "也下降了" : "维持在前期水平或更高"}。`,
        );
      }
    }
  }
  return { action, reason, observed, scenario };
}
