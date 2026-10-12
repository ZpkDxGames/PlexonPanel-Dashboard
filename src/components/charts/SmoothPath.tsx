import { useLayoutEffect, useRef, type RefObject, type SVGProps } from "react";
import { prefersReducedMotion } from "../../lib/motion";

/** Morph actual geometry; interrupted updates continue from the visible path. */
export function SmoothPath({
  d = "",
  endpoint,
  durationMs = 150,
  ...props
}: SVGProps<SVGPathElement> & {
  endpoint?: RefObject<SVGGElement | null>;
  durationMs?: number;
}) {
  const node = useRef<SVGPathElement>(null);
  const visible = useRef("");
  useLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    const from = visible.current;
    const numbers = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;
    const a = (from.match(numbers) ?? []).map(Number);
    const b = (d.match(numbers) ?? []).map(Number);
    let frame = 0;
    const point = (x: number, y: number) =>
      endpoint?.current?.querySelectorAll("circle").forEach((c) => {
        c.setAttribute("cx", String(x));
        c.setAttribute("cy", String(y));
      });
    if (
      !from ||
      prefersReducedMotion() ||
      a.length !== b.length ||
      from.replace(numbers, "#") !== d.replace(numbers, "#")
    ) {
      visible.current = d;
      el.setAttribute("d", d);
      point(b.at(-2)!, b.at(-1)!);
      return;
    }
    const started = performance.now();
    const tick = (at: number) => {
      const t = Math.min(1, (at - started) / Math.max(80, durationMs));
      const eased = t * (2 - t);
      let i = 0;
      const path = d.replace(numbers, () => {
        const n = a[i] + (b[i] - a[i]) * eased;
        i++;
        return n.toFixed(2);
      });
      visible.current = path;
      el.setAttribute("d", path);
      point(
        a.at(-2)! + (b.at(-2)! - a.at(-2)!) * eased,
        a.at(-1)! + (b.at(-1)! - a.at(-1)!) * eased,
      );
      if (t < 1) frame = requestAnimationFrame(tick);
      else visible.current = d;
    };
    el.setAttribute("d", from);
    point(a.at(-2)!, a.at(-1)!);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [d, durationMs]);
  return <path ref={node} d={d} {...props} />;
}
