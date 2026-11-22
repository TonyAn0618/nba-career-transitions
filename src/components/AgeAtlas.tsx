import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CircleDot,
  Globe2,
  Layers3,
  Link2,
  Radar,
  Search,
  X,
} from "lucide-react";
import type { Dataset, Language, SeasonRow, Translate } from "../lib/types";
import { percent, pp, seasonLabel } from "../lib/analysis";
import {
  firstSeason as firstShotSeason,
  lastSeason as lastShotSeason,
} from "../../data/shot-manifest.json";
import PlayerPicker from "./PlayerPicker";
import PlayerPortrait from "./PlayerPortrait";
import CareerRings from "./CareerRings";
import type { RingLayout } from "../lib/ring-encoding";
import AgePeers from "./AgePeers";
import AgeContext from "./AgeContext";
import CareerTrajectory from "./CareerTrajectory";
import "./age-atlas.css";

const tabIds = ["career", "peers", "context"] as const;
type AtlasTab = (typeof tabIds)[number];

function Methods({
  data,
  t,
  lang,
  player,
  season,
  compareYear,
  onClose,
}: {
  data: Dataset;
  t: Translate;
  lang: Language;
  player: string;
  season: number;
  compareYear: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="atlas-methods"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="atlas-methods-title"
    >
      <div className="atlas-methods-body">
        <header>
          <h2 id="atlas-methods-title">{t("Data & methods", "数据与方法")}</h2>
          <button onClick={onClose} aria-label={t("Close", "关闭")}>
            <X size={20} />
          </button>
        </header>
        <h3>{t("Season records", "赛季记录")}</h3>
        <p>
          {t(
            `NBA regular seasons from ${seasonLabel(data.metadata.firstSeason)} to ${seasonLabel(data.metadata.lastSeason)}. Each of the ${data.metadata.rowCount.toLocaleString()} player-seasons contributes one full-season record, including a combined record when a player changes teams.`,
            `NBA 常规赛覆盖 ${seasonLabel(data.metadata.firstSeason)} 至 ${seasonLabel(data.metadata.lastSeason)}，共 ${data.metadata.rowCount.toLocaleString()} 条球员赛季记录。球员在同一季效力多队时使用全季合计。`,
          )}
        </p>
        <h3>{t("Reading efficiency", "如何读效率")}</h3>
        <p>
          {t(
            "Zone FG% divides makes by attempts in that band. True shooting includes free throws: TS% = PTS / [2 × (FGA + 0.44 × FTA)]. Relative true shooting (rTS) subtracts the league’s TS% in the same season, in percentage points.",
            "分区命中率是该区命中数除以出手数。真实命中率纳入罚球，TS% = 得分 ÷ [2 ×（出手数 + 0.44 × 罚球出手数）]。相对真实命中率（rTS）是球员 TS% 减去当季联盟 TS%，单位为百分点。",
          )}
        </p>
        <h3>{t("What the court covers", "投篮坐标覆盖")}</h3>
        <p>
          {t(
            `Shot locations span ${seasonLabel(firstShotSeason)} to ${seasonLabel(lastShotSeason)}. Each court shows recorded attempts and total attempts for the displayed period. Career maps pool shots and league region counts over the seasons with coordinates.`,
            `逐球坐标覆盖 ${seasonLabel(firstShotSeason)} 至 ${seasonLabel(lastShotSeason)}。场图标明有坐标的出手数与所示期间的总出手数。生涯热区汇总有坐标赛季的投篮，颜色参照同期联盟在同一区域的总命中数与总出手数。`,
          )}
        </p>
        <details className="atlas-method-group">
          <summary>{t("How matches are scored", "匹配方法与数据范围")}</summary>
          <p>
            {t(
              "Matching uses the target’s entire recorded NBA career. If their last season is career year N, each peer is compared through year N and must play the same primary position that year. Peers must have debuted at least one season earlier. Missed seasons count toward elapsed career time. The career overview pools each player’s recorded seasons. Three-point rates use box-score totals, and two-point zones are weighted by estimated attempts in seasons with complete distance data. Season age is measured on January 31.",
              "匹配使用目标球员在库中的全部生涯。若最后一个有记录的赛季是生涯第 N 季，则取参照球员截至第 N 季的表现，并要求两人在第 N 季的主位置相同。参照球员须至少早一个赛季首秀。整季缺席也计入生涯年份。「生涯至今」汇总两人各自有记录的全部赛季，三分按常规赛总数计算，两分分区按有完整距离数据赛季的估算出手数加权。赛季年龄按当季 1 月 31 日计算。",
            )}
          </p>
          <p>
            {t(
              "The three component scores have equal weight. Distribution measures overlap in the five shot shares. Accuracy compares zone FG%, weighted by common attempts, using zones with at least 25 estimated attempts each. Volume compares attempts per 36 minutes. Each component combines the career aggregate and comparisons at corresponding career seasons where available. A history needs at least 200 attempts with complete zone shares.",
              "三项等权。出手分布看五区占比的重合度；命中率看五区准度差，按共同出手量加权，两人在该区估算均至少 25 次出手才计入；出手量取每 36 分钟出手的较小值除以较大值。每项各半考虑累计生涯与相同生涯年份的逐季表现，某项缺少可比年份时用累计值。生涯需至少 200 次具有完整分区占比的出手。",
            )}
          </p>
        </details>
        <details className="atlas-method-group">
          <summary>
            {t("Career follow-up comparisons", "后续转型的计算方法")}
          </summary>
          <p>
            {t(
              "The earlier period includes the match season. The later period runs through the peer’s last recorded regular season. Shares and FG% pool attempts, per-game rates divide totals by games, and relative TS compares against the league in the same seasons, weighted by true shooting attempts. The shot-volume calculation applies the peer’s later shot shares to the target player’s attempts per game in the reference season.",
              "前段含匹配季，后段截至参照球员在库中最后一个有记录的常规赛季。出手占比和命中率按出手数汇总，每场指标用合计数除以出场数。相对联盟真实命中率按各季的投篮出手数加上 0.44 倍罚球出手数加权。出手量试算将参照球员后段的出手占比乘以目标球员在对照季的场均总出手。",
            )}
          </p>
        </details>
        <details className="atlas-method-group">
          <summary>
            {t(
              "How stages and styles are defined",
              "阶段、打法与缺失数据如何定义",
            )}
          </summary>
          <p>
            {t(
              "A season qualifies with complete shot shares, at least one attempt, and either 500 minutes or 200 attempts. Position comes from the first qualifying season at ages 20–23. Each player counts once per stage. Season shot shares are weighted by attempts.",
              "合格赛季要求五区占比完整、有出手，且上场至少 500 分钟或出手至少 200 次。位置取自 20–23 岁之间的第一个合格赛季。每人每阶段只计一次，各季出手占比按出手次数加权。",
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
              "Each age group’s percentages use everyone with a qualifying record in that age group, including players with a mixed style. A ribbon counts players with one of the four displayed styles in both adjacent age groups.",
              "各年龄段的占比以该阶段所有有合格记录的球员为分母，包含均衡型。每条流带统计在相邻两个年龄段均属于图中四种打法的球员人数。",
            )}
          </p>
        </details>
        <p className="atlas-source-links">
          <a
            href={`https://github.com/sumitrodatta/bball-reference-datasets/tree/${data.metadata.sourceCommit}`}
          >
            Basketball-Reference · Sumitro Datta
          </a>
          <a href="https://github.com/DomSamangy/NBA_Shots_04_25">
            NBA.com · Dominic Samangy (2003–04 – 2024–25)
          </a>
          <a href="https://github.com/shufinskiy/nba_data/blob/46488f0f8e1cab58fc1256511ea808166a443a15/datasets/shotdetail_2025.tar.xz">
            NBA.com · ShotChartDetail (2025–26)
          </a>
        </p>
        {compareYear !== season && (
          <a
            className="atlas-interval-link"
            href={`?view=interval&player=${player}&from=${Math.min(compareYear, season)}&to=${Math.max(compareYear, season)}&lang=${lang}`}
          >
            {t(
              "Open the original multi-season transition comparison",
              "打开原版多赛季转型区间比较",
            )}
          </a>
        )}
      </div>
    </dialog>
  );
}

