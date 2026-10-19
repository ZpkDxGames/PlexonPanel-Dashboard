import { parseTextFormat, plainText } from "../bindings/pure";
import type { ParsedLine } from "./parse-line";
/** Slice the formatter's text spans using the parser's canonical body offset. */
export function richBody(raw: string | undefined, line: ParsedLine) {
  const body = line.body.map((t) => t.v).join("");
  if (!raw) return parseTextFormat(body);
  const spans = parseTextFormat(raw),
    flat = plainText(spans),
    start = flat.lastIndexOf(body);
  if (start < 0) return parseTextFormat(body);
  let offset = 0;
  return spans.flatMap((span) => {
    const a = Math.max(0, start - offset),
      b = Math.min(span.text.length, start + body.length - offset);
    offset += span.text.length;
    return b > a ? [{ ...span, text: span.text.slice(a, b) }] : [];
  });
}
const luminance = (rgb: number[]) =>
  rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
/** Preserve Minecraft hues while meeting AA against the console's light/dark well. */
export function readableColor(color: string | undefined, light: boolean) {
  if (!color) return undefined;
  let rgb: number[];
  if (/^#[0-9a-f]{6}$/i.test(color))
    rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  else {
    const m = color.match(/^rgb\((\d+) (\d+) (\d+)\)$/);
    if (!m) return undefined;
    rgb = m.slice(1).map(Number);
  }
  const bg = luminance(light ? [232, 238, 241] : [13, 20, 24]);
  for (let i = 0; i < 30; i++) {
    const fg = luminance(rgb),
      contrast = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    if (contrast >= 4.7) break;
    rgb = rgb.map((v) =>
      light
        ? Math.floor(v * 0.88)
        : Math.min(255, Math.ceil(v + (255 - v) * 0.12)),
    );
  }
  return `rgb(${rgb.join(" ")})`;
}
