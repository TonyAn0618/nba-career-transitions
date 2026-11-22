import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Player, Translate } from "../lib/types";

const popular = [
  "curryst01",
  "jamesle01",
  "jokicni01",
  "antetgi01",
  "doncilu01",
  "tatumja01",
  "duranke01",
  "bryanko01",
  "onealsh01",
  "jordami01",
  "allenra02",
  "lopezbr01",
  "derozde01",
  "westbru01",
  "edwaran01",
];
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function PlayerPicker({
  players,
  prioritizePopular = true,
  triggerText,
  value,
  onChange,
  label,
  t,
}: {
  players: (Player & { description?: string })[];
  prioritizePopular?: boolean;
  triggerText?: string;
  value: string;
  onChange: (id: string) => void;
  label: string;
  t: Translate;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const player = players.find((p) => p.id === value);
  const filtered = query
    ? players
        .filter((p) => normalize(p.name).includes(normalize(query)))
        .slice(0, 30)
    : !prioritizePopular
      ? players
      : [
          ...players
            .filter((p) => popular.includes(p.id))
            .sort((a, b) => popular.indexOf(a.id) - popular.indexOf(b.id)),
          ...players.filter((p) => !popular.includes(p.id)).slice(0, 8),
        ];
  useEffect(() => {
    if (open) input.current?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      root.current
        ?.querySelector(".picker-option.active")
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
    setActive(0);
    root.current?.querySelector("button")?.focus();
  }
  return (
    <div className="player-picker" ref={root}>
      <button
        className="player-picker-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
      >
        <span>
          {triggerText ?? player?.name ?? t("Choose a player", "选择球员")}
        </span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div className="picker-popover">
          <div className="picker-search">
            <Search size={17} />
            <input
              ref={input}
              value={query}
              aria-label={t("Search players", "搜索球员")}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                filtered[active]
                  ? listId + "-" + filtered[active].id
                  : undefined
              }
              placeholder={t("Search by name…", "输入球员英文姓名…")}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  root.current?.querySelector("button")?.focus();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(Math.min(active + 1, filtered.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(0, active - 1));
                }
                if (e.key === "Enter" && filtered[active]) {
                  e.preventDefault();
                  select(filtered[active].id);
                }
              }}
            />
          </div>
          <div
            className="picker-list"
            role="listbox"
            id={listId}
            aria-label={label}
          >
            {!filtered.length && (
              <p className="empty-search">
                {t("No players found.", "未找到球员。")}
              </p>
            )}
            {filtered.map((p, i) => (
              <button
                type="button"
                role="option"
                id={listId + "-" + p.id}
                aria-selected={value === p.id}
                className={
                  i === active ? "picker-option active" : "picker-option"
                }
                key={p.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(p.id)}
              >
                <span>
                  {p.name}
                  <small>{p.description ?? `${p.first - 1}–${p.last}`}</small>
                </span>
                {p.id === value && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
