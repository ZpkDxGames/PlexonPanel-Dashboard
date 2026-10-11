import { useSession, useNow } from "../hooks";
import { capturedAtMillis, classifyTelemetry } from "../adapter/telemetry-freshness";
import { record } from "../adapter/control-state";
import { navigate } from "../router";

export function TelemetryStatus() {
  const snap = useSession(), now = useNow(), state = snap.state;
  const paper = snap.phase === "live" && Boolean(state.ready?.agents.paper), host = snap.phase === "live" && Boolean(state.ready?.agents.host);
  const sources = [
    { name: "Paper ticks", capture: state.server.capturedAt, receipt: state.receipts?.paperHealth, connected: paper },
    { name: "JVM resources", capture: state.system.capturedAt, receipt: state.receipts?.paperSystem, connected: paper },
    { name: "Host node", capture: state.hostSystem.capturedAt, receipt: state.receipts?.hostSystem, connected: host },
    { name: "Service", capture: record(state.service.resources).capturedAt ?? state.service.capturedAt, receipt: state.receipts?.service, connected: host },
  ];
  return <div className="telemetry-status" aria-label="Telemetry freshness by source">
    <span className="telemetry-caption">Sample age</span>
    {sources.map((source) => {
      const status = classifyTelemetry({ capturedAt: source.capture, receivedAt: source.receipt, connected: source.connected, now });
      const capture = capturedAtMillis(source.capture);
      const offset = capture !== null && source.receipt ? source.receipt - capture : null;
      const age = status.ageMs === null ? "—" : `${Math.floor(status.ageMs / 1000)}s`;
      const note = status.skewAheadMs > 5000 ? "Clock ahead; age uses browser receipt." : "Age uses the source capture clock.";
      return <span className={`telemetry-source ${status.kind}`} key={source.name} title={`${source.name}: ${status.label}. ${note}${offset === null ? "" : ` Capture-to-receipt offset: ${(offset / 1000).toFixed(1)}s; clock offset and transport delay cannot be separated here.`}`}><i/><strong>{source.name}</strong><span>{source.connected ? status.kind === "waiting" ? "waiting" : `${age}${status.kind === "live" ? "" : ` · ${status.kind}`}` : "offline"}</span></span>;
    })}
    <button onClick={() => navigate("Settings")} className="telemetry-details">Diagnostics</button>
  </div>;
}
