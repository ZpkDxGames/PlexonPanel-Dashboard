import { memo } from "react";
import { usePrefs } from "../bindings";
import { chipTone, tokenize, type ParsedLine } from "./parse-line";
import { richBody, readableColor } from "./rich-body";
import { softBreak, stripSoftBreaks } from "./softBreak";
export const PluginChip = ({ name }: { name: string }) => (
  <span className="pp-chip" data-tone={chipTone(name)}>
    {name}
  </span>
);
export const ConsoleRow = memo(function ConsoleRow({
  line,
  mode,
}: {
  line: ParsedLine & { rawText?: string; iso?: string };
  mode: "compact" | "full";
}) {
  const p = usePrefs(),
    continuation = line.kind === "continuation",
    severity = ["ERROR", "FATAL"].includes(line.level ?? "")
      ? "error"
      : line.level === "WARN"
        ? "warn"
        : "info",
    tag = line.tag && line.tag !== "Server" ? line.tag : null;
  return (
    <div
      className="pp-crow"
      data-sev={severity}
      data-row-id={line.id}
      onCopy={(e) => {
        const selected = window.getSelection()?.toString();
        if (selected) {
          e.clipboardData.setData("text/plain", stripSoftBreaks(selected));
          e.preventDefault();
        }
      }}
    >
      <time
        dateTime={line.iso}
        className="pp-crow__t"
        aria-label={p.timezone === "UTC" ? "UTC time" : "Local time"}
      >
        {continuation ? "" : line.time}
      </time>
      <span className="pp-crow__sev">
        {continuation ? null : mode === "compact" ? (
          <i
            className="pp-dot"
            data-tone={
              severity === "info"
                ? undefined
                : severity === "warn"
                  ? "amber"
                  : "rose"
            }
          />
        ) : (
          <span
            data-tone={
              severity === "warn"
                ? "amber"
                : severity === "error"
                  ? "rose"
                  : undefined
            }
            className={severity !== "info" ? "tone" : undefined}
          >
            {line.level ?? "INFO"}
          </span>
        )}
      </span>
      <span
        className="pp-crow__msg"
        style={
          continuation
            ? { paddingLeft: 12, color: "rgb(var(--muted))" }
            : undefined
        }
      >
        {tag && <PluginChip name={tag} />}
        {richBody(line.rawText, line).map((part, i) => (
          <span
            key={i}
            style={{
              color:
                severity === "info"
                  ? readableColor(
                      part.style.color,
                      p.theme === "light" ||
                        (p.theme === "system" &&
                          typeof matchMedia === "function" &&
                          matchMedia("(prefers-color-scheme: light)").matches),
                    )
                  : undefined,
              fontWeight: part.style.bold ? 700 : undefined,
              fontStyle: part.style.italic ? "italic" : undefined,
              textDecoration: part.style.underline
                ? "underline"
                : part.style.strike
                  ? "line-through"
                  : undefined,
            }}
          >
            {tokenize(part.text).map((token, j) =>
              token.t === "url" ? (
                <a
                  key={j}
                  href={token.v}
                  target="_blank"
                  rel="noreferrer"
                  className="tone"
                  data-tone="cyan"
                >
                  {softBreak(token.v)}
                </a>
              ) : (
                <span key={j}>{softBreak(token.v)}</span>
              ),
            )}
          </span>
        ))}
      </span>
    </div>
  );
});
