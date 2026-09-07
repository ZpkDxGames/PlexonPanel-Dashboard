(() => {
  const root = document.documentElement;
  const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
  let saved = {};
  try {
    const raw = localStorage.getItem("plexonpanel-ui-preferences-v1");
    if (raw && raw.length <= 8192) saved = JSON.parse(raw) || {};
  } catch {
    saved = {};
  }

  const theme = allowed(saved.theme, ["system", "dark", "light"], "system");
  const contrast = allowed(saved.contrast, ["system", "standard", "high"], "system");
  const motion = allowed(saved.motion, ["system", "full", "reduced", "off"], "system");
  const legacyDensity = localStorage.getItem("plexonpanel-density");
  const density = allowed(
    saved.density ?? legacyDensity,
    ["compact", "comfortable", "spacious"],
    "comfortable",
  );
  const accent = allowed(saved.accent, ["cyan", "violet", "emerald", "amber"], "cyan");
  const textScale = [100, 112.5, 125].includes(saved.textScale) ? saved.textScale : 100;

  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const high = window.matchMedia?.("(prefers-contrast: more)").matches ?? false;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;

  root.dataset.plexonTheme = theme === "system" ? (dark ? "dark" : "light") : theme;
  root.dataset.plexonAccent = accent;
  root.dataset.plexonContrast = contrast === "system" ? (high ? "high" : "standard") : contrast;
  root.dataset.plexonDensity = density;
  root.dataset.plexonTextScale = String(textScale);
  root.dataset.plexonMotion = motion === "off" ? "off" : (motion === "reduced" || reduced ? "reduced" : "full");
})();
