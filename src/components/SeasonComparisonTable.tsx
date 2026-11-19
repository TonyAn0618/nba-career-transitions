import type { Dataset, SeasonRow, Translate } from "../lib/types";
import { fga36, percent, pp, seasonLabel, ZONES } from "../lib/analysis";
export function SeasonComparisonTable({
  data,
  selected,
  t,
}: {
  data: Dataset;
  selected: SeasonRow[];
  t: Translate;
}) {
  const fields: [string, (r: SeasonRow) => string | number][] = [
    [t("Season", "赛季"), (r) => seasonLabel(r.season)],
    [t("Team(s)", "球队"), (r) => (r.teams ?? [r.team]).join(", ")],
    [t("Age", "年龄"), (r) => r.age ?? "—"],
    [t("Games", "出场"), (r) => r.games ?? "—"],
    [t("Minutes", "上场分钟"), (r) => r.minutes ?? "—"],
    [t("Points", "得分"), (r) => r.points ?? "—"],
    [t("FTA", "罚球次数"), (r) => r.fta ?? "—"],
    [t("FGA", "出手"), (r) => r.fga ?? "—"],
    [
      t("3PM / 3PA", "三分命中 / 三分出手"),
      (r) => `${r.threeMade ?? "—"} / ${r.threeAttempts ?? "—"}`,
    ],
    [t("FGA / 36", "出手 / 36分钟"), (r) => fga36(r)?.toFixed(2) ?? "—"],
    ...ZONES.map(
      (z, i) =>
        [
          z + t(" share", " 出手占比"),
          (r: SeasonRow) => percent(r.shares[i]),
        ] as [string, (r: SeasonRow) => string],
    ),
    ...ZONES.map(
      (z, i) =>
        [
          z + t(" FG%", " 命中率"),
          (r: SeasonRow) => percent(r.shares[i] === 0 ? null : r.fg[i]),
        ] as [string, (r: SeasonRow) => string],
    ),
    [t("TS%", "TS%"), (r) => percent(r.ts)],
    [t("League TS%", "同期联盟 TS%"), (r) => percent(r.leagueTs)],
    [t("Relative TS", "相对 TS"), (r) => pp(r.rts)],
    [
      t("NBA 3P share", "联盟三分出手占比"),
      (r) =>
        percent(
          data.league.find((l) => l.season === r.season)?.threeShare ?? null,
        ),
    ],
    [t("Quality flags", "质量标记"), (r) => r.dataFlags.join(", ") || "—"],
  ];
  return (
    <div className="data-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Metric", "指标")}</th>
            {selected.map((r) => (
              <th key={r.id}>
                {r.name} <small>{seasonLabel(r.season)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(([name, value]) => (
            <tr key={name}>
              <th>{name}</th>
              {selected.map((r) => (
                <td key={r.id}>{value(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
