"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useQuery,
  type ViewProps,
} from "./control-views";
import { ActionButton, Badge, Button, Empty, PageHeader, Panel, SourceFacts } from "./ui/workspace";
import { Disclosure } from "./ui/primitives";
import { record, str } from "../lib/control-state";
import { DASHBOARD_VERSION } from "../lib/dashboard-version";
import { operationText } from "../lib/operation-messages";
import {
  lifecycleActionAllowed,
  normalizeServiceState,
  type LifecycleAction,
  type ServiceState,
} from "../lib/lifecycle-state";

type PendingOperation = {
  action: LifecycleAction;
  phase: "requested" | "executing" | "waiting-paper" | "complete";
};

function stateTone(state: ServiceState) {
  if (state === "active") return "green";
  if (state === "activating" || state === "deactivating") return "cyan";
  if (state === "failed") return "amber";
  return "quiet";
}

function OperationTimeline({ pending }: { pending: PendingOperation }) {
  const steps = [
    { id: "requested", label: "Requested" },
    { id: "executing", label: "Waiting for Host result" },
    ...(pending.action === "start" || pending.action === "restart"
      ? [
          {
            id: "waiting-paper",
            label: "Waiting for authenticated Paper connection",
          },
        ]
      : []),
    { id: "complete", label: "Complete" },
  ] as const;
  const order = ["requested", "executing", "waiting-paper", "complete"];
  const current = order.indexOf(pending.phase);
  return (
    <div className="workspace-operation" aria-live="polite">
      {steps.map((step) => {
        const index = order.indexOf(step.id);
        const stepState =
          index < current ? "done" : index === current ? "current" : "next";
        return (
          <div key={step.id} data-state={stepState}>
            <span>
              {stepState === "done" ? "✓" : stepState === "current" ? "•" : "○"}
            </span>
            <strong>{step.label}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function ServerView(props: ViewProps) {
  const hostAvailable = Boolean(props.state.ready?.agents.host);
  const paperOnline = Boolean(props.state.ready?.agents.paper);
  const query = useQuery(
    "server.status",
    {},
    hostAvailable && props.can("server.status", "HOST"),
    "HOST",
  );
  const service = useMemo(
    () => ({ ...query.data, ...props.state.service }),
    [query.data, props.state.service],
  );
  // systemd lifecycle state is Host-owned. Paper connectivity is displayed
  // separately and must never be used to fabricate an active service state.
  const state = normalizeServiceState(service.state);
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [operationError, setOperationError] = useState("");

  const effectivePending =
    pending?.phase === "waiting-paper" && paperOnline
      ? { ...pending, phase: "complete" as const }
      : pending;

  useEffect(() => {
    if (effectivePending?.phase !== "complete") return;
    const timer = window.setTimeout(() => setPending(null), 3500);
    return () => window.clearTimeout(timer);
  }, [effectivePending?.phase, effectivePending?.action]);

  const runLifecycle = async (action: LifecycleAction) => {
    setOperationError("");
    setPending({ action, phase: "requested" });
    await Promise.resolve();
    setPending({ action, phase: "executing" });
    try {
      const result=await props.run(`server.${action}`, {}, "HOST");
      query.refresh();
      if ((action === "start" || action === "restart") && !paperOnline) {
        setPending({ action, phase: "waiting-paper" });
      } else {
        setPending({ action, phase: "complete" });
      }
      return result;
    } catch (error) {
      setPending(null);
      if (!(error instanceof Error && error.message === "Cancelled")) {
        setOperationError(operationText(error));
        query.refresh();
      }
      throw error;
    }
  };

  return (
    <section className="pp-workspace" data-ui6-workspace="Server">
      <PageHeader title="Server" description={`Host service: ${hostAvailable ? state : "unavailable"}. Paper is ${paperOnline ? "connected" : "disconnected"}.`}
        primary={<Button variant="primary" disabled={query.busy || !hostAvailable || !props.can("server.status", "HOST")} disabledReason="Requires server.status on the authenticated Host." busy={query.busy} onClick={query.refresh}>Refresh Host status</Button>}/>

      <div className="pp-data-grid">
      <Panel title="Connections" className="pp-stack">
        <dl className="pp-facts">
          <div><dt>Paper agent</dt><dd><Badge tone={paperOnline ? "green" : "quiet"}>{paperOnline ? "Connected" : "Disconnected"}</Badge><small>{props.state.ready?.server.pluginVersion ?? "Waiting for identity"}</small></dd></div>
          <div><dt>Host companion</dt><dd><Badge tone={hostAvailable ? "green" : "quiet"}>{hostAvailable ? "Connected" : "Disconnected"}</Badge><small>{props.state.ready?.agents.hostInstalled ? (props.state.ready?.server.hostVersion ?? "Disconnected") : "Not installed"}</small></dd></div>
          <div><dt>{str(service.service, "Server service")}</dt><dd><Badge tone={hostAvailable ? stateTone(state) : "quiet"}>{hostAvailable ? state : "Host unavailable"}</Badge><small>Host systemd lifecycle state</small></dd></div>
        </dl>

      </Panel>

      <Panel
        title="Lifecycle controls"
        aside={<Badge tone={hostAvailable ? stateTone(state) : "quiet"}>{hostAvailable ? state : "Host unavailable"}</Badge>}
      >
        <div className="pp-stack workspace-lifecycle-card">
          {state === "failed" && hostAvailable && (
            <div className="pp-notice">
              <strong>Service failed.</strong> Review host audit or systemd logs,
              then use Start only after the underlying cause is understood.
            </div>
          )}
          {(state === "activating" || state === "deactivating") && hostAvailable && (
            <div className="pp-notice">
              The service is {state}. Conflicting lifecycle actions are disabled
              until systemd reports a stable state.
            </div>
          )}
          {state === "unknown" && hostAvailable && (
            <div className="pp-notice">
              Host lifecycle state is unavailable. Refresh Host status before
              issuing a lifecycle action.
            </div>
          )}
          {!hostAvailable && (
            <Empty title="Host companion unavailable">
              Server start, graceful stop and restart require the authenticated
              Host companion. Paper monitoring can remain live independently.
            </Empty>
          )}
          <div className="pp-row">
            <ActionButton
              disabled={
                !hostAvailable ||
                !props.can("server.start", "HOST") ||
                !lifecycleActionAllowed("start", state) ||
                pending !== null
              }
              disabledReason={!hostAvailable ? "Requires the authenticated Host." : pending ? "Wait for this operation to finish." : state === "unknown" ? "Refresh Host status first." : "Unavailable for this service state or device grant."}
              onClick={() => runLifecycle("start")}
            >
              Start server
            </ActionButton>
            <ActionButton
              danger
              disabled={
                !hostAvailable ||
                !props.can("server.stop", "HOST") ||
                !lifecycleActionAllowed("stop", state) ||
                pending !== null
              }
              disabledReason={!hostAvailable ? "Requires the authenticated Host." : pending ? "Wait for this operation to finish." : state === "unknown" ? "Refresh Host status first." : "Unavailable for this service state or device grant."}
              onClick={() => runLifecycle("stop")}
            >
              Stop server
            </ActionButton>
            <ActionButton
              danger
              disabled={
                !hostAvailable ||
                !props.can("server.restart", "HOST") ||
                !lifecycleActionAllowed("restart", state) ||
                pending !== null
              }
              disabledReason={!hostAvailable ? "Requires the authenticated Host." : pending ? "Wait for this operation to finish." : state === "unknown" ? "Refresh Host status first." : "Unavailable for this service state or device grant."}
              onClick={() => runLifecycle("restart")}
            >
              Restart server
            </ActionButton>
          </div>
          <p className="pp-muted">Graceful stop saves the world before shutting down. Start and restart can finish on the Host while Paper is still connecting.</p>
          {effectivePending && <OperationTimeline pending={effectivePending} />}
          {operationError && (
            <p className="pp-notice" role="alert">{operationError}</p>
          )}
          {query.error && (
            <p className="pp-notice" role="alert">
              {query.error}
            </p>
          )}
        </div>
      </Panel>
      </div>

      <Disclosure title="Runtime and version details">
      <SourceFacts source="Host systemd / Paper runtime" unit="state and runtime identity" capturedAt={record(props.state.service.resources).capturedAt} receivedAt={props.state.receipts?.service}/>
      <Panel title="Runtime details">
        <dl className="pp-facts">
          {[
            ["Host service", hostAvailable ? service.service : undefined],
            ["Host service state", hostAvailable ? state : undefined],
            ["Host service PID", hostAvailable ? service.pid : undefined],
            ["Host operating system", hostAvailable ? props.state.hostSystem.operatingSystem : undefined],
            ["Host architecture", hostAvailable ? props.state.hostSystem.architecture : undefined],
            ["Paper Java", paperOnline ? props.state.system.javaVersion : undefined],
            ["Paper operating system", paperOnline ? props.state.system.operatingSystem : undefined],
            ["Paper architecture", paperOnline ? props.state.system.architecture : undefined],
            ["Minecraft", props.state.ready?.server.minecraftVersion],
            ["Paper agent", props.state.ready?.server.pluginVersion],
            ["Host agent", props.state.ready?.server.hostVersion],
            ["Dashboard", DASHBOARD_VERSION],
            ["Protocol", "3"],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{String(value ?? "Unavailable")}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      </Disclosure>
    </section>
  );
}
