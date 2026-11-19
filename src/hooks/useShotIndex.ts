import { useEffect, useState } from "react";
import type { ShotIndex } from "../lib/shots";

export default function useShotIndex() {
  const [shotIndex, setShotIndex] = useState<ShotIndex | null>(null),
    [indexError, setIndexError] = useState(false),
    [indexAttempt, setIndexAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setIndexError(false);
    fetch("./data/shots/index.json", { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Unavailable");
        const result = await r.json();
        if (result.metadata?.schemaVersion !== 1 || !result.playerSeasons)
          throw new Error("Invalid index");
        setShotIndex(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setIndexError(true);
      });
    return () => ctrl.abort();
  }, [indexAttempt]);
  return {
    shotIndex,
    indexError,
    retryIndex: () => setIndexAttempt((n) => n + 1),
  };
}