export default function AgeAtlas({
  data,
  query,
}: {
  data: Dataset;
  query: URLSearchParams;
}) {
  const careers = useMemo(() => {
    const map = new Map<string, SeasonRow[]>();
    for (const row of data.rows) {
      const group = map.get(row.playerId);
      if (group) group.push(row);
      else map.set(row.playerId, [row]);
    }
    for (const group of map.values()) group.sort((a, b) => a.season - b.season);
    return map;
  }, [data]);
  const [player, setPlayer] = useState(() => {
    const id = query.get("player");
    return id && careers.has(id)
      ? id
      : careers.has("jamesle01")
        ? "jamesle01"
        : data.rows[0].playerId;
  });
  const [year, setYear] = useState(Number(query.get("ref") || query.get("to")));
  const [lang, setLang] = useState<Language>(
    query.get("lang") === "en" ? "en" : "zh",
  );
  const [tab, setTab] = useState<AtlasTab>(
    () => tabIds.find((id) => id === query.get("view")) ?? "career",
  );
  const [zone, setZone] = useState<number | null>(() =>
    /^[0-4]$/.test(query.get("band") ?? "") ? Number(query.get("band")) : null,
  );
  const [metric, setMetric] = useState<"share" | "fg">(
    query.get("metric") === "fg" ? "fg" : "share",
  );
  const [pinned, setPinned] = useState(() => query.get("pin") === "1");
  const [layout, setLayout] = useState<RingLayout>(() => {
    const value = query.get("layout");
    return value === "dial" || value === "both" ? value : "rings";
  });
  const [requestedPair, setRequestedPair] = useState<
    readonly [number | null, number | null]
  >(() => [
    Number(query.get("compare")) || null,
    Number(query.get("compareTo") ?? query.get("ref") ?? query.get("to")) ||
      null,
  ]);
  const [peer, setPeer] = useState<string | null>(query.get("peer"));
  const [methods, setMethods] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState("");
  const rows = careers.get(player)!;
  const first = rows[0],
    last = rows[rows.length - 1];
  const selected = rows.find((r) => r.season === year) ?? last;
  const summarySeason = tab === "peers" ? last : selected;
  const [peerYear, setPeerYear] = useState<number | null>(() => {
    if (query.has("stage")) {
      const stage = Number(query.get("stage"));
      return Number.isSafeInteger(stage) && stage > 0 ? stage : null;
    }
    // Earlier share links stored offsets and wrote step=0 even before any interaction.
    const offset = Number(query.get("step"));
    return offset !== 0 &&
      Number.isSafeInteger(offset) &&
      selected.debutSeason != null
      ? selected.season - selected.debutSeason + 1 + offset
      : null;
  });
  const secondSeason = rows.find((r) => r.season === requestedPair[1]) ?? last;
  const alternatives = rows.filter((r) => r !== secondSeason);
  const firstSeason =
    alternatives.find((r) => r.season === requestedPair[0]) ??
    alternatives.find((r) =>
      r.shares.some(
        (value, i) => value != null && secondSeason.shares[i] != null,
      ),
    ) ??
    alternatives[0] ??
    secondSeason;
  const comparisonSeasons = useMemo(
    () => [firstSeason, secondSeason] as const,
    [firstSeason, secondSeason],
  );
  function selectComparison(firstYear: number, secondYear: number) {
    setRequestedPair([firstYear, secondYear]);
  }
  const t: Translate = (en, zh) => (lang === "en" ? en : zh);
  useEffect(() => {
    const params = new URLSearchParams({
      player,
      ref: String(selected.season),
      lang,
    });
    if (peerYear != null) params.set("stage", String(peerYear));
    if (pinned) params.set("pin", "1");
    if (peer) params.set("peer", peer);
    if (zone != null) params.set("band", String(zone));
    if (layout !== "rings") params.set("layout", layout);
    if (metric === "fg") params.set("metric", "fg");
    if (firstSeason.season === requestedPair[0])
      params.set("compare", String(firstSeason.season));
    if (secondSeason.season !== selected.season)
      params.set("compareTo", String(secondSeason.season));
    if (tab !== "career") params.set("view", tab);
    const fragment = window.location.hash;
    const keepFragment =
      (tab === "career" &&
        (fragment === "#career-rings" || fragment === "#compare-seasons")) ||
      (tab === "peers" &&
        (fragment === "#age-peers" ||
          fragment === "#peer-follow-up" ||
          fragment === "#peer-shot-courts" ||
          fragment === "#peer-transition") &&
        document.getElementById(fragment.slice(1)));
    window.history.replaceState(
      null,
      "",
      window.location.pathname + "?" + params + (keepFragment ? fragment : ""),
    );
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title =
      (tab === "context"
        ? t("League shooting trends", "联盟打法变化")
        : selected.name) +
      " · " +
      t("Player Career Transitions", "球员生涯转型研究");
    setShareFallback("");
    setCopied(false);
  }, [
    player,
    selected,
    peerYear,
    lang,
    peer,
    pinned,
    zone,
    metric,
    layout,
    tab,
    firstSeason,
    secondSeason,
    requestedPair,
  ]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (
      [
        "career-rings",
        "compare-seasons",
        "age-peers",
        "peer-follow-up",
        "peer-shot-courts",
        "peer-transition",
      ].includes(id)
    ) {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }
  }, []);
  function selectPlayer(id: string) {
    if (id === player) return;
    setPlayer(id);
    setPinned(false);
    setYear(0);
    setRequestedPair([null, null]);
    setZone(null);
    setPeer(null);
    setPeerYear(null);
  }
  function selectSeason(row: SeasonRow) {
    if (row.id === selected.id) return;
    setYear(row.season);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setShareFallback(window.location.href);
    }
  }
  const labels = [
    t("Career profile", "生涯与出手"),
    t("Career transition references", "生涯转型参考"),
    t("League shooting trends", "联盟打法变化"),
  ];
  const icons = [CircleDot, Radar, Layers3];
  const points36 =
    summarySeason.points != null &&
    summarySeason.minutes != null &&
    summarySeason.minutes > 0
      ? ((summarySeason.points * 36) / summarySeason.minutes).toFixed(1)
      : "—";
  return (
    <div className="atlas">
      <a className="skip-link" href="#atlas-workspace">
        {t("Skip to analysis", "跳至分析")}
      </a>
      <header className="atlas-top">
        <div className="atlas-wrap atlas-bar">
          <a className="atlas-mark" href={"?lang=" + lang}>
            <img src="./ball.svg" alt="" />
            <b>{t("Player Career Transitions", "球员生涯转型研究")}</b>
          </a>
          <div className="atlas-tools">
            <button
              onClick={() => setMethods(true)}
              aria-label={t("Data & methods", "数据与方法")}
            >
              <BookOpen />
              <span>{t("Methods", "数据与方法")}</span>
            </button>
            <button
              onClick={share}
              aria-label={t("Share this view", "分享当前视图")}
            >
              <Link2 />
              <span>{copied ? t("Copied", "已复制") : t("Share", "分享")}</span>
            </button>
            <button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              aria-label={t("切换为中文", "Switch to English")}
            >
              <Globe2 />
              <b>{lang === "zh" ? "EN" : "中文"}</b>
            </button>
          </div>
        </div>
      </header>
      {shareFallback && (
        <label className="atlas-manualshare">
          {t("Copy this link", "复制此链接")}{" "}
          <input
            readOnly
            value={shareFallback}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </label>
      )}
      <main className="atlas-wrap" id="atlas-workspace">
        {tab !== "context" && (
          <>
            <section
              className="atlas-identity"
              aria-labelledby="atlas-player-name"
            >
              <div className="atlas-player">
                <PlayerPortrait
                  playerId={player}
                  name={selected.name}
                  className="atlas-portrait"
                />
                <div className="atlas-bio">
                  <div className="atlas-kicker">
                    {tab === "peers" &&
                      t("Last recorded season · ", "最近记录赛季 · ")}
                    {(summarySeason.teams?.length
                      ? summarySeason.teams
                      : [summarySeason.team]
                    ).join(" · ")}{" "}
                    · {summarySeason.position} ·{" "}
                    {seasonLabel(summarySeason.season)}
                  </div>
                  <h1 id="atlas-player-name">{selected.name}</h1>
                  <div className="atlas-career-range">
                    {first.age}–{last.age} {t("years old", "岁")} <i />{" "}
                    {t(
                      `${rows.length} recorded seasons`,
                      `${rows.length} 个记录赛季`,
                    )}
                  </div>
                </div>
              </div>
              <div className="atlas-hero-actions">
                <div className="atlas-find">
                  <Search size={15} />
                  <PlayerPicker
                    players={data.players}
                    value={player}
                    onChange={selectPlayer}
                    label={t("Search all players", "搜索所有球员")}
                    triggerText={t("Search all players", "搜索所有球员")}
                    t={t}
                  />
                </div>
              </div>
            </section>
            <div className="atlas-metrics">
              {[
                [
                  t("Shot attempts", "赛季出手"),
                  summarySeason.fga?.toLocaleString() ?? "—",
                ],
                [t("Points per 36 min", "每 36 分钟得分"), points36],
                [t("True shooting", "真实命中率"), percent(summarySeason.ts)],
                [
                  t("TS vs. league", "相对联盟真实命中率"),
                  pp(summarySeason.rts),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </>
        )}
        <nav
          className="atlas-tabs"
          aria-label={t("Analysis views", "分析视图")}
        >
          {tabIds.map((id, i) => {
            const Icon = icons[i];
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={id === tab ? "page" : undefined}
              >
                <Icon size={17} />
                {labels[i]}
              </button>
            );
          })}
        </nav>
        <div className="atlas-view">
          {tab === "career" && (
            <>
              <CareerRings
                key={"rings-" + player}
                pinned={pinned}
                onPinned={setPinned}
                layout={layout}
                onLayout={setLayout}
                comparisonSeasons={comparisonSeasons}
                onCompareSeasons={selectComparison}
                metric={metric}
                onMetric={setMetric}
                rows={rows}
                selected={selected}
                onSelect={selectSeason}
                zone={zone}
                onZone={setZone}
                t={t}
              />
              <CareerTrajectory
                rows={rows}
                selected={selected}
                onSelect={selectSeason}
                t={t}
              />
            </>
          )}
          {tab === "peers" && (
            <AgePeers
              anchor={last}
              careers={careers}
              peerId={peer}
              onPeer={setPeer}
              selectedYear={peerYear}
              onYear={setPeerYear}
              t={t}
            />
          )}
          {tab === "context" && <AgeContext data={data} t={t} />}
        </div>
      </main>
      {methods && (
        <Methods
          data={data}
          t={t}
          lang={lang}
          player={player}
          season={secondSeason.season}
          compareYear={firstSeason.season}
          onClose={() => setMethods(false)}
        />
      )}
    </div>
  );
}
