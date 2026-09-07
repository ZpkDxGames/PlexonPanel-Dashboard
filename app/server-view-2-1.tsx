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
        const state =
          index < current ? "done" : index === current ? "current" : "next";
        return (
          <div key={step.id} data-state={state}>
            <span>
              {state === "done" ? "✓" : state === "current" ? "•" : "○"}
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
  const kind = hostAvailable ? "HOST" : "PAPER";
  const query = useQuery(
    "server.status",
    {},
    props.can("server.status", kind),
    kind,
  );
  const service = useMemo(
    () => ({ ...query.data, ...props.state.service }),
    [query.data, props.state.service],
  );
  const state = normalizeServiceState(service.state, paperOnline);
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
            Actions are gated by actual service state and local host policy.
          </span>
        </div>
        <button
          className="cr-button"
          disabled={query.busy}
          onClick={query.refresh}
        >
          {query.busy ? "Refreshing…" : "Refresh status"}
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
            <span className={`cr-dot ${state === "active" ? "online" : ""}`} />
            <div>
              <strong>{str(service.service, "Server service")}</strong>
              <small>systemd lifecycle state</small>
            </div>
            <Badge tone={stateTone(state)}>{state}</Badge>
          </div>
        </div>
      </Panel>

      <Panel
        title="Lifecycle controls"
        aside={<Badge tone={stateTone(state)}>{state}</Badge>}
      >
        <div className="cr21-lifecycle-card">
          {state === "failed" && (
            <div className="cr21-state-banner danger">
              <strong>Service failed.</strong> Review host audit or systemd logs,
              then use Start only after the underlying cause is understood.
            </div>
          )}
          {(state === "activating" || state === "deactivating") && (
            <div className="cr21-state-banner">
              The service is {state}. Conflicting lifecycle actions are disabled
              until systemd reports a stable state.
            </div>
          )}
          {state === "unknown" && (
            <div className="cr21-state-banner">
              Lifecycle state is unavailable. Refresh server status before
              issuing a host action.
            </div>
          )}
          {!hostAvailable && (
            <Empty title="Host companion unavailable">
              Server start, graceful stop, restart, and backups require the
              authenticated Host companion. Paper monitoring remains available.
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
            <div>
              <dt>Active</dt>
              <dd>Start disabled · Stop enabled · Restart enabled</dd>
            </div>
            <div>
              <dt>Inactive</dt>
              <dd>Start enabled · Stop disabled · Restart disabled</dd>
            </div>
            <div>
              <dt>Transitioning</dt>
              <dd>Conflicting lifecycle actions disabled</dd>
            </div>
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
            ["Service", service.service],
            ["State", state],
            ["PID", service.pid],
            ["Java", props.state.system.javaVersion],
            ["Operating system", props.state.system.operatingSystem],
            ["Architecture", props.state.system.architecture],
            ["Minecraft", props.state.ready?.server.minecraftVersion],
            ["Paper agent", props.state.ready?.server.pluginVersion],
            ["Host agent", props.state.ready?.server.hostVersion],
            ["Dashboard", "2.2.0"],
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
