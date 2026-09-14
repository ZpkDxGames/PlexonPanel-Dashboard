from pathlib import Path

path = Path("app/backups-view-3-4-1.tsx")
text = path.read_text()
old = '''          <article className="cr30-backup-metric"><span>Live snapshot</span><strong>{diagnosticsData ? number(diagnostics.legacyIntervalMinutes) === 0 ? "Disabled" : `Every ${number(diagnostics.legacyIntervalMinutes)} min` : "Unknown"}</strong><small>Protocol 3 Host interval scheduler · no decorative calendar schedule</small></article>
        </div>
      </Panel>'''
new = '''          <article className="cr30-backup-metric"><span>Live snapshot</span><strong>{diagnosticsData ? number(diagnostics.legacyIntervalMinutes) === 0 ? "Disabled" : `Every ${number(diagnostics.legacyIntervalMinutes)} min` : "Unknown"}</strong><small>Protocol 3 Host interval scheduler · no decorative calendar schedule</small></article>
        </div>
        <p className="cr-hint cr30-backup-preview-note">
          Same-time full restore point + restart collapses into one serialized maintenance operation. Live snapshots remain on the separate Protocol 3 Host interval scheduler and all backup/maintenance work shares the Host operation lock. Keep unattended destructive schedules disabled until the intended live validation gates have been exercised.
        </p>
      </Panel>'''
if new in text:
    print("3.4.1 schedule collision copy already applied")
elif text.count(old) != 1:
    raise SystemExit(f"schedule copy: expected one match, found {text.count(old)}")
else:
    path.write_text(text.replace(old, new))
    print("3.4.1 schedule collision copy applied")
