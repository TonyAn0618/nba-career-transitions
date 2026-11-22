import { useMemo } from "react";
import useShotIndex from "../hooks/useShotIndex";
import { missingPeerSeason, type PeerStage } from "../lib/peer-stages";
import type { CareerProfile } from "../lib/career-peers";
import type { SeasonRow, Translate } from "../lib/types";
import LocationCourts, { type CourtSeason } from "./LocationCourts";
import "./peer-shot-courts.css";

export default function CareerCourts({
  first,
  second,
  careerYear,
  careerRows,
  zone = null,
  onClearZone,
  t,
}: {
  first: CourtSeason;
  second: CourtSeason;
  careerYear?: number;
  careerRows?: readonly [readonly SeasonRow[], readonly SeasonRow[]];
  zone?: number | null;
  onClearZone?: () => void;
  t: Translate;
}) {
  const { shotIndex, indexError, retryIndex } = useShotIndex();
  const seasons = useMemo(() => [first, second], [first, second]);
  return (
    <div
      id={careerYear != null || careerRows ? "peer-shot-courts" : undefined}
      className="peer-shot-courts"
    >
      <LocationCourts
        selected={seasons}
        careerYear={careerYear}
        careerRows={careerRows}
        seasonComparison={careerYear == null && !careerRows}
        initialMode="accuracy"
        index={shotIndex}
        indexError={indexError}
        onRetryIndex={retryIndex}
        zone={zone}
        onClearZone={onClearZone}
        hoverZone={null}
        focus={null}
        t={t}
      />
    </div>
  );
}

export function PeerStageCourts({
  stage,
  totals,
  anchor,
  baseline,
  careers,
  t,
}: {
  stage: PeerStage | null;
  totals: { target: CareerProfile; peer: CareerProfile };
  anchor: SeasonRow;
  baseline: SeasonRow;
  careers: readonly [readonly SeasonRow[], readonly SeasonRow[]];
  t: Translate;
}) {
  function season(side: "target" | "peer", match: SeasonRow): CourtSeason {
    if (!stage) return match;
    return (
      stage[side] ?? {
        playerId: match.playerId,
        name: match.name,
        missing: "peer-stage",
        detail: missingPeerSeason(stage.year, totals[side], t),
      }
    );
  }
  return (
    <CareerCourts
      first={season("target", anchor)}
      second={season("peer", baseline)}
      careerYear={stage?.year}
      careerRows={stage ? undefined : careers}
      t={t}
    />
  );
}
