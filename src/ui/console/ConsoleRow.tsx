import { memo } from "react";
import { PluginChip } from "./PluginChip";
import type { ParsedLine, Token } from "./parse-line";
const render = (body: Token[]) =>
  body.map((t, i) =>
    t.t === "url" ? (
      <a
        key={i}
        href={t.v}
        target="_blank"
        rel="noreferrer noopener"
        className="tone-link"
      >
        {t.v}
      </a>
    ) : (
      <span key={i}>{t.v}</span>
    ),
  );
export const ConsoleRow = memo(function ConsoleRow({
  line,
  prev,
}: {
  line: ParsedLine;
  prev?: ParsedLine;
}) {
  if (line.kind === "continuation")
    return (
      <div className="console-continuation mono">
        <i />
        <span>{render(line.body)}</span>
      </div>
    );
  const same = line.time === prev?.time,
    tone =
      line.level === "WARN"
        ? "amber"
        : ["ERROR", "FATAL"].includes(line.level ?? "")
          ? "rose"
          : line.level === "INFO"
            ? "cyan"
            : "slate";
  return (
    <div className="console-row mono" data-level={line.level}>
      <time title={line.time ?? undefined}>
        {same ? "·" : (line.time ?? "—")}
      </time>
      <span data-tone={tone} className="severity">
        {line.level}
      </span>
      <span>
        {line.tag ? (
          <PluginChip tag={line.tag} />
        ) : (
          <span className="thread-chip">
            {line.thread?.replace(" thread", "") ?? "Server"}
          </span>
        )}
      </span>
      <span data-slot="message" className="console-message">
        {render(line.body)}
      </span>
    </div>
  );
});
