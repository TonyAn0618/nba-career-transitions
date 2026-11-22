import type { SeasonRow, Translate } from "./types.ts";
import { seasonLabel } from "./analysis.ts";
import type { CareerProfile } from "./career-peers.ts";
import { pairedCareer } from "./paired-career.ts";

export interface PeerStage {
  year: number;
  target?: SeasonRow;
  peer?: SeasonRow;
}

export function missingPeerSeason(
  year: number,
  history: Pick<CareerProfile, "debutSeason" | "firstSeason" | "lastSeason">,
  t: Translate,
) {
  const first = history.firstSeason - history.debutSeason + 1;
  const last = history.lastSeason - history.debutSeason + 1;
  if (year > last)
    return t(
      `No year ${year} record · data through year ${last} (${seasonLabel(history.lastSeason)})`,
      `第${year}季无记录 · 数据截至第${last}季（${seasonLabel(history.lastSeason)}）`,
    );
  if (year < first)
    return t(
      `No year ${year} record · data starts in year ${first} (${seasonLabel(history.firstSeason)})`,
      `第${year}季无记录 · 数据始于第${first}季（${seasonLabel(history.firstSeason)}）`,
    );
  return t(
    `No regular-season record for year ${year}`,
    `第${year}季无常规赛记录`,
  );
}

/** Calendar years since each debut keep missed seasons in their actual positions. */
export function alignPeerStages(
  targetRows: readonly SeasonRow[],
  targetDebut: number,
  peerRows: readonly SeasonRow[],
  peerDebut: number,
): PeerStage[] {
  return pairedCareer(targetRows, peerRows, targetDebut, peerDebut).map(
    ({ offset, rows: [target, peer] }) => ({ year: offset + 1, target, peer }),
  );
}
