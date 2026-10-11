import type { CSSProperties } from "react";
import { parseTextFormat, type Segment } from "../lib/textFormat";

function Part({ part }: { part: Segment }) {
  const style: CSSProperties = { color: part.style.color, fontWeight: part.style.bold ? 750 : undefined, fontStyle: part.style.italic ? "italic" : undefined, textDecoration: [part.style.underline && "underline", part.style.strike && "line-through"].filter(Boolean).join(" ") || undefined };
  const text = part.style.obfuscated ? "█".repeat(Math.min(32, part.text.length)) : part.text;
  return <span style={style} title={part.hover ?? (part.interaction ? `${part.interaction.kind}: ${part.interaction.value}` : undefined)} className={part.interaction ? "text-interaction" : undefined}>{text}</span>;
}

export function FormattedText({ value, composer = false }: { value: string; composer?: boolean }) {
  return <>{parseTextFormat(value, { composer }).map((part, index) => <Part part={part} key={`${index}:${part.text}`} />)}</>;
}
