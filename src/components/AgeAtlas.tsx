import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleDot,
  Globe2,
  Layers3,
  Link2,
  Radar,
  ScanLine,
  Search,
  X,
} from "lucide-react";
import type { Dataset, Language, SeasonRow, Translate } from "../lib/types";
import { percent, pp, seasonLabel } from "../lib/analysis";
import PlayerPicker from "./PlayerPicker";
import PlayerPortrait from "./PlayerPortrait";
import CareerRings from "./CareerRings";
import type { RingLayout } from "../lib/ring-encoding";
import AgePeers from "./AgePeers";
import AgeContext from "./AgeContext";
import CareerTrajectory from "./CareerTrajectory";
import CareerCourts from "./CareerCourts";
import "./age-atlas.css";

const caseStudies = [
  ["jamesle01", "LeBron James"],
  ["lopezbr01", "Brook Lopez"],
  ["derozde01", "DeMar DeRozan"],
  ["westbru01", "Russell Westbrook"],
  ["edwaran01", "Anthony Edwards"],
] as const;

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
            `Regular seasons from ${seasonLabel(data.metadata.firstSeason)} to ${seasonLabel(data.metadata.lastSeason)}. Each of the ${data.metadata.rowCount.toLocaleString()} player-seasons contributes one full-season record, including a combined record when a player changes teams.`,
            `常规赛覆盖 ${seasonLabel(data.metadata.firstSeason)} 至 ${seasonLabel(data.metadata.lastSeason)}，共 ${data.metadata.rowCount.toLocaleString()} 条球员赛季记录。赛季总览对多队球员使用全季合计，球队对照单独读取分队记录。`,
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
            "Shot locations span 2003–04 to 2024–25. Each court reports the recorded attempts and season total. Five-zone statistics also cover seasons without coordinates.",
            "逐球坐标覆盖 2003–04 至 2024–25。每张场图注明已记录出手数与该季总出手数，坐标覆盖期外仍可查看赛季五区统计。",
          )}
        </p>
        <p className="atlas-source-links">
          <a
            href={`https://github.com/sumitrodatta/bball-reference-datasets/tree/${data.metadata.sourceCommit}`}
          >
            Basketball-Reference · Sumitro Datta
          </a>
          <a href="https://github.com/DomSamangy/NBA_Shots_04_25">
            NBA.com · Dominic Samangy
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
  const [layout, setLayout] = useState<RingLayout>(() => {
    const value = query.get("layout");
    return value === "dial" || value === "both" ? value : "rings";
  });
  const [requestedCompare, setCompareYear] = useState<number | undefined>(() =>
    query.has("compare") ? Number(query.get("compare")) : undefined,
  );
  const [peer, setPeer] = useState<string | null>(query.get("peer"));
  const [step, setStep] = useState(() =>
    Math.max(0, Math.min(5, parseInt(query.get("step") ?? "0", 10) || 0)),
  );
  const [methods, setMethods] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState("");
  const rows = careers.get(player)!;
  const selected = rows.find((r) => r.season === year) ?? rows[rows.length - 1];
  const first = rows[0],
    last = rows[rows.length - 1];
  const alternatives = rows.filter((r) => r !== selected);
  const comparison =
    alternatives.find((r) => r.season === requestedCompare) ??
    alternatives.find((r) =>
      r.shares.some((value, i) => value != null && selected.shares[i] != null),
    ) ??
    alternatives[0] ??
    selected;
  const compareYear = comparison.season;
  const t: Translate = (en, zh) => (lang === "en" ? en : zh);
  useEffect(() => {
    const params = new URLSearchParams({
      player,
      ref: String(selected.season),
      step: String(step),
      lang,
    });
    if (peer) params.set("peer", peer);
    if (zone != null) params.set("band", String(zone));
    if (layout !== "rings") params.set("layout", layout);
    if (metric === "fg") params.set("metric", "fg");
    if (requestedCompare != null && compareYear === requestedCompare)
      params.set("compare", String(compareYear));
    if (tab !== "career") params.set("view", tab);
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        "?" +
        params +
        (tab === "career" && window.location.hash === "#career-rings"
          ? "#career-rings"
          : ""),
    );
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title =
      selected.name +
      " · " +
      t("Career transitions", "生涯转型") +
      " | Shot Atlas";
    setShareFallback("");
    setCopied(false);
  }, [
    player,
    selected,
    step,
    lang,
    peer,
    zone,
    metric,
    layout,
    tab,
    compareYear,
    requestedCompare,
  ]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (window.location.hash === "#career-rings") {
      document
        .getElementById("career-rings")
        ?.scrollIntoView({ block: "start" });
    }
  }, []);
  function selectPlayer(id: string) {
    if (id === player) return;
    setPlayer(id);
    setYear(0);
    setCompareYear(undefined);
    setZone(null);
    setPeer(null);
    setStep(0);
  }
  function selectSeason(row: SeasonRow) {
    if (row.id === selected.id) return;
    setYear(row.season);
    setPeer(null);
    setStep(0);
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
    t("Historical peers", "同龄转型参照"),
    t("Teams & cohorts", "球队与群体"),
  ];
  const icons = [CircleDot, Radar, Layers3];
  const points36 =
    selected.points != null && selected.minutes != null && selected.minutes > 0
      ? ((selected.points * 36) / selected.minutes).toFixed(1)
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
            <b>Shot Atlas</b>
          </a>
          <span className="atlas-brand-section">
            {t("Career transitions", "生涯转型研究")}
          </span>
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
              aria-label={t(
                "Share player, season and analysis view",
                "分享球员、赛季和分析视图",
              )}
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
        <div className="atlas-casebar">
          <div className="atlas-collection">
            <span /> {t("NBA regular season", "NBA 常规赛")} <i />{" "}
            {seasonLabel(data.metadata.firstSeason)} —{" "}
            {seasonLabel(data.metadata.lastSeason)}
          </div>
          <label className="atlas-cases">
            <BookOpen size={15} />
            <span>{t("Players", "球员案例")}</span>
            <select
              value={caseStudies.some((c) => c[0] === player) ? player : ""}
              onChange={(e) => selectPlayer(e.target.value)}
              aria-label={t("Guided player cases", "球员案例速览")}
            >
              {!caseStudies.some((c) => c[0] === player) && (
                <option value="">{t("Choose a case", "选择案例")}</option>
              )}
              {caseStudies.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <section className="atlas-identity" aria-labelledby="atlas-player-name">
          <div className="atlas-player">
            <PlayerPortrait
              playerId={player}
              name={selected.name}
              className="atlas-portrait"
            />
            <div className="atlas-bio">
              <div className="atlas-kicker">
                {(selected.teams?.length
                  ? selected.teams
                  : [selected.team]
                ).join(" · ")}{" "}
                · {selected.position}
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
            <label className="atlas-season">
              <span>{t("Selected age", "所选年龄")}</span>
              <select
                aria-label={t("Select age and season", "选择年龄和赛季")}
                value={selected.season}
                onChange={(e) =>
                  selectSeason(
                    rows.find((r) => r.season === Number(e.target.value))!,
                  )
                }
              >
                {rows.map((r) => (
                  <option key={r.id} value={r.season}>
                    {t(`Age ${r.age}`, `${r.age} 岁`)} · {seasonLabel(r.season)}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </section>
        <div className="atlas-metrics">
          {[
            [
              t("Shot attempts", "赛季出手"),
              selected.fga?.toLocaleString() ?? "—",
            ],
            [t("Points per 36 min", "每 36 分钟得分"), points36],
            [t("True shooting", "真实命中率"), percent(selected.ts)],
            [t("TS vs. league", "相对联盟真实命中率"), pp(selected.rts)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
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
                layout={layout}
                onLayout={setLayout}
                compareYear={compareYear}
                onCompareYear={setCompareYear}
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
              <CareerCourts
                compareYear={compareYear}
                onCompareYear={setCompareYear}
                key={player}
                rows={rows}
                selected={selected}
                zone={zone}
                onZone={setZone}
                t={t}
              />
              <button
                className="atlas-peer-link"
                onClick={() => {
                  setTab("peers");
                  document
                    .querySelector(".atlas-tabs")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                <Radar size={17} />
                {t(
                  `Find historical peers at age ${selected.age}`,
                  `查看 ${selected.age} 岁的同龄转型参照`,
                )}
              </button>
            </>
          )}
          {tab === "peers" && (
            <AgePeers
              anchor={selected}
              careers={careers}
              peerId={peer}
              onPeer={setPeer}
              step={step}
              onStep={setStep}
              t={t}
            />
          )}
          {tab === "context" && (
            <AgeContext data={data} selected={selected} rows={rows} t={t} />
          )}
        </div>
      </main>
      <footer className="atlas-wrap atlas-footer">
        <span>
          <ScanLine size={16} /> Shot Atlas
        </span>
        <span>COMP 6411D · Team GOAT</span>
        <button onClick={() => setMethods(true)}>
          {t("Sources & methods", "数据来源与方法")}
        </button>
      </footer>
      {methods && (
        <Methods
          data={data}
          t={t}
          lang={lang}
          player={player}
          season={selected.season}
          compareYear={compareYear}
          onClose={() => setMethods(false)}
        />
      )}
    </div>
  );
}
