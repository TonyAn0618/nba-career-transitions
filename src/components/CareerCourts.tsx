import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { seasonLabel } from "../lib/analysis";
import type { SeasonRow, Translate } from "../lib/types";
import useShotIndex from "../hooks/useShotIndex";
import LocationCourts from "./LocationCourts";

type Props = {
  compareYear?: number;
  onCompareYear: (year: number) => void;
  rows: SeasonRow[];
  selected: SeasonRow;
  zone: number | null;
  onZone: (z: number | null) => void;
  t: Translate;
};

function CourtComparison({
  rows,
  selected,
  zone,
  onZone,
  t,
  compareYear,
  onCompareYear,
}: Props) {
  const { shotIndex, indexError, retryIndex } = useShotIndex();
  const base = rows.find((r) => r.season === compareYear) ?? rows[0];
  const pair = useMemo(
    () => (base === selected ? [selected] : [base, selected]),
    [base, selected],
  );
  return (
    <div className="at-court-content">
      <label>
        {t("Comparison season", "对照赛季")}{" "}
        <select
          value={base.season}
          disabled={rows.length < 2}
          onChange={(e) => onCompareYear(Number(e.target.value))}
        >
          {rows
            .filter((r) => r !== selected || rows.length === 1)
            .map((r) => (
              <option value={r.season} key={r.id}>
                {r.age} {t("yr", "岁")} · {seasonLabel(r.season)}
              </option>
            ))}
        </select>
      </label>
      <LocationCourts
        initialMode="frequency"
        selected={pair}
        index={shotIndex}
        indexError={indexError}
        onRetryIndex={retryIndex}
        zone={zone}
        hoverZone={null}
        onClearZone={() => onZone(null)}
        focus={null}
        t={t}
      />
    </div>
  );
}
export default function CareerCourts(props: Props) {
  const [open, setOpen] = useState(false);
  const { t } = props;
  return (
    <details
      className="at-court-details"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <div>
          <strong>{t("Compare shot locations", "逐球位置对照")}</strong>
          <small>
            {t(
              "Recorded shots on aligned courts · 2003–04 to 2024–25",
              "同尺度球场上的真实出手 · 2003–04 至 2024–25",
            )}
          </small>
        </div>
        <ChevronDown size={19} />
      </summary>
      {open && <CourtComparison {...props} />}
    </details>
  );
}
