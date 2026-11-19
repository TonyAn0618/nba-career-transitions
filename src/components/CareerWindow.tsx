import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Translate } from "../lib/types";

export default function CareerWindow({
  children,
  windowKey,
  focus,
  t,
}: {
  children: ReactNode;
  windowKey: string;
  focus?: number;
  t: Translate;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useLayoutEffect(() => {
    const area = viewport.current!;
    function resize() {
      const overflowing = area.scrollWidth > area.clientWidth;
      setCanScroll(overflowing);
      if (!overflowing) return;
      const mark = area
        .querySelector(".pc-window-bracket")
        ?.getBoundingClientRect();
      if (!mark) return;
      const rect = area.getBoundingClientRect();
      const gutter =
        area.querySelector("[data-window-gutter]")?.getBoundingClientRect()
          .width ?? 0;
      const room = rect.width - gutter;
      // Keep the later selected season visible even when the interval spans several screens.
      area.scrollLeft +=
        mark.right - rect.right + Math.max(4, (room - mark.width) / 2);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(area);
    return () => observer.disconnect();
  }, [windowKey]);
  useLayoutEffect(() => {
    const area = viewport.current;
    if (!area || area.clientWidth >= area.scrollWidth || focus == null) return;
    const tick = area
      .querySelector("[data-window-focus]")
      ?.getBoundingClientRect();
    if (!tick) return;
    const rect = area.getBoundingClientRect();
    const left =
      area.querySelector("[data-window-gutter]")?.getBoundingClientRect()
        .right ?? rect.left;
    if (tick.right > rect.right - 3)
      area.scrollLeft += tick.right - rect.right + 3;
    else if (tick.left < left + 3) area.scrollLeft += tick.left - left - 3;
  }, [focus]);

  return (
    <div
      ref={viewport}
      className="pc-stacks-scroll"
      role="region"
      aria-label={t("Career seasons", "生涯赛季")}
      tabIndex={canScroll ? 0 : undefined}
    >
      {children}
    </div>
  );
}
