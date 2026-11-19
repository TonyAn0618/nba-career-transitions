import { matchedFollowup } from "./transition-matches.ts";
import type { SeasonRow } from "./types.ts";

/** One column per season across both recorded careers. Matched intervals have the same ages. */
export function pairedCareer(
  anchor: SeasonRow[],
  peer: SeasonRow[],
  anchorEnd: number,
  peerEnd: number,
) {
  const sides = [anchor, peer];
  const years = [anchorEnd, peerEnd];
  const lookups = sides.map(
    (rows, i) => new Map(rows.map((row) => [row.season - years[i], row])),
  );
  const offsets = [...lookups[0].keys(), ...lookups[1].keys()];
  const first = Math.min(...offsets),
    last = Math.max(...offsets);
  const bounds = lookups.map((lookup) => [
    Math.min(...lookup.keys()),
    Math.max(...lookup.keys()),
  ]);
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const offset = first + i;
    return {
      offset,
      rows: [lookups[0].get(offset), lookups[1].get(offset)] as const,
      years: bounds.map(([from, to], i) =>
        offset >= from && offset <= to ? years[i] + offset : null,
      ),
    };
  });
}

export function pairedFollowup(
  anchor: SeasonRow,
  anchorRows: SeasonRow[],
  peer: SeasonRow,
  peerRows: SeasonRow[],
  lastSeason: number,
) {
  const primary = matchedFollowup(anchor, anchorRows, lastSeason);
  const historical = matchedFollowup(peer, peerRows, anchor.season);
  return primary.map((record, i) => [record, historical[i]] as const);
}
export type TwinFollowup = ReturnType<typeof pairedFollowup>;
