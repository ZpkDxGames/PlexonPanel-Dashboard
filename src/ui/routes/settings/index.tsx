import { useState } from "react";
import { PreferenceSelect } from "../../primitives/PreferenceSelect";
import {
  Palette,
  Monitor,
  Clock,
  UserRound,
  Settings as Gear,
  Info,
} from "lucide-react";
import { Heading, Panel, QueryNotice } from "../shared";
import {
  usePreferences,
  preferences,
  type Preferences,
} from "../../../store/preferences";
import { useControl, useNow, useQuery } from "../../hooks/useControl";
import { PlayerHead } from "../../primitives/AvatarStack";
import { Sparkline } from "../../primitives/Sparkline";
import { MutationButton } from "../../review/ActionReviewModal";
const CHOICES = {
  theme: ["system", "dark", "light"],
  density: ["compact", "comfortable", "spacious"],
  textSize: ["small", "standard", "large"],
  accent: ["teal", "blue", "violet"],
  motion: ["full", "reduced", "off"],
  timezone: ["browser", "UTC"],
  skinProvider: ["proxy", "crafatar", "mc-heads", "minotar", "disabled"],
} as const;
export default function Settings() {
  const p = usePreferences(),
    now = useNow(),
    { state } = useControl(),
    server = useQuery("settings.view", "PAPER");
  function update<K extends keyof Preferences>(k: K, v: Preferences[K]) {
    preferences.update({ [k]: v });
  }
  const row = (key: keyof typeof CHOICES, label: string) => (
    <div className="settings-row">
      <label htmlFor={`pref-${key}`}>{label}</label>
      <select
        id={`pref-${key}`}
        aria-label={label}
        value={p[key]}
        onChange={(e) => update(key, e.target.value as never)}
      >
        {CHOICES[key].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </div>
  );
  return (
    <>
      <Heading
        id="R08 · Settings"
        title="Make room for your rhythm."
        detail="Eight preferences. Immediate changes, saved on this browser."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {["Appearance", "Display", "Time", "Skins", "Server", "About"].map(
            (v) => (
              <a key={v} href={`#${v.toLowerCase()}`}>
                {v}
              </a>
            ),
          )}
        </nav>
        <div className="space-y-4">
          <div id="appearance">
            <Panel title="Appearance" tone="accent" icon={Palette}>
              <div className="setting-tiles">
                {CHOICES.theme.map((theme) => (
                  <button
                    key={theme}
                    className="setting-tile"
                    aria-pressed={p.theme === theme}
                    onClick={() => update("theme", theme)}
                  >
                    <span className="theme-preview" data-theme={theme}>
                      <i />
                      <i />
                    </span>
                    {theme}
                  </button>
                ))}
              </div>
              <div className="settings-row">
                <span>Accent</span>
                <div className="flex gap-3">
                  {CHOICES.accent.map((v) => (
                    <button
                      key={v}
                      aria-label={`${v} accent`}
                      aria-pressed={p.accent === v}
                      data-tone={
                        v === "teal"
                          ? "emerald"
                          : v === "blue"
                            ? "sky"
                            : "violet"
                      }
                      className="pill"
                      onClick={() => update("accent", v)}
                    >
                      <i className="signal-dot" />
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <div id="display">
            <Panel title="Display" tone="cyan" icon={Monitor}>
              <div className="setting-tiles">
                {CHOICES.density.map((v) => (
                  <button
                    key={v}
                    className="setting-tile"
                    aria-pressed={p.density === v}
                    onClick={() => update("density", v)}
                  >
                    <div className="pp-well p-2 mb-3 space-y-1">
                      {[1, 2, 3].map((k) => (
                        <i
                          className="block rounded bg-[rgb(var(--accent)/.25)]"
                          key={k}
                          style={{
                            height:
                              v === "compact" ? 3 : v === "comfortable" ? 6 : 9,
                          }}
                        />
                      ))}
                    </div>
                    {v}
                  </button>
                ))}
              </div>
              <div className="settings-row">
                <label htmlFor="text-size-slider">
                  Text size · {p.textSize}
                </label>
                <input
                  id="text-size-slider"
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={CHOICES.textSize.indexOf(p.textSize)}
                  onChange={(e) =>
                    update("textSize", CHOICES.textSize[Number(e.target.value)])
                  }
                />
              </div>
              <div className="pp-well p-3 text-secondary">
                The quick brown fox · 19.87 TPS
              </div>
              {row("motion", "Motion")}
              <label className="settings-row">
                Chart area fills
                <input
                  aria-label="Chart area fills"
                  type="checkbox"
                  checked={p.chartFill}
                  onChange={(e) => update("chartFill", e.target.checked)}
                />
              </label>
              <div data-tone="cyan" className="pp-well p-3">
                <Sparkline
                  values={[10, 12, 9, 15, 11, 17, 13]}
                  filled={p.chartFill}
                />
              </div>
            </Panel>
          </div>
          <div id="time">
            <Panel title="Time" tone="amber" icon={Clock}>
              <div className="settings-row">
                <span>Timezone</span>
                <PreferenceSelect
                  label="Timezone"
                  value={p.timezone}
                  options={CHOICES.timezone}
                  onChange={(v) =>
                    update("timezone", v as Preferences["timezone"])
                  }
                />
              </div>
              <div className="pp-well p-4 mt-3">
                <strong className="mono num text-xl">
                  {new Date(now).toLocaleTimeString(
                    undefined,
                    p.timezone === "UTC" ? { timeZone: "UTC" } : {},
                  )}
                </strong>
                <p className="text-secondary text-xs mt-2">
                  Applies to chart ticks, tooltips and terminal timestamps.
                </p>
              </div>
            </Panel>
          </div>
          <div id="skins">
            <Panel title="Player heads" tone="emerald" icon={UserRound}>
              <div
                className="segments flex-wrap mb-3"
                role="group"
                aria-label="Skin provider"
              >
                {CHOICES.skinProvider.map((provider) => (
                  <button
                    key={provider}
                    aria-pressed={p.skinProvider === provider}
                    className={
                      p.skinProvider === provider ? "pp-glow-active" : ""
                    }
                    onClick={() => update("skinProvider", provider)}
                  >
                    {provider}
                  </button>
                ))}
              </div>
              <div className="pp-well p-4 flex flex-wrap gap-3 mt-3">
                {state.players.slice(0, 6).map((ply) => (
                  <PlayerHead
                    key={String(ply.uuid)}
                    provider={p.skinProvider}
                    uuid={String(ply.uuid)}
                    name={String(ply.name)}
                    size={36}
                  />
                ))}
              </div>
              <p className="text-secondary text-xs mt-3">
                Disabled uses initials. Changing the provider resets image
                failures.
              </p>
            </Panel>
          </div>
          <div id="server">
            <Panel title="Server configuration" tone="indigo" icon={Gear}>
              <QueryNotice query={server} />
              <div className="pp-well p-3">
                <pre>{JSON.stringify(server.data, null, 2)}</pre>
              </div>
              <p className="text-secondary text-xs mt-3">
                Server changes require the negotiated action, scope and review.
                This view only displays reported settings.
              </p>
            </Panel>
          </div>
          <div id="about">
            <Panel title="About this workspace" tone="slate" icon={Info}>
              <div className="pp-well p-4 space-y-2">
                <p>PlexonPanel 5.0 · Protocol 3</p>
                <p>
                  Paper {state.ready?.server.pluginVersion ?? "not connected"} ·
                  Host {state.ready?.server.hostVersion ?? "not connected"}
                </p>
                <p className="mono text-xs break-all">{state.serverId}</p>
              </div>
              <p className="text-secondary text-xs mt-3">
                Console, chat and command history remain in memory. Current-boot
                history belongs to the Host.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
