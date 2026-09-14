from pathlib import Path

path = Path("app/backups-view-3-4-1.tsx")
text = path.read_text()


def swap(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        print(label + ": already applied")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    text = text.replace(old, new)
    print(label + ": applied")


swap(
    '''          <article className="cr30-backup-metric"><span>Live snapshot</span><strong>{diagnosticsData ? number(diagnostics.legacyIntervalMinutes) === 0 ? "Disabled" : `Every ${number(diagnostics.legacyIntervalMinutes)} min` : "Unknown"}</strong><small>Protocol 3 Host interval scheduler · no decorative calendar schedule</small></article>
        </div>
      </Panel>''',
    '''          <article className="cr30-backup-metric"><span>Live snapshot</span><strong>{diagnosticsData ? number(diagnostics.legacyIntervalMinutes) === 0 ? "Disabled" : `Every ${number(diagnostics.legacyIntervalMinutes)} min` : "Unknown"}</strong><small>Protocol 3 Host interval scheduler · no decorative calendar schedule</small></article>
        </div>
        <p className="cr-hint cr30-backup-preview-note">
          Same-time full restore point + restart collapses into one serialized maintenance operation. Live snapshots remain on the separate Protocol 3 Host interval scheduler and all backup/maintenance work shares the Host operation lock. Keep unattended destructive schedules disabled until the intended live validation gates have been exercised.
        </p>
      </Panel>''',
    "3.4.1 schedule collision copy",
)

swap(
    '''          <div><dt>Runtime state</dt><dd>{providerQuery.hasSuccess ? providerState : "UNKNOWN"}</dd></div>
          <div><dt>Last test</dt><dd>{providerQuery.hasSuccess ? time(provider.lastTestAt) : "—"}</dd></div>
          <div><dt>Host config</dt><dd>{provider.hostConfigRestartRequired === true ? "Configuration changed on disk — restart Host to apply" : providerQuery.hasSuccess ? "Loaded configuration is current" : "Unknown"}</dd></div>''',
    '''          <div><dt>Runtime state</dt><dd>{providerQuery.hasSuccess ? providerState : "UNKNOWN"}</dd></div>
          <div><dt>Last test</dt><dd>{providerQuery.hasSuccess ? time(provider.lastTestAt) : "—"}</dd></div>
          <div><dt>Last successful verification</dt><dd>{providerQuery.hasSuccess ? time(provider.lastSuccessfulVerificationAt) : "—"}</dd></div>
          <div><dt>Host config</dt><dd>{provider.hostConfigRestartRequired === true ? "Configuration changed on disk — restart Host to apply" : providerQuery.hasSuccess ? "Loaded configuration is current" : "Unknown"}</dd></div>''',
    "3.4.1 provider successful verification",
)

path.write_text(text)
