"use client";
import { hasScope } from "../presentation/authority";
import { useSession } from "../hooks";
import { records, str } from "../adapter/control-state";
import { useTimestamp } from "../presentation/nextgen/time";
export function BootSessionBadge() {
  const { state } = useSession(),
    stamp = useTimestamp();
  return (
    <div className="v5-session">
      <strong className="mono">
        Session {state.bootEpochId?.slice(0, 8) ?? "unavailable"}
      </strong>
      <p>
        Started{" "}
        {state.bootStartedAt ? stamp(state.bootStartedAt) : "not reported"} ·
        refreshes on every server restart
      </p>
    </div>
  );
}
export function PresenceTimeline() {
  const snap = useSession(),
    { state } = snap,
    stamp = useTimestamp(),
    view =
      hasScope(snap, "players.view") &&
      state.ready?.server.hostCapabilities?.["players.view"] !== false
        ? state.sessionEvents
        : undefined,
    events = records(view?.events, 100);
  return (
    <section className="v5-session" aria-label="Current boot player timeline">
      <header>
        <h2>Current boot timeline</h2>
        <span className="mono">HOST · SQLITE + JSON</span>
      </header>
      <BootSessionBadge />
      {view ? (
        <>
          <p>
            {String(view.onlineCount ?? "—")} active players · {events.length}{" "}
            recent join/leave observations
          </p>
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Boot-session player observations"
          >
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>State</th>
                  <th>Observed at</th>
                  <th>Termination</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={str(e.eventId)}>
                    <td title={str(e.uuid)}>{str(e.name)}</td>
                    <td>{str(e.state)}</td>
                    <td>{stamp(e.observedAt)}</td>
                    <td>{str(e.termination)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>
          Waiting for current-epoch Host history. Player identity requires
          players.view.
        </p>
      )}
    </section>
  );
}
