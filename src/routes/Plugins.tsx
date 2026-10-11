import { copy } from "../i18n/en";
import { useState } from "react";
import { useSession } from "../hooks";
import { str } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { Panel, Button, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
export default function Plugins() {
  const snap = useSession();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [prepared, setPrepared] = useState<Prepared | null>(null);
  const plugins = snap.state.plugins
    .filter(
      (p) =>
        str(p.name).toLowerCase().includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "enabled" && p.enabled === true) ||
          (filter === "disabled" && p.enabled !== true)),
    )
    .sort((a, b) => str(a.name).localeCompare(str(b.name)));
  return (
    <>
      <div className="players-toolbar">
        <label className="field">
          {copy.search_plugins_5393d}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.find_a_plugin_cb8f8}
          />
        </label>
        <label className="field">
          {copy.status_bae7d}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{copy.all_plugins_6c56e}</option>
            <option value="enabled">{copy.enabled_df174}</option>
            <option value="disabled">{copy.disabled_f4f44}</option>
          </select>
        </label>
        <Status>
          {snap.state.plugins.length}
          {copy._installed_faa64}
        </Status>
      </div>
      <Panel
        title={copy.installed_plugins_36ba3}
        eyebrow={copy.versions_and_status_reported_by_paper_22362}
      >
        <div className="plugin-list">
          {plugins.map((p, i) => (
            <div className="plugin-row" key={str(p.name)}>
              <span
                className="plugin-initial"
                style={{ color: `var(--c${(i % 5) + 1})` }}
              >
                {str(p.name).slice(0, 2)}
              </span>
              <div>
                <strong>{str(p.name)}</strong>
                <small>
                  {str(p.version, "Version unavailable")}
                  {p.author ? " · " + str(p.author) : ""}
                </small>
              </div>
              <Status tone={p.enabled === true ? "success" : "neutral"}>
                {p.enabled === true ? "Enabled" : "Disabled"}
              </Status>
              <Button
                disabled={Boolean(
                  session.reason("plugin.command.reload", "PAPER"),
                )}
                title={session.reason("plugin.command.reload", "PAPER")}
                onClick={() =>
                  setPrepared(
                    session.prepare(
                      "plugin.command.reload",
                      { plugin: str(p.name) },
                      "PAPER",
                    ),
                  )
                }
              >
                {copy.review_reload_706b1}
              </Button>
            </div>
          ))}
        </div>
        {!plugins.length && (
          <div className="inline-empty">
            <strong>
              {snap.state.ready?.agents.paper
                ? "No matching plugins"
                : "Plugin inventory is offline"}
            </strong>
            <span>
              {snap.state.ready?.agents.paper
                ? "Try another search or status filter."
                : "Installed plugins appear after Paper connects."}
            </span>
          </div>
        )}
      </Panel>
      <Panel
        title={copy.plugin_configuration_5c6ae}
        eyebrow={copy.available_files_and_supported_actions_e27bc}
      >
        <p className="subtle">
          {copy.open_files_to_browse_configuration_plu_48f63}
        </p>
        <div className="button-row">
          <Button onClick={() => (location.hash = "Files")}>
            {copy.open_files_67b24}
          </Button>
          <Status>{copy.enable_disable_not_available_5a1a7}</Status>
        </div>
      </Panel>
      <ActionReview prepared={prepared} onClose={() => setPrepared(null)} />
    </>
  );
}
