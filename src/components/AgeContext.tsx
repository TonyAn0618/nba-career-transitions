import { useEffect, useMemo, useRef, useState } from "react";
import { percent, pp, seasonLabel } from "../lib/analysis";
import {
  buildCohort,
  cohortFlows,
  states,
  type Flow,
  type PositionGroup,
  type SplitIndex,
  type StageState,
  type TeamSplit,
} from "../lib/age-context";
import type { Dataset, SeasonRow, Translate } from "../lib/types";
import "./age-context.css";

type Props = {
  data: Dataset;
  selected: SeasonRow;
  rows: SeasonRow[];
  t: Translate;
};
type StateNames = Record<StageState, string>;
type FlowResult = ReturnType<typeof cohortFlows>;

function stateNames(t: Translate): StateNames {
  return {
    rim: t("Rim-heavy", "篮下型"),
    inside: t("Inside", "近筐型"),
    mid: t("Midrange", "中距离型"),
    three: t("Three-point", "三分型"),
    mixed: t("Mixed", "均衡型"),
    unobserved: t("No season", "无合格季"),
    censored: t("Pending", "观察未满"),
  };
}
const stageNames = (t: Translate) => [
  t("Entry · 20–23", "入行 · 20–23 岁"),
  t("Prime · 25–28", "盛年 · 25–28 岁"),
  t("Veteran · 31+", "老将 · 31+ 岁"),
];
function edgeColor(delta: number | null) {
  if (delta === null) return "#758086";
  if (delta >= 0.5) return "#81c6be";
  if (delta <= -0.5) return "#efbd74";
  return "#adb9c0";
}

