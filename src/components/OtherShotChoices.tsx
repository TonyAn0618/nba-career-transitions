import { percent } from "../lib/analysis";
import { MIN_HISTORY_FGA, MIN_ZONE_FGA } from "../lib/career-peers";
import { zoneShifts, type FollowupPeriod } from "../lib/peer-followup";
import {
  zoneNames,
  type shotSelectionScenarios,
} from "../lib/peer-shot-advice";
import type { Translate } from "../lib/types";

type Model = ReturnType<typeof shotSelectionScenarios>;
type Zone = Model["zones"][number];

function peerShareNote(
  twin: string | null,
  pre: FollowupPeriod | null | undefined,
  post: FollowupPeriod | null | undefined,
  t: Translate,
) {
  if (
    !twin ||
    !pre ||
    !post ||
    [pre, post].some(
      (p) => (p.games ?? 0) * (p.fgaPerGame ?? 0) < MIN_HISTORY_FGA,
    ) ||
    pre.rts == null ||
    post.rts == null ||
    post.rts > pre.rts ||
    pre.points36 == null ||
    post.points36 == null ||
    post.points36 > pre.points36
  )
    return null;
  const shifts = zoneShifts(pre, post);
  if (shifts.length !== pre.shares.length) return null;
  const { zone, change } = shifts[0];
  if (
    change < 0.05 ||
    (pre.zoneAttempts[zone] ?? 0) < MIN_ZONE_FGA ||
    (post.zoneAttempts[zone] ?? 0) < MIN_ZONE_FGA
  )
    return null;
  return {
    zone,
    text: t(
      `Hold off on raising the share on this comparison alone. ${twin} went from ${percent(pre.shares[zone])} to ${percent(post.shares[zone])} here without improving league-relative true shooting or scoring per 36.`,
      `暂缓跟随 ${twin} 提高占比。他在这一区域的出手占比从 ${percent(pre.shares[zone])} 升至 ${percent(post.shares[zone])}，同期相对联盟真实命中率和每 36 分钟得分都未提高。`,
    ),
  };
}

function zoneNote(
  zone: Zone,
  model: Model,
  peerNote: ReturnType<typeof peerShareNote>,
  t: Translate,
) {
  const { attempts, perGame, fg, pastFG } = zone;
  if (attempts == null || (attempts > 0 && fg == null) || perGame == null)
    return t(
      "Fill in the missing season records before setting a shot target.",
      "本季记录不全，先补齐数据再决定出手量。",
    );
  if (attempts < MIN_ZONE_FGA)
    return t(
      `Only about ${Math.round(attempts)} attempts this season. Gather more looks before changing volume.`,
      `本季约 ${Math.round(attempts)} 次出手，样本不足，先观察后续机会。`,
    );
  const value = zone.value?.points.toFixed(2);
  if (zone === model.lowYield)
    return t(
      `Review which attempts had an alternative. At ${value} points per shot, this was the lowest return of the five zones.`,
      `复盘哪些回合有其他出手机会。本季每投得 ${value} 分，在五区中最低。`,
    );
  if (peerNote?.zone === zone.index) return peerNote.text;
  if (zone === model.highYield)
    return t(
      `Take these looks when available. This zone led all five at ${value} points per shot on ${perGame.toFixed(1)} attempts per game.`,
      `有机会时优先把握。本季每投得 ${value} 分，五区最高，场均有 ${perGame.toFixed(1)} 次出手。`,
    );
  if (pastFG == null)
    return t(
      `Track whether ${percent(fg)} shooting holds at ${perGame.toFixed(1)} attempts per game. Earlier seasons have too few comparable shots.`,
      `先看场均 ${perGame.toFixed(1)} 次出手下能否维持 ${percent(fg)} 的命中率，以往可比样本不足。`,
    );
  const now = percent(fg),
    earlier = percent(pastFG);
  if (now === earlier)
    return t(
      `Keep the current role under observation. Accuracy was about ${now} both this season and in the earlier sample, at ${perGame.toFixed(1)} attempts per game this season.`,
      `维持现有用法。本季和此前的命中率均约为 ${now}，本季场均出手 ${perGame.toFixed(1)} 次。`,
    );
  return zone.gap < 0
    ? t(
        `Keep the existing looks. Accuracy rose from ${earlier} to ${now} on ${perGame.toFixed(1)} attempts per game this season.`,
        `保留现有机会。本季场均出手 ${perGame.toFixed(1)} 次，命中率由此前的 ${earlier} 升至 ${now}。`,
      )
    : t(
        `Review shot quality. Accuracy fell from ${earlier} to ${now} on ${perGame.toFixed(1)} attempts per game this season.`,
        `复盘出手质量。本季场均出手 ${perGame.toFixed(1)} 次，命中率由此前的 ${earlier} 降至 ${now}。`,
      );
}

export default function OtherShotChoices({
  model,
  primaryZones,
  twin,
  pre,
  post,
  t,
}: {
  model: Model;
  primaryZones: number[];
  twin: string | null;
  pre?: FollowupPeriod | null;
  post?: FollowupPeriod | null;
  t: Translate;
}) {
  const peerNote = peerShareNote(twin, pre, post, t);
  const names = zoneNames(t);
  return (
    <div className="pr-other-choices">
      <h4>{t("Other shot choices", "其他区域怎么投")}</h4>
      <dl>
        {model.zones
          .filter((zone) => !primaryZones.includes(zone.index))
          .map((zone) => (
            <div key={zone.index}>
              <dt>{names[zone.index]}</dt>
              <dd>{zoneNote(zone, model, peerNote, t)}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
