(() => {
  const root = document.documentElement;
  const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
  let saved = {};
  let hasSavedKey = true;
  try {
    const raw = localStorage.getItem("plexonpanel-ui-preferences-v1");
    hasSavedKey = raw !== null;
    if (raw && raw.length <= 8192) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
    }
  } catch {
    saved = {};
  }

  const theme = allowed(saved.theme, ["system", "dark", "light"], hasSavedKey ? "light" : "system");
  const contrast = allowed(saved.contrast, ["system", "standard", "high"], "system");
  const motion = allowed(saved.motion, ["system", "full", "reduced", "off"], "system");
  let legacyDensity;
  try { legacyDensity = localStorage.getItem("plexonpanel-density"); } catch {}
  const density = allowed(
    saved.density ?? (hasSavedKey ? undefined : legacyDensity),
    ["compact", "comfortable", "spacious"],
    "compact",
  );
  const accent = allowed(saved.accent, ["monochrome", "cyan", "violet", "emerald", "amber"], hasSavedKey ? "monochrome" : "cyan");
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
