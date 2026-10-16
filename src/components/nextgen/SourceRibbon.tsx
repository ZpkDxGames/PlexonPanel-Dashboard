import type { ControlState } from "../../adapter/control-state";
import { sourceEvidence } from "../../presentation/telemetry";
import { EvidenceDisclosure } from "./EvidenceDisclosure";
const sources = [
  ["paperHealth", "Paper runtime"],
  ["paperSystem", "Paper JVM"],
  ["service", "Minecraft service"],
  ["hostSystem", "Host node"],
] as const;
export function SourceRibbon({
  state,
  now,
}: {
  state: ControlState;
  now: number;
}) {
  return (
    <div className="source-ribbon" aria-label="Independent source evidence">
      {sources.map(([key, label]) => {
        const e = sourceEvidence(state, key, now);
        return (
          <EvidenceDisclosure key={key} label={`${label} · ${e.kind}`}>
            <dl>
              <dt>State</dt>
              <dd>{e.label}</dd>
              <dt>Capture</dt>
              <dd>{e.capturedAt ?? "Not received"}</dd>
              <dt>Receipt</dt>
              <dd>
                {e.receivedAt !== null
                  ? new Date(e.receivedAt).toISOString()
                  : "Not received"}
              </dd>
              <dt>Cadence</dt>
              <dd>{e.cadence === null ? "Not reported" : `${e.cadence} ms`}</dd>
            </dl>
          </EvidenceDisclosure>
        );
      })}
    </div>
  );
}
