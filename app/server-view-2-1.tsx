"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  Agent,
  Badge,
  Empty,
  Panel,
  useQuery,
  type ViewProps,
} from "./control-views";
import { str } from "../lib/control-state";
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
    { id: "executing", label: "Executing on host" },
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
    <div className="cr21-operation" aria-live="polite">
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

export function ServerView21(props: ViewProps) {
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
  const state = normalizeServiceState(service.state, false);
  const [pending, setPending] = useState<PendingOperation | null>(null);

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
    setPending({ action, phase: "requested" });
    await Promise.resolve();
    setPending({ action, phase: "executing" });
    try {
      await props.run(`server.${action}`, {}, "HOST");
      query.refresh();
      if ((action === "start" || action === "restart") && !paperOnline) {
        setPending({ action, phase: "waiting-paper" });
      } else {
        setPending({ action, phase: "complete" });
      }
    } catch (error) {
      setPending(null);
      throw error;
    }
  };

  return (
    <>
      <div className="cr21-page-toolbar">
        <div>
          <strong>Server lifecycle</strong>
          <span>
            systemd state and lifecycle actions are Host-authoritative and locally policy-gated.
          </span>
        </div>
        <button
          className="cr-button"
          disabled={query.busy || !hostAvailable || !props.can("server.status", "HOST")}
          onClick={query.refresh}
        >
          {query.busy ? "Refreshing…" : "Refresh Host status"}
        </button>
      </div>

      <Panel title="Infrastructure" className="cr21-status-panel">
        <div className="cr21-status-strip">
          <Agent
            name="Paper agent"
            online={paperOnline}
            detail={
              props.state.ready?.server.pluginVersion ?? "Waiting for identity"
            }
          />
          <Agent
            name="Host companion"
            online={hostAvailable}
            detail={
              props.state.ready?.agents.hostInstalled
                ? (props.state.ready?.server.hostVersion ?? "Disconnected")
                : "Not installed"
            }
          />
          <div className="cr21-status-item">
            <span className={`cr-dot ${hostAvailable && state === "active" ? "online" : ""}`} />
            <div>
              <strong>{str(service.service, "Server service")}</strong>
              <small>Host systemd lifecycle state</small>
            </div>
            <Badge tone={hostAvailable ? stateTone(state) : "quiet"}>
              {hostAvailable ? state : "Host unavailable"}
            </Badge>
          </div>
        </div>
      </Panel>

      <Panel
        title="Lifecycle controls"
        aside={<Badge tone={hostAvailable ? stateTone(state) : "quiet"}>{hostAvailable ? state : "Host unavailable"}</Badge>}
      >
        <div className="cr21-lifecycle-card">
          {state === "failed" && hostAvailable && (
            <div className="cr21-state-banner danger">
              <strong>Service failed.</strong> Review host audit or systemd logs,
              then use Start only after the underlying cause is understood.
            </div>
          )}
          {(state === "activating" || state === "deactivating") && hostAvailable && (
            <div className="cr21-state-banner">
              The service is {state}. Conflicting lifecycle actions are disabled
              until systemd reports a stable state.
            </div>
          )}
          {state === "unknown" && hostAvailable && (
            <div className="cr21-state-banner">
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
          <div className="cr21-lifecycle-actions">
            <ActionButton
              disabled={
                !hostAvailable ||
                !props.can("server.start", "HOST") ||
                !lifecycleActionAllowed("start", state) ||
                pending !== null
              }
              onClick={() => runLifecycle("start")}
            >
              Start
            </ActionButton>
            <ActionButton
              danger
              disabled={
                !hostAvailable ||
                !props.can("server.stop", "HOST") ||
                !lifecycleActionAllowed("stop", state) ||
                pending !== null
              }
              onClick={() => runLifecycle("stop")}
            >
              Graceful stop
            </ActionButton>
            <ActionButton
              danger
              disabled={
                !hostAvailable ||
                !props.can("server.restart", "HOST") ||
                !lifecycleActionAllowed("restart", state) ||
                pending !== null
              }
              onClick={() => runLifecycle("restart")}
            >
              Restart
            </ActionButton>
          </div>
          <dl className="cr21-lifecycle-rules">
            <div><dt>Active</dt><dd>Start disabled · Stop enabled · Restart enabled</dd></div>
            <div><dt>Inactive</dt><dd>Start enabled · Stop disabled · Restart disabled</dd></div>
            <div><dt>Transitioning</dt><dd>Conflicting lifecycle actions disabled</dd></div>
          </dl>
          {effectivePending && <OperationTimeline pending={effectivePending} />}
          {query.error && (
            <p className="cr-alert" role="alert">
              {query.error}
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Runtime details">
        <dl className="cr-details cr-pad">
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
            ["Dashboard", "3.0.1"],
            ["Protocol", "3"],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{String(value ?? "Unavailable")}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
