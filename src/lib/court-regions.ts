import type { Shot } from "./shots.ts";

type Point = [number, number];
type RegionName = [english: string, chinese: string];

export interface CourtRegion {
  id: string;
  name: RegionName;
  path: string;
  label: Point;
}

const hoopY = 5.25;
const rimRadius = 8.5;
const nearRadius = 16;
const threeRadius = 23.75;
const cornerX = 22;
const cornerEndY = 7.2;
const nearCenterAngle = 27;
const midCenterAngle = 22;
const midWingAngle = 58;
const topThreeAngle = 17;
const rad = Math.PI / 180;
const threeBendAngle = Math.asin(cornerX / threeRadius) / rad;
const threeBendY = hoopY + Math.sqrt(threeRadius ** 2 - cornerX ** 2);
const halfLength = 47;
const outerTopX = (halfLength - hoopY) * Math.tan(topThreeAngle * rad);

function polar(radius: number, angle: number): Point {
  return [
    radius * Math.sin(angle * rad),
    hoopY + radius * Math.cos(angle * rad),
  ];
}

function coords([x, y]: Point) {
  return `${+x.toFixed(5)},${+y.toFixed(5)}`;
}

// Angles start on the line from the hoop toward midcourt and increase to screen right.
function edge(radius: number, angle: number): Point {
  if (radius === threeRadius && Math.abs(angle) >= threeBendAngle) {
    return [
      Math.sign(angle) * cornerX,
      Number.isFinite(angle)
        ? Math.max(0, hoopY + cornerX / Math.tan(Math.abs(angle) * rad))
        : 0,
    ];
  }
  const limit = Math.acos(-hoopY / radius) / rad;
  return polar(radius, Math.max(-limit, Math.min(limit, angle)));
}

function arc(radius: number, start: number, end: number, endpoint: Point) {
  return `A${radius},${radius} 0 ${Math.abs(end - start) > 180 ? 1 : 0} ${end > start ? 0 : 1} ${coords(endpoint)}`;
}

function ringSector(inner: number, outer: number, low: number, high: number) {
  // Close the outer baseline sectors along the straight corner-three line.
  const outerLimit =
    outer === threeRadius ? threeBendAngle : Math.acos(-hoopY / outer) / rad;
  const start = Math.max(low, -outerLimit);
  const end = Math.min(high, outerLimit);
  const path = [`M${coords(edge(outer, low))}`];
  if (outer === threeRadius && start !== low)
    path.push(`L${coords(edge(outer, start))}`);
  path.push(arc(outer, start, end, edge(outer, end)));
  if (outer === threeRadius && end !== high)
    path.push(`L${coords(edge(outer, high))}`);
  path.push(`L${coords(edge(inner, high))}`);
  const innerLimit = Math.acos(-hoopY / inner) / rad;
  path.push(
    arc(
      inner,
      Math.min(high, innerLimit),
      Math.max(low, -innerLimit),
      edge(inner, low),
    ),
  );
  return path.join(" ") + " Z";
}

function threeWing(side: -1 | 1) {
  return [
    `M${coords([side * cornerX, cornerEndY])}`,
    `H${side * 25}`,
    `V${halfLength}`,
    `H${side * outerTopX}`,
    `L${coords(polar(threeRadius, side * topThreeAngle))}`,
    arc(threeRadius, side * topThreeAngle, side * threeBendAngle, [
      side * cornerX,
      threeBendY,
    ]),
    "Z",
  ].join(" ");
}

