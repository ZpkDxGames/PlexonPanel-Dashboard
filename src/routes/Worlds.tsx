import { copy } from "../i18n/en";
import { useSession } from "../hooks";
import { number, str } from "../adapter/control-state";
import { Panel, Status } from "../components/ui";
import { BlockMark } from "../components/BlockMark";
import { Icon } from "../components/Icon";
import { entityDensity } from "../store/selectors";
export default function Worlds() {
  const { state } = useSession();
  const total = state.worlds.reduce(
    (n, w) => n + (number(w.loadedChunks) ?? 0),
    0,
  );
  return (
    <>
      <div className="world-summary card">
        <div className="server-icon">
          <BlockMark />
        </div>
        <div>
          <h2>
            {state.worlds.length}
            {copy._worlds_d195d}
          </h2>
          <p className="subtle">
            {total.toLocaleString()}
            {copy._loaded_chunks_across_your_server_7af71}
          </p>
        </div>
        <Status tone={state.ready?.agents.paper ? "success" : "neutral"}>
          {state.ready?.agents.paper
            ? "Live world inventory"
            : "History retained"}
        </Status>
      </div>
      <div className="worlds-grid">
        {state.worlds.map((w, i) => (
          <Panel
            key={str(w.name)}
            title={str(w.name)}
            eyebrow={str(w.environment, str(w.dimension, "Minecraft world"))}
            action={
              <span
                className="world-icon"
                style={{ color: `var(--c${(i % 5) + 1})` }}
              >
                <Icon name="globe" />
              </span>
            }
          >
            <div className="world-facts">
              <div>
                <b>{number(w.loadedChunks)?.toLocaleString() ?? "—"}</b>
                <span>{copy.loaded_chunks_1e674}</span>
              </div>
              <div>
                <b>{number(w.entities)?.toLocaleString() ?? "—"}</b>
                <span>{copy.entities_f7638}</span>
              </div>
              <div>
                <b>
                  {entityDensity(w.entities, w.loadedChunks)?.toFixed(2) ?? "—"}
                </b>
                <span>{copy.entities_chunk_1e959}</span>
              </div>
            </div>
            <div className="world-load">
              <div
                style={{
                  transform: `scaleX(${(number(w.loadedChunks) ?? 0) / Math.max(1, total)})`,
                  background: `var(--c${(i % 5) + 1})`,
                }}
              />
            </div>
            <p className="subtle">
              {total
                ? Math.round(((number(w.loadedChunks) ?? 0) / total) * 100)
                : 0}
              {copy._of_loaded_chunks_c8098}
            </p>
            <div className="world-unavailable">
              <Icon name="access" />
              <span>{copy.seed_border_weather_and_gamerules_are_63b07}</span>
            </div>
          </Panel>
        ))}
      </div>
      {!state.worlds.length && (
        <Panel title={copy.worlds_will_appear_here_8aabc}>
          <div className="inline-empty">
            <strong>{copy.waiting_for_paper_df03c}</strong>
            <span>{copy.connect_the_server_to_inspect_its_worl_1e7e4}</span>
          </div>
        </Panel>
      )}
    </>
  );
}
