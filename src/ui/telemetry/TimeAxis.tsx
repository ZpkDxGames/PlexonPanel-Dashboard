import { useRef, useMemo } from "react";
import { PLOT } from "./Stage";
import { useSize } from "./hooks";
import { buildTimeTicks } from "../chart/scales";
import { time, usePrefs } from "../bindings";
export function TimeAxis({ domainT }: { domainT: [number, number] }) {
  const ref = useRef<HTMLDivElement>(null),
    { w } = useSize(ref),
    prefs = usePrefs(),
    ticks = useMemo(
      () =>
        buildTimeTicks(
          ...domainT,
          (at, seconds) => time(at, prefs.timezone, seconds),
          w < 500 ? 3 : 7,
        ),
      [domainT, prefs.timezone, w],
    );
  return (
    <div className="pp-axis" ref={ref} aria-hidden="true">
      {ticks.ticks.map((t) => (
        <span
          key={t}
          style={{
            left:
              PLOT.l +
              ((t - domainT[0]) / Math.max(1, domainT[1] - domainT[0])) *
                Math.max(1, w - PLOT.l - PLOT.r),
          }}
        >
          {time(t, prefs.timezone, ticks.withSeconds)}
        </span>
      ))}
    </div>
  );
}
