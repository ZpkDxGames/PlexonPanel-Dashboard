# Review risks and acceptance boundaries

| Area | Evidence and practical limit |
| --- | --- |
| Production state | Source and localhost tests only. Installed VPS versions, origin allowlist and live credentials were not inspected. |
| Runtime safety | Protected adapters, stores, scopes and original contract tests are unchanged. Live destructive/lifecycle/backup acceptance needs separate authorization. |
| Browser coverage | Headless Firefox 157 tested. Chromium, Safari, physical touch devices and screen readers remain unexecuted. |
| Telemetry | Honest gaps, independent clocks/epochs and missing values. Legacy metadata stays optional. No inferred distributions or fabricated history. |
| Performance | Focused view reduces active work; optional eight-signal comparison costs more CPU/replay time. Reported frame results are one synthetic container run, not a 60 fps certification. |
| Long sessions | Virtual 30-minute bounded reducer soak passed. No actual 24-hour connected or browser heap soak was executed. |
| Preview origin | A branch preview does not inherit production pairing or relay allowlisting. Do not widen live configuration without approval. |
| Visual acceptance | New structure is proven in rendered fixtures. Owner review of the final design remains a review gate. |

No server-side change is needed for this frontend. Production remains untouched.
