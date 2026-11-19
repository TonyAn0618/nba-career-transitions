import { ArrowRight, Check } from "lucide-react";
import { percent, seasonLabel, shortName } from "../lib/analysis";
import {
  SHIFT_RULE,
  type CareerShift,
  type detectCareerShifts,
} from "../lib/career-shifts";
import { MIN_MATCH_FGA } from "../lib/transition-matches";
import type { SeasonRow, Translate } from "../lib/types";

export type ShiftActions = {
  shifts: CareerShift[];
  onShift: (shift: CareerShift) => void;
};

export function ShiftMarkers({
  shifts,
  onShift,
  firstYear,
  firstColumn,
  t,
}: ShiftActions & {
  firstYear: number;
  firstColumn: number;
  t: Translate;
}) {
  if (!shifts.length) return null;
  return (
    <div className="pc-shift-markers">
      {shifts.map((shift, index) => {
        const label = t(`Detected shift ${index + 1}`, `系统识别 ${index + 1}`);
        const years =
          seasonLabel(shift.first.season) +
          " → " +
          seasonLabel(shift.last.season);
        return (
          <button
            key={shift.first.id}
            style={{
              gridColumn: `${firstColumn + shift.first.season - firstYear} / span ${shift.last.season - shift.first.season + 1}`,
            }}
            onClick={() => onShift(shift)}
            aria-label={
              label + " · " + years + t(" · Find twin", " · 查看匹配")
            }
            title={years + t(" · Find twin", " · 查看匹配")}
          >
            {label} <ArrowRight size={12} />
          </button>
        );
      })}
    </div>
  );
}

export default function CareerShifts({
  result,
  a,
  b,
  twin,
  names,
  onShift,
  t,
}: {
  result: ReturnType<typeof detectCareerShifts>;
  a: SeasonRow;
  b: SeasonRow;
  twin?: string;
  names: string[];
  onShift: ShiftActions["onShift"];
  t: Translate;
}) {
  const { maxSeasons, extraSeasonCost, minScore, limit } = SHIFT_RULE;
  return (
    <section className="ct-panel shift-panel">
      <div className="shift-intro">
        <h2>
          {t(
            `Largest shot-mix shifts for ${shortName(a.name)}`,
            `${shortName(a.name)} 的生涯出手变化`,
          )}
        </h2>
        <span>
          {t(
            `${result.examined} eligible intervals compared`,
            `已比较 ${result.examined} 个合格区间`,
          )}
        </span>
      </div>
      {result.shifts.length ? (
        <div className="shift-options">
          {result.shifts.map((shift, i) => {
            const active =
              a.season === shift.first.season && b.season === shift.last.season;
            const years =
              seasonLabel(shift.first.season) +
              " → " +
              seasonLabel(shift.last.season);
            return (
              <button
                key={shift.first.id}
                aria-pressed={active}
                onClick={() => onShift(shift)}
              >
                <span className="shift-title">
                  <b>{i + 1}</b>
                  <strong>{years}</strong>
                </span>
                <span>
                  {names[shift.driver]}{" "}
                  <strong>
                    {percent(shift.first.shares[shift.driver])} →{" "}
                    {percent(shift.last.shares[shift.driver])}
                  </strong>
                </span>
                <span>
                  {t("Five-zone shift", "五区变化幅度")}{" "}
                  {shift.distance.toFixed(1)} pp · {t("Rank score", "排序分")}{" "}
                  {shift.score.toFixed(1)}
                </span>
                <span className="shift-action">
                  {active ? <Check size={13} /> : <ArrowRight size={13} />}
                  {active
                    ? twin
                      ? t("Matching player", "当前匹配") + " · " + twin
                      : t("No eligible twin", "暂无合格匹配")
                    : t("See historical twin", "查看历史匹配")}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="shift-empty">
          {result.examined
            ? t(
                "No interval reached the detection threshold.",
                "合格区间的变化均未达到标记门槛。",
              )
            : t(
                "No consecutive seasons meet the sample and data requirements.",
                "没有连续两个赛季同时满足样本量和数据要求。",
              )}
        </p>
      )}
      <details className="shift-method">
        <summary>{t("Why these seasons?", "为什么选这些年份？")}</summary>
        <p>
          {t(
            `We scan every stretch of 2–${maxSeasons} consecutive seasons in this player’s recorded career. Every season must have a complete five-zone split, an age, positive playing time and at least ${MIN_MATCH_FGA} attempts. Missing or ineligible seasons break a stretch.`,
            `系统扫描这名球员有记录的整段生涯，比较所有连续 2–${maxSeasons} 季的区间。每季需有完整五区占比、年龄、有效上场时间和至少 ${MIN_MATCH_FGA} 次出手。缺季或样本不足会中断区间。`,
          )}
        </p>
        <p>
          {t(
            "To measure how much the mix changed, normalize each season’s five shares to 100%, sum the absolute endpoint differences in percentage points, then divide by two. Moving 10 points from the rim to threes counts as a 10-point shift. Each card shows the zone with the largest absolute change.",
            "把每季五区占比归一到 100%，将首尾两季各区占比差的绝对值相加，再除以二。从篮下转移 10 个百分点到三分，整体变化就记 10 个百分点。卡片列出变幅最大的分区及其首尾占比。",
          )}
        </p>
        <p>
          {t(
            `Ranking starts with the five-zone shift and subtracts ${extraSeasonCost} points per season beyond two, favoring changes concentrated in fewer years. Keep scores of at least ${minScore}, taking up to ${limit} intervals in rank order with no shared seasons. Ties favor shorter, then earlier intervals. These thresholds are display choices. Twin matching runs separately on the selected endpoints.`,
            `先计算五区变化幅度。区间超过两季时，每多一季扣 ${extraSeasonCost} 分，让集中发生的变化排在前面。保留得分达到 ${minScore} 的区间，按得分从高到低取最多 ${limit} 段，已入选的年份不再重复。平分时优先较短、较早的区间。这些门槛是本项目的筛选规则。点击后再用所选两季计算历史匹配。`,
          )}
        </p>
      </details>
    </section>
  );
}
