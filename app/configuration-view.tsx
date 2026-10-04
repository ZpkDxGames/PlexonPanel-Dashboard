"use client";
import { FilesView } from "./advanced-views";
import { Badge, Panel, type ViewProps } from "./control-views";
import { str } from "../lib/control-state";

const permissions = [
  ["Read configuration", "files.read", "PAPER"],
  ["Edit configuration", "files.write", "PAPER"],
  ["Create files", "files.create", "PAPER"],
  ["Remove files", "files.delete", "PAPER"],
  ["Manage scheduled maintenance", "maintenance.settings.update", "HOST"],
  ["Revoke devices", "devices.revoke", "PAPER"],
] as const;

export function ConfigurationView(props: ViewProps) {
  const owner = props.deviceGrant?.role === "Owner";
  const name = str(props.state.ready?.server.serverName, "Selected server");
  return <div className="configuration-workspace">
    <Panel title="Server configuration" aside={<Badge>{owner ? "Owner access" : props.deviceGrant?.role || "Paired access"}</Badge>}>
      <div className="cr-pad configuration-intro">
        <p>Edit Paper and plugin text configuration for <strong>{name}</strong>. Review changes before saving. Some changes need a plugin reload or server restart.</p>
        <details className="workspace-disclosure">
          <summary>Permissions and local policy</summary>
          <p>{owner ? "Owner pairing includes every defined scope. Each agent also enforces its configured local capabilities." : "Your paired role and this server’s local capabilities determine which settings you can change."}</p>
          <dl className="configuration-permissions">{permissions.map(([label, action, kind]) => <div key={action}><dt>{label}</dt><dd><Badge tone={props.can(action, kind) ? "green" : "quiet"}>{props.can(action, kind) ? "Available" : "Unavailable"}</Badge></dd></div>)}</dl>
          <p className="cr-hint">Paper must be connected to edit files. If editing is disabled, the server operator must enable remote actions, file permissions and a writable root for this instance in PlexonPanel’s local configuration. Host fallback is read-only. Identity, pairing secrets, server.properties and the agent’s own policy remain protected.</p>
        </details>
      </div>
    </Panel>
    <FilesView {...props} />
  </div>;
}
