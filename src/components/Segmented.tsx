import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
/** Prototype thumb geometry is measured once per selection or container resize. */
export function Segmented({
  label,
  value,
  children,
}: {
  label: string;
  value: string | number;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 4, width: 0, top: 4, height: 35 });
  useLayoutEffect(() => {
    const measure = () => {
      const selected = root.current?.querySelector<HTMLElement>(".active");
      if (selected)
        setThumb({
          left: selected.offsetLeft,
          width: selected.offsetWidth,
          top: selected.offsetTop,
          height: selected.offsetHeight,
        });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [value]);
  return (
    <div ref={root} className="segmented" role="group" aria-label={label}>
      <span
        className="thumb"
        aria-hidden="true"
        style={{
          top: thumb.top,
          height: thumb.height,
          width: thumb.width,
          transform: `translateX(${thumb.left}px)`,
        }}
      />
      {children}
    </div>
  );
}
