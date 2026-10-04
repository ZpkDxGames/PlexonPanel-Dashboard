import { Badge, Panel, type ViewProps } from "./control-views";
import { validInstanceKey } from "../lib/fleet-contract";

export function BackupDestination({ state, remote, configured, restartRequired }: {
  state: ViewProps["state"]; remote: string; configured: boolean; restartRequired: boolean;
}) {
  const name = state.ready?.server.serverName ?? "Selected server";
  const candidate = state.ready?.server.instanceKey;
  const key = validInstanceKey(candidate) ? candidate : null;
  return <Panel title={`${name} backup destination`} aside={<Badge tone={configured ? "green" : "amber"}>{configured ? "Configured" : "Setup required"}</Badge>}>
    <div className="backup-destination-grid">
      <div><span className="cr21-kicker">LOCAL REPOSITORY</span><strong>{key ? `/var/backups/plexonpanel/instances/${key}` : "Waiting for signed instance identity"}</strong><small>Retained archives and recovery metadata for this server.</small></div>
      <div><span className="cr21-kicker">GOOGLE DRIVE</span><strong>{configured ? remote || "Host-configured destination" : "Connect this server’s Drive folder"}</strong><small>{configured ? "The Host verifies uploads before replacing the current restore point." : "A Drive folder alone does not connect the running Host to Google Drive."}</small></div>
    </div>
    {restartRequired && <p className="cr-alert" role="status">The Host configuration changed on disk. Restart only this server’s Host after reviewing any active maintenance job.</p>}
    <details className="backup-setup-guide" open={!configured}>
      <summary>{configured ? "Destination and recovery notes" : "How to connect Google Drive"}</summary>
      <ol>
        <li>Open the matching <strong>{name}</strong> folder in Drive and copy its folder ID from the address bar.</li>
        <li>Authorize a separate Host-local rclone configuration for this instance, with that folder as its root.</li>
        <li>Set the protected Host destination to <code>gdrive:plexonpanel/{state.serverId}</code>. Each server keeps its own UUID namespace inside its existing folder.</li>
        <li>Restart only the affected Host, then use <strong>Test Google Drive</strong> and <strong>Refresh</strong>. A successful test verifies access; a completed backup separately verifies the archive.</li>
      </ol>
      {key && <p className="cr-hint">Policy: <code>/etc/plexonpanel/instances/{key}/host-config.json</code>. Credentials and refreshed tokens stay on the VPS.</p>}
      <p className="cr-hint">Files uploaded manually to Drive remain untouched. They appear in verified history only when managed and verified by this Host.</p>
    </details>
  </Panel>;
}
