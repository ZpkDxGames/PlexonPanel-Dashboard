"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  duration,
  fmt,
  gib,
  time,
  useActiveServer,
  useControl,
  useNow,
  usePrefs,
} from "../bindings";
import { Pane, Title } from "../routes/shared";
import { bedrockContainerView, bedrockLogsView } from "./edition";

function useBedrockEvidence() {
  const { state, phase } = useControl();
  return {
    room: state.bedrock,
    connected: phase === "live" && state.ready?.agents.host === true,
    now: useNow(),
  };
}

function BedrockConsole() {
  const { room, connected, now } = useBedrockEvidence();
  const logs = bedrockLogsView(room, connected, now);
  const { timezone } = usePrefs();
  const [filter, setFilter] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const lines = logs?.lines.filter((line) =>
    line.content.toLowerCase().includes(filter.toLowerCase()),
  );
  const lastId = lines?.at(-1)?.id;
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [lastId]);
  return (
    <section className="pp-ide" aria-label="Bedrock console">
      <div className="pp-ide-bar">
        <strong>Bedrock console</strong>
        <span className="muted">
          {logs?.available
            ? "Recent Docker logs"
            : "Docker log feed unavailable"}
        </span>
      </div>
      <div className="pp-console-toolbar">
        <input
          aria-label="Filter Bedrock logs"
          placeholder="Filter logs…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      <div className="pp-console" data-mode="full" data-wrap="true">
        <div
          className="pp-console-scroll pp-well"
          ref={scroll}
          tabIndex={0}
          role="log"
          aria-label="Bedrock Docker logs"
          aria-live="off"
          onScroll={(event) => {
            const element = event.currentTarget;
            follow.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              48;
          }}
        >
          {lines?.length ? (
            lines.map((line) => (
              <div className="pp-crow pp-bedrock-log" key={line.id}>
                <time className="pp-crow__t" dateTime={line.timestamp}>
                  {time(line.timestamp, timezone)}
                </time>
                <span className="pp-crow__msg">{line.content}</span>
              </div>
            ))
          ) : (
            <div className="pp-empty">
              {logs?.available
                ? filter
                  ? "No matching log lines"
                  : "No recent log lines"
                : "No current log window is available"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function BedrockWorkspace({ path }: { path: string }) {
  const { room, connected, now } = useBedrockEvidence();
  const server = useActiveServer();
  if (path === "/console") return <BedrockConsole key={server.id} />;
  if (path !== "/overview" && path !== "/performance") {
    return (
      <div className="pp-page">
        <Pane
          title={
            path === "/players"
              ? "Players"
              : path === "/backups"
                ? "Backups"
                : "Access & audit"
          }
        >
          <p className="pad muted">
            {path === "/access"
              ? "Your device was enrolled through the relay administrator. Device administration is available through the relay."
              : "This capability is unavailable for Bedrock."}
          </p>
        </Pane>
      </div>
    );
  }
  const evidence = bedrockContainerView(room, connected, now);
  const cells = [
    ["Container state", evidence.state ?? "Unavailable"],
    [
      "Container CPU",
      evidence.cpuPercent == null ? "—" : fmt(evidence.cpuPercent) + "%",
    ],
    [
      "Container RAM",
      evidence.memoryLimitBytes == null
        ? gib(evidence.memoryBytes)
        : gib(evidence.memoryBytes) + " / " + gib(evidence.memoryLimitBytes),
    ],
    ["Container uptime", duration(evidence.uptimeMs)],
    ["Server version", evidence.version ?? "—"],
    [
      "Gameplay readiness",
      evidence.gameplayReady == null
        ? "Unverified"
        : evidence.gameplayReady
          ? "Ready"
          : "Unavailable",
    ],
    ["Players", "—"],
    [
      "Status sample",
      evidence.ageMs == null
        ? "Unavailable"
        : `${Math.floor(evidence.ageMs / 1_000)}s ago`,
    ],
  ];
  return (
    <div className="pp-page">
      <Title
        code="Minecraft Bedrock"
        title={server.name}
        detail="Container status and resources from Docker Engine. CPU uses 100% per core."
        actions={
          <Link href="/console" className="pp-ctl">
            Open console
          </Link>
        }
      />
      <Pane title="Container telemetry">
        <dl className="pp-bedrock-signals">
          {cells.map(([label, value]) => (
            <div key={label} className="pp-cell">
              <dt className="pp-kicker">{label}</dt>
              <dd className="pp-num">{value}</dd>
            </div>
          ))}
        </dl>
      </Pane>
    </div>
  );
}
