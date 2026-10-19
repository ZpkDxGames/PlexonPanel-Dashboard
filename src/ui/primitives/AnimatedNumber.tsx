import { useEffect, useState } from "react";
import { useSpring, useMotionValueEvent, useReducedMotion } from "motion/react";
import { usePreferences } from "../../store/preferences";
export function AnimatedNumber({ value }: { value: string | number }) {
  const p = usePreferences(),
    reduced = useReducedMotion(),
    text = String(value),
    numeric = /^-?\d+(?:\.\d+)?$/.test(text),
    number = numeric ? Number(text) : 0,
    spring = useSpring(number, { stiffness: 180, damping: 26 }),
    [shown, setShown] = useState(number);
  useMotionValueEvent(spring, "change", setShown);
  useEffect(() => {
    if (p.motion !== "full" || reduced) spring.jump(number);
    else spring.set(number);
  }, [number, p.motion, reduced, spring]);
  return (
    <>
      {!numeric
        ? text
        : p.motion !== "full" || reduced
          ? text
          : shown.toFixed(text.split(".")[1]?.length ?? 0)}
    </>
  );
}
