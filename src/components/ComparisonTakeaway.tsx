import { useState } from "react";
import { shortName } from "../lib/analysis";
import type { TwinFollowup } from "../lib/paired-career";
import { scoutingReading, twinPerformance } from "../lib/twin-performance";
import type { SeasonRow, Translate } from "../lib/types";

function ScoutingReading({
  result,
  action,
}: {
  result: string;
  action: string;
}) {
  const [reveal, setReveal] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const resultLength = Array.from(result).length;
  const totalLength = resultLength + Array.from(action).length;
  const step = Math.min(25, 2300 / totalLength);

  function paragraph(text: string, offset: number) {
    if (!reveal) return text;
    return (
      <>
        <span className="ct-sr">{text}</span>
        <span className="tm-reveal" aria-hidden="true">
          {Array.from(text, (char, index) => (
            <span
              key={index}
              style={{ animationDelay: `${80 + (offset + index) * step}ms` }}
              onAnimationEnd={
                offset + index === totalLength - 1
                  ? () => setReveal(false)
                  : undefined
              }
            >
              {char}
            </span>
          ))}
        </span>
      </>
    );
  }

  return (
    <>
      <p className="tm-outlook">{paragraph(result, 0)}</p>
      <p className="tm-diagnosis">{paragraph(action, resultLength)}</p>
    </>
  );
}

export default function ComparisonTakeaway({
  pairs,
  band,
  followup,
  t,
}: {
  pairs: [SeasonRow, SeasonRow][];
  band: number;
  followup: TwinFollowup;
  t: Translate;
}) {
  const names = pairs.map(([, end]) => shortName(end.name));
  const labels =
    names[0] === names[1] ? pairs.map(([, end]) => end.name) : names;
  const zones = [
    t("at the rim", "篮下"),
    t("in the short paint", "近筐两分"),
    t("from mid-range", "中距离两分"),
    t("on long twos", "长两分"),
    t("from three", "三分"),
  ];
  const [target, peer] = pairs;
  const performance = twinPerformance(
    peer[0],
    peer[1],
    followup.map((stage) => stage[1]),
  );
  const { result, action } = scoutingReading(
    target,
    peer,
    labels,
    band,
    zones[band],
    performance,
    t,
  );
  return (
    <section className="tm-takeaway" aria-labelledby="takeaway-heading">
      <h2 id="takeaway-heading">{t("Scouting recommendation", "球探建议")}</h2>
      <div className="tm-reading" aria-live="polite" aria-atomic="true">
        <ScoutingReading
          key={JSON.stringify([result, action])}
          result={result}
          action={action}
        />
      </div>
    </section>
  );
}
