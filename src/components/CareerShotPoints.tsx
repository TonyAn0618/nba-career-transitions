import { useEffect, useMemo, useRef } from "react";
import { courtRegionId } from "../lib/court-regions";
import { inCourt, type Shot } from "../lib/shots";

interface ShotRegion {
  made: Path2D;
  missed: Path2D;
  shots: Shot[];
}

/** Draw all career attempts in court feet; the SVG regions above this layer handle selection. */
export default function CareerShotPoints({
  shots,
  activeRegion,
  slot,
  onPoint,
}: {
  shots: Shot[];
  activeRegion: string | null;
  slot: number;
  onPoint: (point: { slot: number; shot: Shot } | null) => void;
}) {
  const layer = useRef<SVGGElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const regions = useMemo(() => {
    const groups = new Map<string, ShotRegion>();
    for (const shot of shots) {
      if (!inCourt(shot)) continue;
      const id = courtRegionId(shot);
      let region = groups.get(id);
      if (!region) {
        region = { made: new Path2D(), missed: new Path2D(), shots: [] };
        groups.set(id, region);
      }
      const [x, y, made] = shot;
      const path = made ? region.made : region.missed;
      path.moveTo(x + 0.16, y);
      path.arc(x, y, 0.16, 0, Math.PI * 2);
      region.shots.push(shot);
    }
    return groups;
  }, [shots]);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const draw = () => {
      const bounds = element.getBoundingClientRect();
      const w = Math.max(1, Math.round(bounds.width * window.devicePixelRatio));
      const h = Math.max(
        1,
        Math.round(bounds.height * window.devicePixelRatio),
      );
      if (element.width !== w) element.width = w;
      if (element.height !== h) element.height = h;
      ctx.setTransform(w / 50, 0, 0, h / 47, w / 2, 0);
      ctx.clearRect(-25, 0, 50, 47);
      ctx.strokeStyle = ctx.fillStyle = getComputedStyle(element).color;
      ctx.lineWidth = 0.09;
      for (const [id, region] of regions) {
        ctx.globalAlpha = activeRegion && activeRegion !== id ? 0.1 : 0.7;
        ctx.stroke(region.missed);
        ctx.fill(region.made);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(layer.current?.ownerSVGElement ?? element);
    return () => observer.disconnect();
  }, [regions, activeRegion]);

  useEffect(() => {
    const svg = layer.current?.ownerSVGElement;
    if (!svg) return;
    let last: Shot | null = null;
    const inspect = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const id = (event.target as SVGElement).dataset.pointRegion;
      const group = id && regions.get(id);
      const transform = layer.current?.getScreenCTM();
      let closest: Shot | null = null;
      if (group && transform) {
        const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
          transform.inverse(),
        );
        let best = 0.32 ** 2;
        for (const shot of group.shots) {
          const distance = (shot[0] - p.x) ** 2 + (shot[1] - p.y) ** 2;
          if (distance <= best) {
            best = distance;
            closest = shot;
          }
        }
      }
      if (last !== closest) {
        last = closest;
        onPoint(closest ? { slot, shot: closest } : null);
      }
    };
    const leave = () => {
      last = null;
    };
    svg.addEventListener("pointermove", inspect);
    svg.addEventListener("pointerleave", leave);
    return () => {
      svg.removeEventListener("pointermove", inspect);
      svg.removeEventListener("pointerleave", leave);
    };
  }, [regions, slot, onPoint]);

  return (
    <g ref={layer} pointerEvents="none" aria-hidden="true">
      <foreignObject x={-25} y={0} width={50} height={47}>
        <canvas
          ref={canvas}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            color: "var(--peer-shot-ink)",
          }}
        />
      </foreignObject>
    </g>
  );
}
