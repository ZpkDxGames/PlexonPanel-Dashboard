"use client";
import {
  cloneElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
export function Tooltip({
  children,
  content,
  side = "bottom",
}: {
  children: ReactElement<Record<string, unknown>>;
  content: ReactNode;
  side?: "bottom" | "right" | "top";
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null),
    id = useId();
  const show = (event: { currentTarget: HTMLElement }) =>
    setAnchor(event.currentTarget.getBoundingClientRect());
  return (
    <>
      {cloneElement(children, {
        "aria-describedby": anchor ? id : undefined,
        onFocus: (e: React.FocusEvent<HTMLElement>) => {
          (children.props.onFocus as ((e: unknown) => void) | undefined)?.(e);
          show(e);
        },
        onBlur: () => setAnchor(null),
        onMouseEnter: show,
        onMouseLeave: () => setAnchor(null),
        onKeyDown: (e: React.KeyboardEvent) => {
          (children.props.onKeyDown as ((e: unknown) => void) | undefined)?.(e);
          if (e.key === "Escape") setAnchor(null);
        },
      })}
      {anchor &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="pp-glass pp-tooltip"
            style={{
              left: Math.max(
                8,
                Math.min(
                  innerWidth - 308,
                  side === "right" ? anchor.right + 10 : anchor.left,
                ),
              ),
              top:
                side === "top"
                  ? undefined
                  : Math.min(
                      innerHeight - 140,
                      side === "right" ? anchor.top : anchor.bottom + 8,
                    ),
              bottom: side === "top" ? innerHeight - anchor.top + 8 : undefined,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
