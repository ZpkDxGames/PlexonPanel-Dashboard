"use client";
import { useState } from "react";
import { usePrefs, type Preferences } from "../bindings";
import { PpSelect } from "../primitives/Select";
import {
  PlayerHead,
  InstrumentDeck,
  PREVIEW_DECK,
} from "../instruments/InstrumentDeck";
import { StudioChart, type ChartData } from "../studio/StudioChart";
import { ConsoleRow } from "../console/ConsoleRow";
import { parseLine } from "../console/parse-line";
import { Pane, Title } from "./shared";
const end = Date.UTC(2026, 9, 19, 12),
  points = Array.from({ length: 60 }, (_, i) => ({
    at: end - (59 - i) * 3000,
    epoch: "preview",
    tps: 19.8 + Math.sin(i / 4) * 0.2,
    mspt: 22 + Math.sin(i / 4) * 5,
    p95: 30 + Math.sin(i / 4) * 5,
    p99: 38 + Math.sin(i / 4) * 5,
    gc: 0,
    heap: 2 ** 30,
    memory: 4 * 2 ** 30,
    processCpu: 20,
    hostCpu: 10,
    players: 1,
  }));
const previewData: ChartData = {
  paper: points,
  system: points,
  host: points,
  service: points,
  since: end - 180000,
  now: end,
};
const options: {
  key: keyof Preferences;
  title: string;
  detail: string;
  values: { value: string; label: string }[];
}[] = [
  {
    key: "theme",
    title: "Theme",
    detail: "Follow your environment or choose a surface.",
    values: ["system", "dark", "light"].map((v) => ({ value: v, label: v })),
  },
  {
    key: "accent",
    title: "Accent",
    detail: "Navigation and interaction. Metric hues stay semantic.",
    values: ["teal", "blue", "violet"].map((v) => ({ value: v, label: v })),
  },
  {
    key: "density",
    title: "Density",
    detail: "Row and control rhythm.",
    values: ["compact", "comfortable", "spacious"].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    key: "textSize",
    title: "Text size",
    detail: "Tune interface readability.",
    values: ["small", "standard", "large"].map((v) => ({ value: v, label: v })),
  },
  {
    key: "motion",
    title: "Motion",
    detail: "Reduced and off remove all animated movement.",
    values: ["full", "reduced", "off"].map((v) => ({ value: v, label: v })),
  },
  {
    key: "chartFill",
    title: "Chart fill",
    detail: "Gradient areas under telemetry signals.",
    values: [
      { value: "true", label: "Gradient" },
      { value: "false", label: "Lines" },
    ],
  },
  {
    key: "timezone",
    title: "Timezone",
    detail: "Chart axes, logs, audit events and readouts.",
    values: [
      {
        value: "browser",
        label: `Browser (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      },
      { value: "UTC", label: "UTC" },
    ],
  },
  {
    key: "skinProvider",
    title: "Player identity",
    detail: "Avatar provider, with initials as fallback.",
    values: ["proxy", "crafatar", "mc-heads", "minotar", "disabled"].map(
      (v) => ({ value: v, label: v }),
    ),
  },
];
export default function Settings() {
  const prefs = usePrefs(),
    [saved, setSaved] = useState("");
  return (
    <div className="pp-page">
      <Title
        code="R08 / Preferences"
        title="Make room for your focus."
        detail="Eight local preferences. Changes apply immediately."
      />
      <div className="pp-settings">
        <Pane
          title="Preference studio"
          actions={
            <small role="status" className="muted">
              {saved}
            </small>
          }
        >
          {options.map((o, i) => (
            <div key={o.key}>
              {[0, 4, 6].includes(i) && (
                <div
                  className="pp-kicker pp-section-label"
                  style={{ paddingTop: 18 }}
                >
                  {i === 0
                    ? "Appearance"
                    : i === 4
                      ? "Motion & charts"
                      : "Time & identity"}
                </div>
              )}
              <label className="pp-field-row">
                <span>
                  <strong style={{ fontWeight: 550 }}>{o.title}</strong>
                  <small>{o.detail}</small>
                </span>
                <span className="row">
                  {o.key === "skinProvider" && (
                    <PlayerHead
                      uuid="8667ba71-b85a-4004-af54-457a9734eed7"
                      name="Steve"
                      skinTexture={null}
                      provider={prefs.skinProvider}
                      size={24}
                    />
                  )}
                  <PpSelect
                    ariaLabel={o.title}
                    value={String(prefs[o.key])}
                    onChange={(v) => {
                      prefs.set(
                        o.key,
                        (o.key === "chartFill" ? v === "true" : v) as never,
                      );
                      setSaved("Saved");
                    }}
                    options={o.values.map((v) => ({
                      ...v,
                      leading:
                        o.key === "accent" ? (
                          <i
                            className="pp-swatch"
                            style={{
                              background: {
                                teal: "#2dd4bf",
                                blue: "#60a5fa",
                                violet: "#a78bfa",
                              }[v.value],
                            }}
                          />
                        ) : undefined,
                    }))}
                  />
                </span>
              </label>
            </div>
          ))}
        </Pane>
        <aside className="pp-settings__preview" aria-label="Component preview">
          <div className="row spread" style={{ padding: "0 0 12px" }}>
            <span className="pp-kicker">Component preview</span>
            <small className="muted">Fixed sample data</small>
          </div>
          <div className="pp-preview">
            <InstrumentDeck data={PREVIEW_DECK} />
            <Pane title="Telemetry preview">
              <StudioChart data={previewData} staged={false} />
            </Pane>
            <Pane title="Terminal preview">
              <div
                className="pp-console"
                data-mode="compact"
                style={{ paddingBlock: 10 }}
              >
                {[
                  "[12:00:00 INFO]: [Server] Saved the game",
                  "[12:00:01 INFO]: [LuckPerms] Cache synchronized",
                  "[12:00:02 WARN]: Tick exceeded the 50ms budget",
                ].map((line, i) => (
                  <ConsoleRow
                    key={i}
                    line={parseLine(`preview-${i}`, line)}
                    mode="compact"
                  />
                ))}
              </div>
            </Pane>
          </div>
        </aside>
      </div>
    </div>
  );
}
