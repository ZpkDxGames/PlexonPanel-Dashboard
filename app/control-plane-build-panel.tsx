"use client";

import { useEffect, useState } from "react";
import { loadControlPlaneBuilds, type ControlPlaneBuilds } from "../lib/build-identity";
import { Badge, Panel } from "./control-views";

function shortCommit(value: string | undefined): string {
  return value && /^[0-9a-f]{7,64}$/i.test(value) ? value.slice(0, 12) : "Unavailable";
}

export function ControlPlaneBuildPanel({
  paperVersion,
  hostVersion,
}: {
  paperVersion?: string;
  hostVersion?: string;
}) {
  const [builds, setBuilds] = useState<ControlPlaneBuilds | null>(null);

  useEffect(() => {
    let active = true;
    void loadControlPlaneBuilds().then((next) => {
      if (active) setBuilds(next);
    });
    return () => { active = false; };
  }, []);

  const status = builds?.status ?? "UNVERIFIED";
  const tone = status === "MATCHED" ? "cyan" : status === "MISMATCH" ? "red" : "amber";
  const label = status === "MATCHED" ? "Matched" : status === "MISMATCH" ? "Mismatch" : "Unverified";

  return (
    <Panel title="Control plane builds" aside={<Badge tone={tone}>{label}</Badge>}>
      <dl className="cr-details cr-pad">
        <div><dt>Dashboard build</dt><dd>{shortCommit(builds?.dashboard?.gitCommit)}</dd></div>
        <div><dt>Relay build</dt><dd>{shortCommit(builds?.relay?.gitCommit)}</dd></div>
        <div><dt>Relay runtime</dt><dd>{builds?.relay?.runtimeKind ?? "Unavailable"}</dd></div>
        <div><dt>Paper build</dt><dd>{paperVersion ?? "Unavailable"}</dd></div>
        <div><dt>Host build</dt><dd>{hostVersion ?? "Unavailable"}</dd></div>
        <div><dt>Protocol</dt><dd>{builds?.relay?.protocolVersion ?? builds?.dashboard?.protocolVersion ?? 3}</dd></div>
      </dl>
      <p className="cr-hint cr-pad">
        {builds?.message ?? "Checking Dashboard and relay build identity. Ready state remains unverified until both are visible."}
      </p>
    </Panel>
  );
}
