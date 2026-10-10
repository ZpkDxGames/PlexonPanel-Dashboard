"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { advanceTickPulseWindow } from "../lib/tick-pulse-window";
import { useTelemetryNow } from "../lib/telemetry-clock";
import { capturedAtMillis } from "../lib/control-state";
import { DashboardShell } from "./shell";
import { useDashboardSession } from "./use-dashboard-session";

const Workspaces = dynamic(() => import("./workspaces").then(module => module.Workspaces), { ssr: false });

export default function Dashboard() {
  const model = useDashboardSession();
  const now = useTelemetryNow(model.state.updatedAt);
  const captured = capturedAtMillis(model.state.server.capturedAt);
  const [pulseFrame, setPulseFrame] = useState({serverId:model.state.serverId,capturedAt:captured,endAt:now});
  const nextFrame = advanceTickPulseWindow(pulseFrame, model.state.serverId, captured, now);
  if (nextFrame !== pulseFrame) setPulseFrame(nextFrame);
  const pulseWindowEndAt = nextFrame.endAt;
  const [painted, setPainted] = useState(false);
  const canPaint = model.phase !== "loading" && model.phase !== "unpaired" && !model.pairing;
  useEffect(() => {
    if (!canPaint) return;
    let second = 0;
    // Two frames give the shell a paint before initiating any workspace import.
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        performance.mark("ui6-shell-painted");
        setPainted(true);
      });
    });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [canPaint]);
  return <DashboardShell model={model} pulseReady={painted && canPaint} pulseWindowEndAt={pulseWindowEndAt}>{painted && canPaint ? <Workspaces model={model} pulseWindowEndAt={pulseWindowEndAt} /> : null}</DashboardShell>;
}
