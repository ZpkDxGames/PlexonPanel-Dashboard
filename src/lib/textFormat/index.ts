export type TextStyle = { color?: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; obfuscated?: boolean };
export type Segment = { text: string; style: TextStyle; hover?: string; interaction?: { kind: "open_url" | "suggest_command" | "run_command"; value: string } };

const named: Record<string, string> = {
  black: "#70757d", dark_blue: "#5555aa", dark_green: "#00aa00", dark_aqua: "#00aaaa", dark_red: "#aa0000", dark_purple: "#aa00aa", gold: "#ffaa00", gray: "#aaaaaa",
  dark_gray: "#555555", blue: "#5555ff", green: "#55ff55", aqua: "#55ffff", red: "#ff5555", light_purple: "#ff55ff", yellow: "#ffff55", white: "#f5f7f8",
};
const legacy = ["#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#ffaa00", "#aaaaaa", "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff"];
const ansi16 = ["#70757d", "#aa0000", "#00aa00", "#ffaa00", "#5555aa", "#aa00aa", "#00aaaa", "#d7d7d7", "#555555", "#ff5555", "#55ff55", "#ffff55", "#5555ff", "#ff55ff", "#55ffff", "#ffffff"];

function safeColor(value: string) {
  const candidate = named[value.toLowerCase()] ?? value;
  if (!/^#[0-9a-f]{6}$/i.test(candidate)) return undefined;
  return candidate.toLowerCase() === "#000000" ? "#70757d" : candidate;
}

function clone(style: TextStyle): TextStyle { return { ...style }; }

export function parseTextFormat(input: string, options: { composer?: boolean } = {}): Segment[] {
  const text = input.slice(0, 20000);
  const result: Segment[] = [];
  let style: TextStyle = {}, buffer = "", hover: string | undefined, interaction: Segment["interaction"], tags = 0;
  const stack: { name: string; style: TextStyle; hover?: string; interaction?: Segment["interaction"] }[] = [];
  const flush = () => { if (buffer) { result.push({ text: buffer, style: clone(style), ...(hover ? { hover } : {}), ...(interaction ? { interaction } : {}) }); buffer = ""; } };
  const reset = () => { flush(); style = {}; hover = undefined; interaction = undefined; stack.length = 0; };
  const applyAnsi = (raw: string) => {
    flush(); const codes = raw ? raw.split(";").map(Number) : [0];
    for (let p = 0; p < codes.length; p++) {
      const code = codes[p];
      if (code === 0) style = {};
      else if (code === 1) style.bold = true; else if (code === 3) style.italic = true; else if (code === 4) style.underline = true; else if (code === 9) style.strike = true;
      else if (code === 22) style.bold = false; else if (code === 23) style.italic = false; else if (code === 24) style.underline = false; else if (code === 29) style.strike = false;
      else if (code >= 30 && code <= 37) style.color = ansi16[code - 30]; else if (code >= 90 && code <= 97) style.color = ansi16[8 + code - 90]; else if (code === 39) delete style.color;
      else if (code === 38 && codes[p + 1] === 5 && Number.isInteger(codes[p + 2])) { const n = Math.max(0, Math.min(255, codes[p + 2])); style.color = n < 16 ? ansi16[n] : n < 232 ? `rgb(${Math.floor((n-16)/36)%6*51} ${(Math.floor((n-16)/6)%6)*51} ${(n-16)%6*51})` : `rgb(${8+(n-232)*10} ${8+(n-232)*10} ${8+(n-232)*10})`; p += 2; }
      else if (code === 38 && codes[p + 1] === 2 && codes.slice(p + 2, p + 5).every(Number.isFinite)) { style.color = `rgb(${codes[p+2]} ${codes[p+3]} ${codes[p+4]})`; p += 4; }
    }
  };
  for (let i = 0; i < text.length;) {
    const ansi = text.slice(i).match(/^\x1b\[([0-9;]*)m/);
    if (ansi) { applyAnsi(ansi[1]); i += ansi[0].length; continue; }
    const prefix = text[i] === "§" || (options.composer && text[i] === "&") ? text[i] : "";
    if (prefix && i + 1 < text.length) {
      const code = text[i + 1].toLowerCase();
      if (options.composer && prefix === "&" && code === "#" && /^#[0-9a-f]{6}/i.test(text.slice(i + 1, i + 8))) { flush(); style.color = safeColor(text.slice(i + 1, i + 8)); i += 8; continue; }
      if (code === "x") {
        const part = text.slice(i, i + 14); const expression = new RegExp(`^\\${prefix}x(?:\\${prefix}[0-9a-f]){6}$`, "i");
        if (expression.test(part)) { flush(); style.color = safeColor(`#${part.replace(new RegExp(`\\${prefix}`, "g"), "").slice(1)}`); i += 14; continue; }
      }
      const index = "0123456789abcdef".indexOf(code);
      if (index >= 0) { flush(); style.color = safeColor(legacy[index]); i += 2; continue; }
      if ("klmnor".includes(code)) { flush(); if (code === "k") style.obfuscated = true; if (code === "l") style.bold = true; if (code === "m") style.strike = true; if (code === "n") style.underline = true; if (code === "o") style.italic = true; if (code === "r") style = {}; i += 2; continue; }
    }
    if (text[i] === "<" && tags < 64) {
      const end = text.indexOf(">", i + 1);
      if (end > i && end - i < 260) {
        const raw = text.slice(i + 1, end), closing = raw.startsWith("/"), negated = raw.startsWith("!"), body = raw.replace(/^[\/{!]/, ""), [head, ...rest] = body.split(":");
        const tag = head.toLowerCase(); let handled = false;
        if (closing) { const at = stack.map((entry) => entry.name).lastIndexOf(tag); if (at >= 0) { flush(); const saved = stack[at]; style = saved.style; hover = saved.hover; interaction = saved.interaction; stack.splice(at); handled = true; } }
        else if (tag === "reset") { reset(); handled = true; }
        else if (tag === "newline" || tag === "br") { buffer += "\n"; handled = true; }
        else {
          const next = clone(style); let nextHover = hover, nextInteraction = interaction;
          const styleTag = tag === "bold" || tag === "b" || tag === "italic" || tag === "i" || tag === "em" || tag === "underlined" || tag === "u" || tag === "strikethrough" || tag === "st" || tag === "obfuscated" || tag === "obf";
          const color = tag === "color" ? safeColor(rest[0] ?? "") : safeColor(tag);
          if (styleTag || color || tag === "gradient" || tag === "rainbow") { if (tag.startsWith("b")) next.bold = !negated; else if (["italic","i","em"].includes(tag)) next.italic = !negated; else if (["underlined","u"].includes(tag)) next.underline = !negated; else if (["strikethrough","st"].includes(tag)) next.strike = !negated; else if (["obfuscated","obf"].includes(tag)) next.obfuscated = !negated; else next.color = color ?? safeColor(rest[0] ?? "#55ffff"); handled = true; }
          if (tag === "hover") { nextHover = rest.slice(1).join(":").replace(/^['"]|['"]$/g, "").slice(0, 500); handled = true; }
          if (tag === "click" && ["open_url","suggest_command","run_command"].includes(rest[0])) { const kind = rest[0] as Segment["interaction"] extends infer _ ? "open_url"|"suggest_command"|"run_command" : never; const value = rest.slice(1).join(":").replace(/^['"]|['"]$/g, ""); if (kind !== "open_url" || /^https?:\/\//i.test(value)) nextInteraction = { kind, value: value.slice(0, 512) }; handled = true; }
          if (["insertion","key","lang"].includes(tag)) handled = true;
          if (handled) { flush(); stack.push({ name: tag, style: clone(style), hover, interaction }); style = next; hover = nextHover; interaction = nextInteraction; }
        }
        if (handled) { tags++; i = end + 1; continue; }
      }
    }
    buffer += text[i++];
  }
  flush();
  return result;
}

export function plainText(segments: Segment[]) { return segments.map((part) => part.text).join(""); }
