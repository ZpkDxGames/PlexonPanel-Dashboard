"use client";

import { Badge, Panel, type ViewProps } from "./control-views";

function PlaceholderMetric({ label, detail }: { label: string; detail: string }) {
  return (
    <article className="cr30-backup-metric">
      <span>{label}</span>
      <strong>—</strong>
      <small>{detail}</small>
    </article>
  );
}

export function BackupsView30(props: ViewProps) {
  const hostConnected = Boolean(props.state.ready?.agents.host);
  const hostInstalled = Boolean(props.state.ready?.agents.hostInstalled);
  const hostState = hostConnected ? "Host connected" : hostInstalled ? "Host offline" : "Host not installed";

  return (
    <div className="cr30-backups-stack">
      <div className="cr21-page-toolbar cr30-backup-toolbar">
        <div>
          <strong>Backup control</strong>
          <span>
            Control-room shell only. Backup inventory, create, download, restore and delete logic will be wired in a later pass.
          </span>
        </div>
        <Badge tone={hostConnected ? "green" : "quiet"}>{hostState}</Badge>
      </div>

      <section className="cr30-backup-summary" aria-label="Backup workspace status">
        <div>
          <small>Authority</small>
          <strong>Host companion</strong>
          <span>Backup operations remain Host-authoritative.</span>
        </div>
        <div>
          <small>Integration</small>
          <strong>Scaffold only</strong>
          <span>No backup action is sent from this page yet.</span>
        </div>
        <div>
          <small>Safety</small>
          <strong>Permission gated</strong>
          <span>Future destructive actions will keep confirmation and scope checks.</span>
        </div>
      </section>

      <section className="cr30-backup-metrics" aria-label="Backup metrics placeholders">
        <PlaceholderMetric label="Last backup" detail="Awaiting Host inventory integration" />
        <PlaceholderMetric label="Stored backups" detail="Awaiting backup.list" />
        <PlaceholderMetric label="Storage used" detail="Awaiting Host storage metadata" />
        <PlaceholderMetric label="Next schedule" detail="Scheduling logic not connected" />
      </section>

      <div className="cr30-backup-columns">
        <Panel
          title="Backup inventory"
          aside={<Badge tone="quiet">Not wired</Badge>}
        >
          <div className="cr30-backup-empty">
            <span className="cr30-backup-empty-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16v12H4zM7 4h10v3M8 11h8M8 15h5" />
              </svg>
            </span>
            <div>
              <h3>Backup inventory integration comes next</h3>
              <p>
                This workspace is intentionally presentation-only for now. It does not query, create, restore, delete or download backups.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Planned controls" aside={<Badge tone="cyan">Preview</Badge>}>
          <div className="cr30-backup-control-preview">
            <button className="cr-button primary" disabled>Create backup</button>
            <button className="cr-button" disabled>Refresh inventory</button>
            <button className="cr-button" disabled>Download selected</button>
            <button className="cr-button danger" disabled>Restore selected</button>
            <button className="cr-button danger" disabled>Delete selected</button>
          </div>
          <p className="cr-hint cr30-backup-preview-note">
            These controls are deliberately disabled until the Host-side flow, progress states, confirmations and audit behavior are connected and validated.
          </p>
        </Panel>
      </div>

      <Panel title="Future integration contract">
        <div className="cr30-backup-contract">
          <article>
            <strong>Inventory</strong>
            <p>Read backup entries through the existing Host-authoritative backup compatibility path.</p>
            <code>backup.list · backup.view</code>
          </article>
          <article>
            <strong>Create & download</strong>
            <p>Expose progress, completion feedback and safe download handling without blocking the dashboard.</p>
            <code>backup.create · backup.download</code>
          </article>
          <article>
            <strong>Restore & delete</strong>
            <p>Keep Owner/high-risk confirmation semantics, immutable device grants and local Host policy gating.</p>
            <code>backup.restore · backup.delete</code>
          </article>
        </div>
      </Panel>
    </div>
  );
}
