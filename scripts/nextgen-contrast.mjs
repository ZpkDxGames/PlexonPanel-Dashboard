import { mkdir, writeFile } from "node:fs/promises";
const themes = {
  dark: {
    surfaces: ["#101718", "#182224", "#233033", "#0d1416"],
    text: ["#ecf3ee", "#b4c5bf", "#95aaa3"],
    status: ["#88dbab", "#f0c775", "#ffb0a8", "#9dcbff"],
    signals: ["#78dcc4", "#9dcbff", "#c4b7ff"],
    control: "#75938a",
    action: "#78dcc4",
    onAction: "#10241e",
    focus: "#a3f0dc",
  },
  light: {
    surfaces: ["#f3f4ef", "#ffffff", "#e9eeea", "#f7f9f6"],
    text: ["#172526", "#465d57", "#526761"],
    status: ["#14653d", "#805000", "#a92d25", "#285f9d"],
    signals: ["#116d5e", "#285f9d", "#6651a6"],
    control: "#657d74",
    action: "#116d5e",
    onAction: "#ffffff",
    focus: "#075d50",
  },
};
const rgb = (s) =>
    s
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255),
  lum = (c) =>
    c
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0),
  ratio = (a, b) =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const results = [];
for (const [theme, t] of Object.entries(themes)) {
  for (const bg of t.surfaces) {
    for (const fg of [...t.text, ...t.status])
      results.push({
        theme,
        kind: "text on neutral",
        fg,
        bg,
        minimum: 4.5,
        ratio: ratio(rgb(fg), rgb(bg)),
      });
    for (const fg of [...t.signals, t.focus, t.control])
      results.push({
        theme,
        kind: "control/focus/trace",
        fg,
        bg,
        minimum: 3,
        ratio: ratio(rgb(fg), rgb(bg)),
      });
    for (const fg of t.status) {
      const tint = rgb(fg).map((n, i) => n * 0.11 + rgb(bg)[i] * 0.89);
      results.push({
        theme,
        kind: "status text on 11% tint",
        fg,
        bg,
        minimum: 4.5,
        ratio: ratio(rgb(fg), tint),
      });
    }
  }
  results.push({
    theme,
    kind: "primary action",
    minimum: 4.5,
    ratio: ratio(rgb(t.onAction), rgb(t.action)),
  });
}
await mkdir("artifacts/nextgen", { recursive: true });
const failed = results.filter((x) => x.ratio < x.minimum);
await writeFile(
  "artifacts/nextgen/contrast.json",
  JSON.stringify(
    {
      scope:
        "Locked neutral, action, focus, control, trace and semantic-tint tokens; rendered axe results are a separate gate.",
      results,
      failed,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ pairs: results.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