type Sector = {
  id: string;
  name: RegionName;
  label: Point;
  low: number;
  high: number;
};
const near: Sector[] = [
  {
    id: "near-left",
    name: ["Left short two", "图左近两分"],
    label: [-11.2, 9],
    low: -Infinity,
    high: -nearCenterAngle,
  },
  {
    id: "near-center",
    name: ["Center short two", "正面近两分"],
    label: [0, 17.4],
    low: -nearCenterAngle,
    high: nearCenterAngle,
  },
  {
    id: "near-right",
    name: ["Right short two", "图右近两分"],
    label: [11.2, 9],
    low: nearCenterAngle,
    high: Infinity,
  },
];
const mid: Sector[] = [
  {
    id: "mid-left-baseline",
    name: ["Left baseline two", "图左底线两分"],
    label: [-19, 8],
    low: -Infinity,
    high: -midWingAngle,
  },
  {
    id: "mid-left-wing",
    name: ["Left wing two", "图左侧翼两分"],
    label: polar(20, -40),
    low: -midWingAngle,
    high: -midCenterAngle,
  },
  {
    id: "mid-center",
    name: ["Center long two", "正面长两分"],
    label: polar(20, 0),
    low: -midCenterAngle,
    high: midCenterAngle,
  },
  {
    id: "mid-right-wing",
    name: ["Right wing two", "图右侧翼两分"],
    label: polar(20, 40),
    low: midCenterAngle,
    high: midWingAngle,
  },
  {
    id: "mid-right-baseline",
    name: ["Right baseline two", "图右底线两分"],
    label: [19, 8],
    low: midWingAngle,
    high: Infinity,
  },
];
const rimHalfAngle = Math.acos(-hoopY / rimRadius) / rad;
export const courtRegions: CourtRegion[] = [
  {
    id: "rim",
    name: ["At the basket", "篮下"],
    label: [0, 10.6],
    path: `M${coords(edge(rimRadius, -Infinity))} ${arc(rimRadius, -rimHalfAngle, rimHalfAngle, edge(rimRadius, Infinity))} Z`,
  },
  ...near.map((r) => ({
    ...r,
    path: ringSector(rimRadius, nearRadius, r.low, r.high),
  })),
  ...mid.map((r) => ({
    ...r,
    path: ringSector(nearRadius, threeRadius, r.low, r.high),
  })),
  {
    id: "three-left-corner",
    name: ["Left corner three", "图左底角三分"],
    label: [-23.5, 3.6],
    path: `M-25,0 H-${cornerX} V${cornerEndY} H-25 Z`,
  },
  {
    id: "three-left-wing",
    name: ["Left wing three", "图左侧翼三分"],
    label: [-17.8, 32],
    path: threeWing(-1),
  },
  {
    id: "three-top",
    name: ["Top three", "弧顶三分"],
    label: [0, 35],
    path: `M${coords(polar(threeRadius, -topThreeAngle))} ${arc(threeRadius, -topThreeAngle, topThreeAngle, polar(threeRadius, topThreeAngle))} L${coords([outerTopX, halfLength])} H${-outerTopX} Z`,
  },
  {
    id: "three-right-wing",
    name: ["Right wing three", "图右侧翼三分"],
    label: [17.8, 32],
    path: threeWing(1),
  },
  {
    id: "three-right-corner",
    name: ["Right corner three", "图右底角三分"],
    label: [23.5, 3.6],
    path: `M${cornerX},0 H25 V${cornerEndY} H${cornerX} Z`,
  },
  {
    id: "backcourt",
    name: ["Backcourt", "后场"],
    label: [0, 69],
    path: "M-25,47 H25 V94 H-25 Z",
  },
];

export function courtRegionId(shot: Shot): string {
  const [x, y, , points] = shot;
  if (y > halfLength) return "backcourt";
  const angle = Math.atan2(x, y - hoopY) / rad;
  // Recorded point value resolves coordinate rounding near the three-point line.
  if (points === 3) {
    if (y <= cornerEndY)
      return x < 0 ? "three-left-corner" : "three-right-corner";
    if (Math.abs(angle) <= topThreeAngle) return "three-top";
    return x < 0 ? "three-left-wing" : "three-right-wing";
  }
  const distance = Math.hypot(x, y - hoopY);
  if (distance < rimRadius) return "rim";
  const sectors = distance < nearRadius ? near : mid;
  return sectors.find((s) => angle <= s.high)!.id;
}

export interface CourtRegionStat {
  attempts: number;
  made: number;
  share: number | null;
  fg: number | null;
}

export function courtRegionStats(shots: Shot[]): Map<string, CourtRegionStat> {
  const stats = new Map<string, CourtRegionStat>(
    courtRegions.map(({ id }) => [
      id,
      { attempts: 0, made: 0, share: null, fg: null },
    ]),
  );
  for (const shot of shots) {
    const region = stats.get(courtRegionId(shot))!;
    region.attempts++;
    region.made += shot[2];
  }
  for (const region of stats.values()) {
    region.share = shots.length ? region.attempts / shots.length : null;
    region.fg = region.attempts ? region.made / region.attempts : null;
  }
  return stats;
}
