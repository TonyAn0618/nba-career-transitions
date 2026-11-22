import { useState } from "react";
import photoData from "../lib/player-photos.json";

interface Props {
  playerId: string;
  name: string;
  className?: string;
}

const nbaIds: Record<string, number> = photoData.players;
const bundled = new Set<string>(photoData.bundled);
const archived = new Set<string>(photoData.archived);
const unavailable = new Set<string>(photoData.unavailable);
// The current NBA headshot for Hamilton is a generic silhouette.
const archivedPortraits: Record<string, string> = {
  ...photoData.archiveOverrides,
  hamiljo02: "https://a.espncdn.com/i/headshots/nba/players/full/6436.png",
};

function Portrait({ playerId, name, className = "" }: Props) {
  const nbaId = unavailable.has(playerId) ? null : nbaIds[playerId];
  const local = bundled.has(playerId)
    ? `./players/${playerId}.png`
    : archived.has(playerId)
      ? `./players/${playerId}.jpg`
      : null;
  const remote = nbaId
    ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`
    : null;
  const reference = `https://www.basketball-reference.com/req/202106291/images/headshots/${encodeURIComponent(playerId)}.jpg`;
  const sources = [
    local,
    archivedPortraits[playerId],
    reference,
    remote,
  ].filter((source): source is string => Boolean(source));
  const [attempt, setAttempt] = useState(0);
  const source = sources[attempt];
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(part))
    .map((part) => Array.from(part)[0])
    .filter(Boolean);
  const fallback =
    initials.length > 1
      ? `${initials[0]}${initials.at(-1)}`
      : (initials[0] ?? "?");

  return (
    <span className={`player-portrait ${className}`.trim()}>
      {source ? (
        <img
          className="player-portrait__image"
          src={source}
          alt={`${name} headshot`}
          width={260}
          height={190}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setAttempt((current) => current + 1)}
        />
      ) : (
        <span
          className="player-portrait__fallback"
          role="img"
          aria-label={`${name} — photo unavailable`}
        >
          {fallback.toUpperCase()}
        </span>
      )}
    </span>
  );
}

// A new player gets fresh loading/error state immediately. A failed image for
// the previous selection must never suppress the next player's portrait.
export default function PlayerPortrait(props: Props) {
  return <Portrait key={props.playerId} {...props} />;
}
