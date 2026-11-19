import { MIN_MATCH_FGA, type matchedFollowup } from "./transition-matches.ts";
import type { SeasonRow, Translate } from "./types.ts";

export function pointsPer36(row: SeasonRow | undefined) {
  if (row?.points == null || row.minutes == null || row.minutes <= 0)
    return null;
  return (row.points * 36) / row.minutes;
}

// Keep full precision through subtraction. Use the displayed change for all direction comparisons.
export function metricChange(start: number | null, value: number | null) {
  return start == null || value == null
    ? null
    : Number((value - start).toFixed(1));
}

function heldChange(
  initial: number | null,
  later: number | null,
  eligible: boolean,
) {
  return eligible && initial != null && later != null
    ? Math.sign(initial) === Math.sign(later)
    : null;
}

function persistence(observations: (boolean | null)[]) {
  if (observations.includes(false)) return "interrupted";
  if (observations.length === 3 && observations.every((held) => held === true))
    return "sustained";
  return observations.includes(true) ? "partial" : "unknown";
}

export function twinPerformance(
  start: SeasonRow,
  end: SeasonRow,
  records: ReturnType<typeof matchedFollowup>,
) {
  const baselineRate = pointsPer36(start);
  const efficiencyChange = metricChange(start.rts, end.rts);
  const scoringChange = metricChange(baselineRate, pointsPer36(end));
  const later = records
    .filter((r) => r.offset > 0)
    .map(({ offset, year, observable, row: raw }) => {
      const row = observable ? raw : undefined;
      const rate = pointsPer36(row);
      const rts = row?.rts ?? null;
      const fga = row?.fga ?? null;
      const eligible = fga != null && fga >= MIN_MATCH_FGA;
      const efficiencyDelta = metricChange(start.rts, rts);
      const scoringDelta = metricChange(baselineRate, rate);
      return {
        offset,
        year,
        observable,
        row,
        rate,
        rts,
        fga,
        efficiencyDelta,
        scoringDelta,
        efficiencyHeld: heldChange(efficiencyChange, efficiencyDelta, eligible),
        scoringHeld: heldChange(scoringChange, scoringDelta, eligible),
      };
    });
  return {
    efficiencyChange,
    scoringChange,
    later,
    efficiencyPersistence: persistence(later.map((r) => r.efficiencyHeld)),
    scoringPersistence: persistence(later.map((r) => r.scoringHeld)),
  };
}

export type TwinPerformance = ReturnType<typeof twinPerformance>;

function followupVerdict(performance: TwinPerformance, t: Translate) {
  const e = performance.efficiencyPersistence;
  const s = performance.scoringPersistence;
  if (e === "sustained" && s === "sustained")
    return t(
      "both patterns held throughout follow-up",
      "这两项变化在随后各季都保持了下来",
    );
  if (e === "interrupted" && s === "interrupted")
    return t(
      "neither pattern lasted throughout follow-up",
      "这两项变化后来都未能持续",
    );
  if (e === "interrupted")
    return s === "sustained"
      ? t(
          "only the scoring pattern lasted throughout follow-up",
          "随后只有得分产量保持了原来的变化方向",
        )
      : t(
          "the efficiency pattern broke in follow-up",
          "后来的相对效率未能一直保持这个方向",
        );
  if (s === "interrupted")
    return e === "sustained"
      ? t(
          "only the efficiency pattern lasted throughout follow-up",
          "随后只有相对效率保持了原来的变化方向",
        )
      : t(
          "the scoring pattern broke in follow-up",
          "后来的得分产量未能一直保持这个方向",
        );
  if (e === "sustained")
    return t(
      "the efficiency pattern held, while persistence of scoring remains uncertain",
      "相对效率的变化延续了，得分产量能否保持仍不清楚",
    );
  if (s === "sustained")
    return t(
      "the scoring pattern held, while persistence of efficiency remains uncertain",
      "得分产量的变化延续了，相对效率能否保持仍不清楚",
    );
  if (performance.later.some((r) => r.efficiencyHeld && r.scoringHeld))
    return t(
      "both patterns held in part of the follow-up period",
      "后来一度延续了这一表现，能否持久仍不清楚",
    );
  return t(
    "whether both patterns lasted remains unclear",
    "这种表现能否延续仍不清楚",
  );
}

