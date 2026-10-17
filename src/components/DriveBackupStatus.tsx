"use client";
import { useEffect, useState } from "react";
import { useSession } from "../hooks";
import { session } from "../adapter/session";
import { record, type JsonMap } from "../adapter/control-state";
import { useTimestamp } from "../presentation/nextgen/time";
export function DriveBackupStatus() {
  const snap = useSession(),
    stamp = useTimestamp(),
    [status, setStatus] = useState<JsonMap>({}),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setStatus({});
    const read = async () => {
      const reason = session.reason("maintenance.status", "HOST");
      if (reason) {
        if (active) {
          setStatus({});
          setError(reason);
        }
        return;
      }
      try {
        const response = await session.query("maintenance.status", {}, "HOST");
        if (active) {
          setStatus(record(response.data));
          setError("");
        }
      } catch {
        if (active) setError("Host backup evidence unavailable");
      }
    };
    void read();
    const timer = setInterval(() => {
      if (!document.hidden) void read();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [snap.revision, snap.phase]);
  const job = record(status.currentOperation),
    provider = record(status.provider),
    verified = job.remoteBackupVerified === true;
  return (
    <article className="stat-cell v5-kpi">
      <div className="stat-label">Google Drive backup</div>
      <div className="stat-reading">
        <strong>
          {error
            ? "Unavailable"
            : verified
              ? "Verified off-site"
              : job.phase === "DEGRADED"
                ? "Degraded"
                : provider.configured === true
                  ? "Configured"
                  : "Not reported"}
        </strong>
      </div>
      <small>
        {error ||
          (job.phase
            ? `Latest Host job: ${String(job.phase)}${job.phaseTimestamp ? ` · ${stamp(job.phaseTimestamp)}` : ""}`
            : "Awaiting durable Host evidence")}
      </small>
    </article>
  );
}
