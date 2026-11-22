import type { SVGProps } from "react";
import { seasonLabel } from "../lib/analysis";
import type { SeasonRow, Translate } from "../lib/types";

export interface RingSelection {
  ages: number[];
  byAge: ReadonlyMap<number, SeasonRow>;
  selected: SeasonRow;
  pinned: boolean;
  onPreview: (row: SeasonRow) => void;
  onPin: (row: SeasonRow) => void;
  t: Translate;
}

export function ringKeyboardProps({
  ages,
  byAge,
  selected,
  pinned,
  onPreview,
  onPin,
  t,
}: RingSelection): SVGProps<SVGSVGElement> {
  if (!ages.length || selected.age == null) return { role: "img" };
  const season = seasonLabel(selected.season);
  return {
    role: "slider",
    tabIndex: 0,
    "aria-valuemin": ages[0],
    "aria-valuemax": ages[ages.length - 1],
    "aria-valuenow": selected.age,
    "aria-valuetext":
      t(`Age ${selected.age}, ${season}`, `${selected.age} 岁，${season}`) +
      (pinned ? t(", pinned", "，已锁定") : ""),
    "aria-keyshortcuts":
      "ArrowLeft ArrowRight ArrowDown ArrowUp Home End Enter Space Escape",
    onKeyDown(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) onPin(selected);
        return;
      }
      // Interior ages can be missing when a player sat out a season.
      const observed = ages.filter((age) => byAge.has(age));
      const index = observed.indexOf(selected.age!);
      let next: number;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = index + 1;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = index - 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = observed.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      const row = byAge.get(observed[next]);
      if (row && row.id !== selected.id) (pinned ? onPin : onPreview)(row);
    },
  };
}
