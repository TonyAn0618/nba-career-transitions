import { ShiftMarkers, type ShiftActions } from "./CareerShifts";
import { useState } from "react";
import CareerWindow from "./CareerWindow";
import {
  percent,
  pp,
  PLAYER_COLORS,
  seasonLabel,
  shortName,
} from "../lib/analysis";
import type { pairedCareer } from "../lib/paired-career";
import { completeProfile, zoneChanges } from "../lib/transitions";
import type { SeasonRow, Translate } from "../lib/types";
import { BAND_COLORS, bandNames } from "./TransitionCharts";

type Props = ShiftActions & {
  timeline: ReturnType<typeof pairedCareer>;
  players: SeasonRow[];
  focusIndex: number;
  startOffset: number;
  zone: number | null;
  onZone: (zone: number | null) => void;
  onOffset: (offset: number) => void;
  onPick: (row: SeasonRow) => void;
  t: Translate;
};

export default function CareerMixBars({
  shifts,
  onShift,
  timeline,
  players,
  focusIndex,
  startOffset,
  zone,
  onZone,
  onOffset,
  onPick,
  t,
}: Props) {
  const names = bandNames(t);
  const focus = timeline[focusIndex];
  const firstColumn = timeline.findIndex((col) => col.offset === startOffset);
  const starts = timeline[firstColumn].rows;
  const [range, setRange] = useState("auto");
  const shares =
    zone === null
      ? []
      : timeline.flatMap((col) =>
          col.rows.flatMap((row) =>
            row && completeProfile(row) ? [row.shares[zone]!] : [],
          ),
        );
  const maximum = Math.max(0, ...shares);
  const automatic =
    [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1].find((v) => v >= maximum) ?? 1;
  const ceiling =
    zone === null ? 1 : range === "auto" ? automatic : Number(range);
  return (
    <section className="ct-panel pc-mix">
      <div className="ct-panel-head">
        <h2>{t("Career shot mix by age", "生涯出手分布 · 按年龄对齐")}</h2>
        <span>
          {t(
            "Select a season to update both pies",
            "点选赛季柱，同步切换两张饼图",
          )}
        </span>
      </div>
      <div className="pc-mix-tools">
        <div
          className="pc-bands"
          role="group"
          aria-label={t("Inspect a shooting distance", "选择要细看的出手距离")}
        >
          <button aria-pressed={zone === null} onClick={() => onZone(null)}>
            {t("All zones", "全部分区")}
          </button>
          {names.map((name, i) => (
            <button
              key={name}
              aria-pressed={zone === i}
              onClick={() => onZone(zone === i ? null : i)}
            >
              <i style={{ background: BAND_COLORS[i] }} />
              {name}
            </button>
          ))}
        </div>
        {zone === null ? (
          <span className="pc-zoom-hint">
            {t(
              "Select a distance to magnify small shares.",
              "点选距离，可放大小占比。",
            )}
          </span>
        ) : (
          <label className="pc-scale">
            {t("Shared scale", "两人共用纵轴")}{" "}
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="auto">
                {t("Auto", "自动")} · 0–{percent(automatic, 0)}
              </option>
              <option value="0.1">0–10%</option>
              <option value="0.01">0–1%</option>
            </select>
          </label>
        )}
      </div>
      <CareerWindow
        windowKey={starts.map((r, i) => r!.id + "/" + players[i].id).join("|")}
        focus={focus.offset}
        t={t}
      >
        <div
          className="pc-stacks"
          style={{
            gridTemplateColumns: `minmax(80px,max-content) repeat(${timeline.length},minmax(62px,1fr))`,
          }}
        >
          <ShiftMarkers
            shifts={shifts}
            onShift={onShift}
            firstYear={players[0].season + timeline[0].offset}
            firstColumn={2}
            t={t}
          />
          <div className="pc-window-row">
            <span
              className="pc-window-bracket"
              style={{
                gridColumn: `${firstColumn + 2} / span ${1 - startOffset}`,
              }}
            >
              {t("Comparison window", "本次观察区间")}
            </span>
          </div>
          <span className="pc-axis-title" data-window-gutter>
            {t("Age", "年龄")}
          </span>
          {timeline.map((col) => (
            <span
              key={col.offset}
              data-window-focus={col.offset === focus.offset || undefined}
              className={
                "pc-tick " + (col.offset === focus.offset ? "pc-now" : "")
              }
            >
              {players[0].age! + col.offset}
            </span>
          ))}
          {players.map((player, side) => (
            <div className="pc-track" key={player.id}>
              <div className="pc-label" style={{ color: PLAYER_COLORS[side] }}>
                <b>{shortName(player.name)}</b>
                <small>
                  {zone === null ? t("All attempts", "全部出手") : names[zone]}
                </small>
                <span className="pc-axis-limits">
                  <span>{percent(ceiling, 0)}</span>
                  <span>0%</span>
                </span>
              </div>
              {timeline.map((col) => {
                const season = col.years[side];
                if (season == null)
                  return <div key={col.offset} aria-hidden="true" />;
                const row = col.rows[side];
                const valid = row && completeProfile(row);
                const share = valid && zone !== null ? row.shares[zone]! : null;
                const year = seasonLabel(season);
                const inWindow = col.offset >= startOffset && col.offset <= 0;
                const description = valid
                  ? zone === null
                    ? names
                        .map((name, i) => name + " " + percent(row.shares[i]))
                        .join(" · ")
                    : names[zone] + " " + percent(share)
                  : t("No complete split", "无完整分区记录");
                const overflow = share != null && share > ceiling;
                return (
                  <div
                    className={
                      "pc-season-bar" + (inWindow ? " pc-in-window" : "")
                    }
                    key={col.offset}
                  >
                    <button
                      className={
                        "pc-stack" +
                        (col.offset === focus.offset ? " pc-picked" : "") +
                        (!valid ? " pc-no-data" : "") +
                        (zone !== null ? " pc-only-zone" : "")
                      }
                      aria-pressed={col.offset === focus.offset}
                      onClick={() => onOffset(col.offset)}
                      aria-label={
                        player.name +
                        " · " +
                        year +
                        " · " +
                        (inWindow
                          ? t("Comparison window · ", "观察区间 · ")
                          : "") +
                        description
                      }
                      title={player.name + " · " + year + "\n" + description}
                    >
                      {valid &&
                        (zone === null ? (
                          row.shares.map((v, k) => (
                            <i
                              key={k}
                              style={{
                                flexGrow: v!,
                                background: BAND_COLORS[k],
                              }}
                            >
                              {v! >= 0.11 && (
                                <span className={k < 2 ? "pc-light" : ""}>
                                  {percent(v)}
                                </span>
                              )}
                            </i>
                          ))
                        ) : (
                          <>
                            <i
                              className="pc-zone-fill"
                              style={{
                                height: percent(
                                  Math.min(share! / ceiling, 1),
                                  4,
                                ),
                                background: BAND_COLORS[zone],
                              }}
                            />
                            <b
                              className="pc-exact-share"
                              style={{
                                bottom: `clamp(3px, calc(${Math.min(share! / ceiling, 1) * 100}% + 3px), calc(100% - 22px))`,
                              }}
                            >
                              {overflow ? "↑ " : ""}
                              {percent(share)}
                            </b>
                          </>
                        ))}
                    </button>
                    <small>{year}</small>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CareerWindow>
      <div className="pc-window-changes">
        <b>
          {t("Largest shift between selected seasons", "所选两季间变化最大")}
        </b>
        {players.map((end, side) => {
          const start = starts[side]!;
          const changes = zoneChanges(start, end);
          const largest = changes.reduce<number>(
            (best, v, i) =>
              Math.abs(v ?? 0) > Math.abs(changes[best] ?? 0) ? i : best,
            0,
          );
          return (
            <span key={end.id}>
              <strong style={{ color: PLAYER_COLORS[side] }}>
                {shortName(end.name)}
              </strong>
              {seasonLabel(start.season)} → {seasonLabel(end.season)}
              <b>
                {names[largest]} {pp(changes[largest])}
              </b>
            </span>
          );
        })}
      </div>
      <div className="ct-panel-note pc-mix-note">
        <span>
          {zone === null
            ? t(
                "Each column totals 100%. Hatching marks missing data.",
                "每根完整柱合计 100%。斜纹表示数据缺失。",
              )
            : t(
                "Labels show actual shares. ↑ exceeds the selected scale. Hatching marks missing data.",
                "数字为实际出手占比。↑ 表示高于纵轴上限，斜纹表示数据缺失。",
              )}
        </span>
        {focus.rows[0] && (
          <button onClick={() => onPick(focus.rows[0]!)}>
            {t("Compare adjacent seasons", "比较相邻两季")}
          </button>
        )}
      </div>
    </section>
  );
}
