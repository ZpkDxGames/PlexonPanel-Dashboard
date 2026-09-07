"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  UI_PREFERENCES_KEY,
  createDefaultUiPreferences,
  loadUiPreferences,
  resolveUiPresentation,
  saveUiPreferences,
  type ResolvedUiPresentation,
  type UiPreferencesV1,
} from "../lib/ui-preferences";
import {
  createAvatarProvider,
  resolveAvatarProviderTemplate,
} from "../lib/avatar-provider";

export type AvatarProviderStatus =
  | "built-in"
  | "custom"
  | "disabled"
  | "invalid";

type UiPreferencesContextValue = {
  preferences: UiPreferencesV1;
  resolved: ResolvedUiPresentation;
  avatarProviderAvailable: boolean;
  avatarProviderStatus: AvatarProviderStatus;
  updatePreference: <K extends keyof UiPreferencesV1>(
    key: K,
    value: UiPreferencesV1[K],
  ) => void;
  resetPreferences: () => void;
};

const fallbackPreferences = createDefaultUiPreferences(false);
const fallbackResolved: ResolvedUiPresentation = {
  theme: "dark",
  contrast: "standard",
  motion: "reduced",
};

const UiPreferencesContext = createContext<UiPreferencesContextValue>({
  preferences: fallbackPreferences,
  resolved: fallbackResolved,
  avatarProviderAvailable: false,
  avatarProviderStatus: "invalid",
  updatePreference: () => undefined,
  resetPreferences: () => undefined,
});

function systemState() {
  if (typeof window === "undefined") {
    return { dark: true, highContrast: false, reducedMotion: true };
  }
  return {
    dark: window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
    highContrast: window.matchMedia?.("(prefers-contrast: more)").matches ?? false,
    reducedMotion:
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true,
  };
}

function applyPresentation(
  preferences: UiPreferencesV1,
  resolved: ResolvedUiPresentation,
) {
  const root = document.documentElement;
  root.dataset.plexonTheme = resolved.theme;
  root.dataset.plexonAccent = preferences.accent;
  root.dataset.plexonContrast = resolved.contrast;
  root.dataset.plexonDensity = preferences.density;
  root.dataset.plexonTextScale = String(preferences.textScale);
  root.dataset.plexonMotion = resolved.motion;
  root.dataset.plexonChartStyle = preferences.chartStyle;
  root.dataset.plexonChartGrid = preferences.chartGrid ? "on" : "off";
  root.dataset.plexonChartLayout = preferences.chartLayout;
  root.dataset.plexonLivePulse = preferences.livePulse ? "on" : "off";
  root.dataset.plexonPageTransitions = preferences.pageTransitions ? "on" : "off";
}

function resolveProviderState() {
  const configured = process.env.NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE;
  const resolvedTemplate = resolveAvatarProviderTemplate(configured);
  const provider = createAvatarProvider(resolvedTemplate, {
    production: process.env.NODE_ENV === "production",
  });
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  const status: AvatarProviderStatus =
    trimmed.toLowerCase() === "disabled"
      ? "disabled"
      : trimmed
        ? provider
          ? "custom"
          : "invalid"
        : provider
          ? "built-in"
          : "invalid";
  return { available: Boolean(provider), status };
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const providerState = resolveProviderState();
  const avatarProviderAvailable = providerState.available;
  const avatarProviderStatus = providerState.status;
  const [preferences, setPreferences] = useState<UiPreferencesV1>(() =>
    createDefaultUiPreferences(avatarProviderAvailable),
  );
  const [resolved, setResolved] = useState<ResolvedUiPresentation>(fallbackResolved);

  useEffect(() => {
    const refresh = (next: UiPreferencesV1) => {
      const presentation = resolveUiPresentation(next, systemState());
      setResolved(presentation);
      applyPresentation(next, presentation);
    };

    const loaded = loadUiPreferences(localStorage, avatarProviderAvailable);
    saveUiPreferences(localStorage, loaded);
    const initialPresentation = resolveUiPresentation(loaded, systemState());
    applyPresentation(loaded, initialPresentation);
    queueMicrotask(() => {
      setPreferences(loaded);
      setResolved(initialPresentation);
    });

    const media = [
      window.matchMedia?.("(prefers-color-scheme: dark)"),
      window.matchMedia?.("(prefers-contrast: more)"),
      window.matchMedia?.("(prefers-reduced-motion: reduce)"),
    ].filter(Boolean) as MediaQueryList[];

    const onMedia = () =>
      setPreferences((current) => {
        refresh(current);
        return current;
      });
    const onStorage = (event: StorageEvent) => {
      if (event.key !== UI_PREFERENCES_KEY) return;
      const next = loadUiPreferences(localStorage, avatarProviderAvailable);
      setPreferences(next);
      refresh(next);
    };

    media.forEach((query) => query.addEventListener("change", onMedia));
    window.addEventListener("storage", onStorage);
    return () => {
      media.forEach((query) => query.removeEventListener("change", onMedia));
      window.removeEventListener("storage", onStorage);
    };
  }, [avatarProviderAvailable]);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({
      preferences,
      resolved,
      avatarProviderAvailable,
      avatarProviderStatus,
      updatePreference(key, nextValue) {
        setPreferences((current) => {
          const next = { ...current, [key]: nextValue } as UiPreferencesV1;
          saveUiPreferences(localStorage, next);
          const presentation = resolveUiPresentation(next, systemState());
          setResolved(presentation);
          applyPresentation(next, presentation);
          return next;
        });
      },
      resetPreferences() {
        const next = createDefaultUiPreferences(avatarProviderAvailable);
        saveUiPreferences(localStorage, next);
        const presentation = resolveUiPresentation(next, systemState());
        setPreferences(next);
        setResolved(presentation);
        applyPresentation(next, presentation);
      },
    }),
    [
      avatarProviderAvailable,
      avatarProviderStatus,
      preferences,
      resolved,
    ],
  );

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences() {
  return useContext(UiPreferencesContext);
}
