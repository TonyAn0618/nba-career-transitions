import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildCohort,
  cohortFlows,
  styles,
  type Flow,
  type PositionGroup,
} from "../lib/age-context";
import type { Dataset, Translate } from "../lib/types";
import "./age-context.css";

type Props = {
  data: Dataset;
  t: Translate;
};
type FlowResult = ReturnType<typeof cohortFlows>;
const shownStyles = styles.filter((style) => style !== "mixed");
type ShownStyle = (typeof shownStyles)[number];
type ShownFlow = Flow & { from: ShownStyle; to: ShownStyle };

function stateNames(t: Translate): Record<ShownStyle, string> {
  return {
    rim: t("Rim-heavy", "篮下型"),
    inside: t("Inside", "近筐型"),
    mid: t("Midrange", "中距离型"),
    three: t("Three-point", "三分型"),
  };
}
const stageNames = (t: Translate) => [
  t("Ages 20–23", "20–23 岁"),
  t("Ages 25–28", "25–28 岁"),
  t("Ages 31+", "31 岁及以上"),
];

function FlowChart({ result, t }: { result: FlowResult; t: Translate }) {
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [focus, setFocus] = useState<{
    stage: number;
    state: ShownStyle;
  } | null>(null);
  useEffect(() => {
    if (!holder.current) return;
    const element = holder.current;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(1, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const names = stateNames(t),
    stages = stageNames(t);
  const labelWidth = width < 480 ? 78 : 112;
  const x = [1, (width - labelWidth) / 2, width - labelWidth - 1];
  const totalInk = 166;
  // Align each style across ages. Every node and ribbon uses the same people-to-height scale.
  let height = 27;
  const centers = new Map<ShownStyle, number>();
  for (const style of shownStyles) {
    const maximum = Math.max(
      ...result.counts.map((counts) => counts.get(style) ?? 0),
    );
    const rowHeight = Math.max(32, (maximum / result.total) * totalInk);
    centers.set(style, height + rowHeight / 2);
    height += rowHeight + 10;
  }
  const lane = result.counts.map((counts) => {
    const nodes = new Map<
      ShownStyle,
      { top: number; middle: number; thickness: number }
    >();
    for (const s of shownStyles) {
      const thickness = ((counts.get(s) ?? 0) / result.total) * totalInk;
      const middle = centers.get(s)!;
      nodes.set(s, {
        top: middle - thickness / 2,
        middle,
        thickness,
      });
    }
    return nodes;
  });
  const flows = result.flows.map((links) =>
    links.filter(
      (edge): edge is ShownFlow =>
        shownStyles.some((s) => s === edge.from) &&
        shownStyles.some((s) => s === edge.to),
    ),
  );
  const elements = flows.map((links, i) => {
    const srcUsed = new Map<ShownStyle, number>(),
      dstUsed = new Map<ShownStyle, number>();
    const sorted = [...links].sort(
      (a, b) =>
        shownStyles.indexOf(a.from) - shownStyles.indexOf(b.from) ||
        shownStyles.indexOf(a.to) - shownStyles.indexOf(b.to),
    );
    return sorted.map((edge) => {
      const h = (edge.count / result.total) * totalInk;
      const y1 = lane[i].get(edge.from)!.top + (srcUsed.get(edge.from) ?? 0);
      const y2 = lane[i + 1].get(edge.to)!.top + (dstUsed.get(edge.to) ?? 0);
      srcUsed.set(edge.from, (srcUsed.get(edge.from) ?? 0) + h);
      dstUsed.set(edge.to, (dstUsed.get(edge.to) ?? 0) + h);
      const start = x[i] + labelWidth - 4,
        end = x[i + 1],
        middle = (start + end) / 2;
      const d = `M ${start} ${y1}
        C ${middle} ${y1}, ${middle} ${y2}, ${end} ${y2}
        v ${h}
        C ${middle} ${y2 + h}, ${middle} ${y1 + h}, ${start} ${y1 + h} Z`;
      const relevant =
        !focus ||
        (focus.stage === i && focus.state === edge.from) ||
        (focus.stage === i + 1 && focus.state === edge.to);
      return (
        <path
          key={edge.from + edge.to}
          d={d}
          fill="var(--ac-teal)"
          opacity={relevant ? (focus ? 0.9 : 0.62) : 0.1}
        >
          <title>
            {names[edge.from]} → {names[edge.to]} · {edge.count}{" "}
            {t("players", "人")}
          </title>
        </path>
      );
    });
  });
  const focusLinks: { edge: ShownFlow; i: number }[] = [];
  if (focus)
    flows.forEach((links, i) =>
      links.forEach((edge) => {
        if (
          (focus.stage === i && focus.state === edge.from) ||
          (focus.stage === i + 1 && focus.state === edge.to)
        )
          focusLinks.push({ edge, i });
      }),
    );
  return (
    <>
      <div className="ac-flow" ref={holder}>
        <svg
          width="100%"
          height={height}
          viewBox={"0 0 " + width + " " + height}
          role="group"
          aria-label={t(
            "Shot-style transitions by age. Select a group to inspect its paths.",
            "各年龄阶段的投篮类型变化。选择一组可查看相连路径。",
          )}
        >
          {elements}
          {lane.map((nodes, stage) => (
            <g key={stage}>
              <text x={x[stage]} y="16" className="ac-stage-label">
                {stages[stage]}
              </text>
              {[...nodes].map(([state, node]) => {
                const active = focus?.stage === stage && focus.state === state;
                const label =
                  names[state] + " · " + (result.counts[stage].get(state) ?? 0);
                const select = () => setFocus(active ? null : { stage, state });
                return (
                  <g
                    transform={
                      "translate(" + x[stage] + " " + node.middle + ")"
                    }
                    key={state}
                    className={"ac-node" + (active ? " ac-node-active" : "")}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    aria-label={stages[stage] + " " + label}
                    onClick={select}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select();
                      }
                    }}
                  >
                    <rect
                      className="ac-hit"
                      x="0"
                      y={-Math.max(node.thickness, 28) / 2}
                      width={labelWidth - 4}
                      height={Math.max(node.thickness, 28)}
                      rx="3"
                    />
                    <rect
                      className={"ac-node-mark ac-" + state}
                      x="0"
                      y={-node.thickness / 2}
                      width="3"
                      height={node.thickness}
                    />
                    {stage !== 2 && (
                      <rect
                        className={"ac-node-mark ac-" + state}
                        x={labelWidth - 7}
                        y={-node.thickness / 2}
                        width="3"
                        height={node.thickness}
                      />
                    )}
                    <text x="7" y="-2" className="ac-name">
                      {names[state]}
                    </text>
                    <text x="7" y="12" className="ac-count">
                      {result.counts[stage].get(state) ?? 0}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      {focus && (
        <div className="ac-detail">
          <strong>
            {stages[focus.stage]} · {names[focus.state]}
          </strong>
          <button type="button" onClick={() => setFocus(null)}>
            {t("Clear selection", "清除选择")}
          </button>
          {!focusLinks.length && (
            <p>
              {t(
                "No recorded transition links this group to another displayed style.",
                "没有连接该组与相邻年龄段四种打法的记录。",
              )}
            </p>
          )}
          <ul>
            {focusLinks.map(({ edge, i }) => (
              <li key={i + edge.from + edge.to}>
                {stages[i]} {names[edge.from]} → {stages[i + 1]}{" "}
                {names[edge.to]}{" "}
                <b>
                  {edge.count} {t("players", "人")}
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function AgeContext({ data, t }: Props) {
  const [position, setPosition] = useState<PositionGroup>("all");
  const cohort = useMemo(
    () => buildCohort(data.rows, data.metadata.lastSeason),
    [data],
  );
  const result = useMemo(
    () => cohortFlows(cohort, position),
    [cohort, position],
  );
  const names = stateNames(t);
  const stages = stageNames(t);
  const totals = result.counts.map((counts) =>
    styles.reduce((sum, style) => sum + (counts.get(style) ?? 0), 0),
  );
  const distribution = shownStyles.map((style) => ({
    style,
    shares: result.counts.map((counts, i) =>
      totals[i] ? (100 * (counts.get(style) ?? 0)) / totals[i] : null,
    ),
  }));
  return (
    <section className="ac-panel" aria-labelledby="ac-title">
      <header className="ac-header">
        <h1 id="ac-title">{t("Shooting styles by age", "不同年龄打法")}</h1>
        <select
          aria-label={t("Filter by early-career position", "按早期位置筛选")}
          value={position}
          onChange={(e) => setPosition(e.target.value as PositionGroup)}
        >
          {(
            [
              ["all", t("All positions", "全部位置")],
              ["guard", t("Guards", "后卫")],
              ["forward", t("Forwards", "前锋")],
              ["center", t("Centers", "中锋")],
            ] as const
          ).map(([id, name]) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
        </select>
      </header>
      {result.total > 0 ? (
        <>
          <table
            className="ac-overview"
            aria-label={t(
              "Shooting styles among players with records at each age",
              "各年龄段有打法记录的球员中，四种主要打法各占的比例",
            )}
          >
            <thead>
              <tr>
                <th scope="col">{t("Player share", "球员占比")}</th>
                {stages.map((stage, i) => (
                  <th scope="col" key={stage}>
                    {stage}
                    <small>
                      {t(
                        `${totals[i].toLocaleString()} observed`,
                        `${totals[i].toLocaleString()} 人有记录`,
                      )}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distribution.map(({ style, shares }) => (
                <tr key={style}>
                  <th scope="row">{names[style]}</th>
                  {shares.map((share, i) => (
                    <td key={i}>
                      {share == null ? (
                        "—"
                      ) : (
                        <>
                          <span>{share.toFixed(1)}%</span>
                          <div className="ac-share-track" aria-hidden="true">
                            <i style={{ width: share + "%" }} />
                          </div>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <figure className="ac-paths">
            <figcaption>
              {t("Wider lines represent more players.", "线越宽，人数越多。")}
            </figcaption>
            <FlowChart key={position} result={result} t={t} />
          </figure>
        </>
      ) : (
        <p>{t("No qualifying players.", "没有符合条件的球员。")}</p>
      )}
    </section>
  );
}