function FlowChart({ result, t }: { result: FlowResult; t: Translate }) {
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [focus, setFocus] = useState<{
    stage: number;
    state: StageState;
  } | null>(null);
  useEffect(() => {
    if (!holder.current) return;
    const element = holder.current;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const names = stateNames(t),
    stages = stageNames(t);
  const labelWidth = width < 480 ? 79 : 108;
  const x = [1, (width - labelWidth) / 2, width - labelWidth - 1];
  const height = 326,
    totalInk = 122;
  const lane = result.counts.map((counts) => {
    const active = states.filter((s) => (counts.get(s) ?? 0) > 0);
    const used = active.reduce(
      (sum, s) =>
        sum + Math.max(30, (counts.get(s)! / result.total) * totalInk),
      0,
    );
    const gap = Math.min(
      11,
      Math.max(3, (height - 34 - used) / Math.max(active.length - 1, 1)),
    );
    let y = 29;
    const nodes = new Map<
      StageState,
      { top: number; middle: number; thickness: number }
    >();
    for (const s of active) {
      const thickness = (counts.get(s)! / result.total) * totalInk;
      const laneHeight = Math.max(30, thickness);
      nodes.set(s, {
        top: y + (laneHeight - thickness) / 2,
        middle: y + laneHeight / 2,
        thickness,
      });
      y += laneHeight + gap;
    }
    return nodes;
  });
  const flowKey = (stage: number, s: StageState) => stage + "-" + s;
  const elements = result.flows.map((links, i) => {
    const srcUsed = new Map<StageState, number>(),
      dstUsed = new Map<StageState, number>();
    const sorted = [...links].sort(
      (a, b) =>
        states.indexOf(a.from) - states.indexOf(b.from) ||
        states.indexOf(a.to) - states.indexOf(b.to),
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
          fill={edgeColor(edge.delta)}
          opacity={relevant ? (focus ? 0.9 : 0.62) : 0.1}
        >
          <title>
            {names[edge.from]} → {names[edge.to]} · {edge.count}{" "}
            {t("players", "人")} · ΔrTS {pp(edge.delta)}
          </title>
        </path>
      );
    });
  });
  const focusLinks: { edge: Flow; i: number }[] = [];
  if (focus)
    result.flows.forEach((flows, i) =>
      flows.forEach((edge) => {
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
                  names[state] + " · " + result.counts[stage].get(state);
                const select = () => setFocus(active ? null : { stage, state });
                return (
                  <g
                    transform={
                      "translate(" + x[stage] + " " + node.middle + ")"
                    }
                    key={flowKey(stage, state)}
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
                      height={Math.max(node.thickness, 1)}
                    />
                    {stage !== 2 && (
                      <rect
                        className={"ac-node-mark ac-" + state}
                        x={labelWidth - 7}
                        y={-node.thickness / 2}
                        width="3"
                        height={Math.max(node.thickness, 1)}
                      />
                    )}
                    <text x="7" y="-2" className="ac-name">
                      {names[state]}
                    </text>
                    <text x="7" y="12" className="ac-count">
                      {result.counts[stage].get(state)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <div className="ac-flow-key">
        <span>{t("Mean change in relative TS", "人均相对真实命中率变化")}</span>
        {[
          ["#81c6be", t("≥ +0.5 pp", "≥ +0.5 个百分点")],
          ["#adb9c0", t("|Δ| < 0.5", "绝对值 < 0.5")],
          ["#efbd74", t("≤ −0.5 pp", "≤ −0.5 个百分点")],
          ["#758086", t("unavailable", "缺数据")],
        ].map(([color, label]) => (
          <span key={label}>
            <i style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      {focus && (
        <div className="ac-detail">
          <strong>
            {stages[focus.stage]} · {names[focus.state]}
          </strong>
          <button type="button" onClick={() => setFocus(null)}>
            {t("Clear selection", "清除选择")}
          </button>
          <ul>
            {focusLinks.map(({ edge, i }) => (
              <li key={i + edge.from + edge.to}>
                {stages[i].split(" · ")[0]} {names[edge.from]} →{" "}
                {stages[i + 1].split(" · ")[0]} {names[edge.to]}{" "}
                <b>
                  {edge.count} {t("players", "人")}
                </b>
                <small>ΔrTS {pp(edge.delta)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Cohort({ data, t }: Pick<Props, "data" | "t">) {
  const [position, setPosition] = useState<PositionGroup>("all");
  const cohort = useMemo(
    () => buildCohort(data.rows, data.metadata.lastSeason),
    [data],
  );
  const result = useMemo(
    () => cohortFlows(cohort, position),
    [cohort, position],
  );
  return (
    <div>
      <div className="ac-subhead">
        <div>
          <h3>
            {t(
              "Where do early shooting styles lead?",
              "年轻球员的打法后来如何变化？",
            )}
          </h3>
          <p>
            {t(
              "Ribbon width counts players. Select a shooting style to trace its connections.",
              "带宽代表人数。点选一种打法，查看球员从哪里来、往哪里去。",
            )}
          </p>
        </div>
        <label>
          {t("Entry position", "入行位置")}{" "}
          <select
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
        </label>
      </div>
      <p className="ac-population">
        <b>{result.total.toLocaleString()}</b>{" "}
        {t(
          "players with a qualifying season at ages 20–23",
          "名球员在 20–23 岁有合格赛季",
        )}{" "}
        · {t("through", "截至")} {seasonLabel(data.metadata.lastSeason)}
      </p>
      {result.total > 0 ? (
        <FlowChart key={position} result={result} t={t} />
      ) : (
        <p>{t("No qualifying players.", "没有符合条件的球员。")}</p>
      )}
      <details>
        <summary>
          {t(
            "How stages and styles are defined",
            "阶段、打法与缺失数据如何定义",
          )}
        </summary>
        <p>
          {t(
            "A season qualifies with complete shot shares, at least one attempt, and either 500 minutes or 200 attempts. Position comes from the earliest qualifying entry season. Each player counts once per stage. Shot shares and relative true shooting (rTS) use attempt-weighted season averages. Ribbon color uses the average change in rTS for players observed in both stages, in percentage points.",
            "合格赛季要求五区占比完整、有出手，且上场至少 500 分钟或出手至少 200 次。位置取自最早的合格入行赛季。每人每阶段只计一次。各季出手分布和相对真实命中率（rTS）按出手次数加权。色带表示两阶段均有记录球员的人均 rTS 变化，单位为百分点。",
          )}
        </p>
        <p>
          {t(
            "Styles use the largest of inside (0–10 ft), midrange (10 ft to the arc) and three-point share. A lead under 5 percentage points counts as mixed. Inside leaders with at least half of all attempts from 0–3 ft are rim-heavy.",
            "比较近筐（0–10 英尺）、中距离（10 英尺至三分线）与三分占比，按最高者归类。前两类相差不足 5 个百分点归为均衡型。近筐领先且至少半数出手在 0–3 英尺的球员归为篮下型。",
          )}
        </p>
        <p>
          {t(
            "Pending means the snapshot ends before a player could complete the prime window or reach age 31, with no qualifying season yet in that stage. No season means the age threshold passed without a qualifying record in the snapshot. This includes low minutes and league absences; the data do not establish retirement.",
            "若该阶段尚无合格赛季，且截至数据末季仍未满 28 岁（盛年）或 31 岁（老将），记为「观察未满」。已达到相应年龄但仍无合格赛季，记为「无合格季」，可能源于出场少或当季不在 NBA，无法据此判断退役。",
          )}
        </p>
      </details>
    </div>
  );
}

function StintBars({
  teams,
  metric,
  t,
}: {
  teams: TeamSplit[];
  metric: "shares" | "fg";
  t: Translate;
}) {
  const names = [
    t("0–3 ft", "0–3 英尺"),
    t("3–10 ft", "3–10 英尺"),
    t("10–16 ft", "10–16 英尺"),
    t("16 ft–arc", "16 英尺至三分线"),
    t("Three-point", "三分"),
  ];
  return (
    <table
      className="ac-team-matrix"
      aria-label={
        metric === "fg"
          ? t("Zone field-goal percentage by team", "各队分区命中率")
          : t("Shot share by team", "各队分区出手占比")
      }
    >
      <thead>
        <tr>
          <th scope="col">{t("Distance", "距离")}</th>
          {teams.map((team) => (
            <th scope="col" key={team.team}>
              {team.team}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {names.map((zone, i) => (
          <tr key={zone}>
            <th scope="row">{zone}</th>
            {teams.map((stint) => {
              const value = stint[metric][i],
                share = stint.shares[i];
              const small =
                metric === "fg" &&
                value !== null &&
                stint.fga !== null &&
                share !== null &&
                Math.round(stint.fga * share) < 25;
              return (
                <td key={stint.team}>
                  <div
                    className={"ac-metric" + (small ? " ac-small-sample" : "")}
                  >
                    <i style={{ width: (value ?? 0) * 100 + "%" }} />
                    <span>
                      {percent(value)}
                      {small && " *"}
                    </span>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamContext({ data, selected, rows, t }: Props) {
  const options = rows
    .filter((row) => (row.teams?.length ?? 0) > 1)
    .sort((a, b) => b.season - a.season);
  const [year, setYear] = useState<number | null>(null);
  const [metric, setMetric] = useState<"shares" | "fg">("shares");
  const [index, setIndex] = useState<SplitIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const available = options.length > 0;
  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    fetch("./data/team-splits.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw Error(String(response.status));
        return response.json() as Promise<SplitIndex>;
      })
      .then(setIndex)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [available, attempt]);
  const season =
    options.find((r) => r.season === year) ??
    options.find((r) => r.season === selected.season) ??
    options[0];
  const teams = index?.[season?.id] ?? [];
  const incomplete = teams.filter(
    (stint) =>
      stint.shares.some((v) => v === null) ||
      Math.abs(stint.shares.reduce<number>((sum, v) => sum + (v ?? 0), 0) - 1) >
        0.005,
  );
  if (!available)
    return (
      <div className="ac-empty">
        <h3>{t("One team per recorded season", "记录中每季只效力一队")}</h3>
        <p>
          {selected.name}{" "}
          {t(
            "has no multi-team regular season in this snapshot.",
            "在这份常规赛数据里，没有同季效力多支球队的记录。",
          )}
        </p>
        <a
          className="ac-example"
          href={`?view=context&player=doncilu01&ref=2025&lang=${t("en", "zh")}`}
        >
          {t(
            "Explore Luka Dončić’s Dallas and Los Angeles season",
            "查看东契奇同季效力达拉斯和洛杉矶的数据",
          )}
        </a>
      </div>
    );
  return (
    <div>
      <div className="ac-subhead">
        <div>
          <h3>
            {t(
              "The same player in different team contexts",
              "同一球员在不同球队的出手选择",
            )}
          </h3>
          <p>
            {selected.name} ·{" "}
            {t(
              "team splits within a single regular season",
              "同一常规赛季的分队统计",
            )}
          </p>
        </div>
        <label>
          {t("Multi-team season", "多队赛季")}{" "}
          <select
            value={season.season}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {options.map((r) => (
              <option value={r.season} key={r.id}>
                {seasonLabel(r.season)} · {r.teams?.join(" / ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {failed ? (
        <p>
          {t("Team splits could not load.", "球队数据加载失败。")}{" "}
          <button
            onClick={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            {t("Retry", "重试")}
          </button>
        </p>
      ) : !index ? (
        <p role="status">{t("Loading team splits…", "正在读取球队数据…")}</p>
      ) : teams.length < 2 ? (
        <p>
          {t(
            "Comparable team splits are unavailable.",
            "缺少可供比较的分队统计。",
          )}
        </p>
      ) : (
        <>
          <div className="ac-stints">
            {teams.map((s) => (
              <div key={s.team}>
                <strong>
                  {data.teams?.find(
                    (x) => x.season === season.season && x.abbr === s.team,
                  )?.name ?? s.team}
                </strong>
                <span>
                  {s.games ?? "—"} {t("games", "场")} · {s.fga ?? "—"}{" "}
                  {t("attempts", "次出手")} · TS {percent(s.ts)}
                </span>
              </div>
            ))}
          </div>
          <div
            className="ac-metric-controls"
            aria-label={t("Team metric", "球队指标")}
          >
            <button
              type="button"
              aria-pressed={metric === "shares"}
              onClick={() => setMetric("shares")}
            >
              {t("Share of attempts", "出手占比")}
            </button>
            <button
              type="button"
              aria-pressed={metric === "fg"}
              onClick={() => setMetric("fg")}
            >
              {t("Zone FG%", "区域命中率")}
            </button>
          </div>
          <div className="ac-scroll">
            <StintBars teams={teams} metric={metric} t={t} />
          </div>
          {incomplete.length > 0 && (
            <p className="ac-foot">
              {incomplete.map((s) => s.team).join(" / ")} ·{" "}
              {t(
                "The five reported shares are incomplete or differ from 100% by over 0.5 percentage points. Bars show the source values.",
                "五区占比缺失或总和偏离 100% 超过 0.5 个百分点。横条显示来源中的数值。",
              )}
            </p>
          )}
          {metric === "fg" &&
            teams.some(
              (stint) =>
                stint.fga !== null &&
                stint.shares.some(
                  (share, i) =>
                    share !== null &&
                    stint.fg[i] !== null &&
                    Math.round(stint.fga! * share) < 25,
                ),
            ) && (
              <p className="ac-foot">
                {t(
                  "* Fewer than 25 estimated attempts in this zone, using the reported share and team attempts.",
                  "* 该区域估算出手不足 25 次，按公布的占比与该队出手总数计算。",
                )}
              </p>
            )}
          <p className="ac-foot">
            {t(
              "Bars share a 0–100% scale. Teams appear alphabetically. These records document team stints; transaction dates and play order are unavailable.",
              "所有横条均用 0–100% 刻度。球队按缩写排序。源数据记录同季所属球队，未提供交易日期或效力先后。",
            )}
          </p>
        </>
      )}
    </div>
  );
}

export default function AgeContext(props: Props) {
  const { t, selected } = props;
  const [choice, setChoice] = useState<{
    anchor: string;
    tab: "cohort" | "teams";
  } | null>(null);
  const tab =
    choice?.anchor === selected.id
      ? choice.tab
      : (selected.teams?.length ?? 0) > 1
        ? "teams"
        : "cohort";
  return (
    <section
      className="ac-panel"
      aria-label={t("Cohort and team context", "群体与球队背景")}
    >
      <div className="ac-header">
        <h2>{t("Career context", "生涯背景")}</h2>
        <div className="ac-toggle" aria-label={t("Context view", "背景视图")}>
          {(
            [
              ["cohort", t("Age cohorts", "年龄群体")],
              ["teams", t("Team changes", "同季换队")],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setChoice({ anchor: selected.id, tab: id })}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      {tab === "cohort" ? (
        <Cohort data={props.data} t={t} />
      ) : (
        <TeamContext key={selected.id} {...props} />
      )}
    </section>
  );
}
