import { useEffect, useState, type RefObject } from "react";
export function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 1000, h: 100 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setSize((old) =>
        old.w === e.contentRect.width && old.h === e.contentRect.height
          ? old
          : { w: e.contentRect.width, h: e.contentRect.height },
      ),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
