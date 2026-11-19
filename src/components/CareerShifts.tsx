import { ArrowRight, Check } from "lucide-react";
import { percent, seasonLabel, shortName } from "../lib/analysis";
import type { CareerShift, detectCareerShifts } from "../lib/career-shifts";
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
  return (
    <section className="ct-panel shift-panel">
      <div className="shift-intro">
        <h2>
          {t(
            `Largest shot-mix shifts for ${shortName(a.name)}`,
            `${shortName(a.name)} 的生涯出手变化`,
          )}
        </h2>
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
    </section>
  );
}