export function scoutingReading(
  target: [SeasonRow, SeasonRow],
  twin: [SeasonRow, SeasonRow],
  labels: string[],
  band: number,
  zone: string,
  performance: TwinPerformance,
  t: Translate,
) {
  const [name, peer] = labels;
  const [a, b] = target;
  const [c, d] = twin;
  const primary = Math.sign(b.shares[band]! - a.shares[band]!);
  const historical = Math.sign(d.shares[band]! - c.shares[band]!);
  const { efficiencyChange: e, scoringChange: s } = performance;
  const direction = (delta: number | null) =>
    delta == null
      ? t("is unknown", "的变化尚不清楚")
      : delta > 0
        ? t("rose", "提高")
        : delta < 0
          ? t("fell", "下降")
          : t("held steady", "持平");
  const shift =
    historical > 0
      ? t(`increased his shot share ${zone}`, `增投${zone}`)
      : historical < 0
        ? t(`reduced his shot share ${zone}`, `减少${zone}出手`)
        : t(`kept his share of shots ${zone} steady`, `保持${zone}比重`);
  const result = t(
    `When ${peer} ${shift}, league-relative shooting efficiency ${direction(e)} and scoring per minute ${direction(s)}, and ${followupVerdict(performance, t)}.`,
    `${peer} ${shift}时，相对联盟的真实命中率${direction(e)}，单位时间得分${direction(s)}，${followupVerdict(performance, t)}。`,
  );

  const plan =
    primary > 0
      ? t(`more shots ${zone}`, `增投${zone}`)
      : t(`fewer shots ${zone}`, `减少${zone}出手`);
  const ownEfficiency = metricChange(a.rts, b.rts);
  const ownScoring = metricChange(pointsPer36(a), pointsPer36(b));
  let action: string;
  if (!primary || primary !== historical) {
    action = t(
      `Use ${name}’s own games to decide how many shots to allocate ${zone}, since the pair did not make the same adjustment there.`,
      `两人在${zone}区域没有共同的增减趋势，给 ${name} 分配这类机会时，应优先复盘他自己的比赛。`,
    );
  } else if (e == null || s == null) {
    action = t(
      `Treat ${plan} as a trial for ${name} and establish both his efficiency and scoring rate before making it his regular role.`,
      `先把${plan}作为 ${name} 的试用安排，等效率和得分产量都能核对后，再决定是否固定这个角色。`,
    );
  } else if (
    performance.efficiencyPersistence === "interrupted" &&
    performance.scoringPersistence === "interrupted"
  ) {
    action = t(
      `Before making ${plan} a regular assignment for ${name}, check later seasons against his original efficiency and scoring rate to see whether the initial result changes course.`,
      `建议让 ${name} 暂时沿用${plan}的安排，复核后续赛季的效率和得分产量后，再决定是否固定为长期角色。`,
    );
  } else if (e > 0 && s < 0) {
    action =
      ownEfficiency != null &&
      ownEfficiency > 0 &&
      ownScoring != null &&
      ownScoring > 0
        ? t(
            `${name} improved in both measures, so keep the current shot mix and verify that his scoring volume holds before expanding his role.`,
            `${name} ${plan}时效率和产量同步提高，可以保留当前安排，继续加码前先确认他能守住得分产量。`,
          )
        : t(
            `For ${name}, trial ${plan} and expand the role if efficiency holds while scoring per minute keeps pace with his pre-shift level.`,
            `让 ${name} 试用${plan}的打法时，把守住原有得分产量作为加码条件，避免在效率提高的同时丢掉得分回合。`,
          );
  } else if (e < 0 && s > 0) {
    action = t(
      `Before expanding ${name}’s role with ${plan}, review shot quality and check that added scoring comes with league-relative efficiency at least as good as before.`,
      `给 ${name} 扩大进攻任务前，先复盘${plan}后的投篮选择，确认得分增长时也能守住原有的相对效率。`,
    );
  } else if (e > 0 && s > 0) {
    const sustained =
      performance.efficiencyPersistence === "sustained" &&
      performance.scoringPersistence === "sustained";
    action = sustained
      ? t(
          `Prioritize a trial of ${plan} for ${name}, and keep that role if his efficiency and scoring rate also stay above their pre-shift levels.`,
          `可以优先为 ${name} 试用${plan}的安排，若他自己的相对效率和得分产量也持续高于转型前，再把它固定为常规角色。`,
        )
      : t(
          `Test ${plan} for ${name} in stages and recheck both gains in later seasons before committing to the role.`,
          `建议让 ${name} 分阶段试用${plan}，等他自己的效率和产量提升都能在后续赛季保持，再扩大这一角色。`,
        );
  } else if (e < 0 || s < 0) {
    action = t(
      `Before committing ${name} to ${plan}, review which possessions he would gain or give up and check their effect on his own efficiency and scoring rate.`,
      `先复盘 ${name} 在${plan}后增加和放弃了哪些得分回合，再决定是否保留这种安排，以降低效率或产量下滑的风险。`,
    );
  } else {
    action = t(
      `Trial ${plan} for ${name} on a limited basis and check both efficiency and scoring rate before increasing his workload.`,
      `可以让 ${name} 小范围试用${plan}，把效率与得分产量能否一起改善作为增加任务的依据。`,
    );
  }
  return { result, action };
}
