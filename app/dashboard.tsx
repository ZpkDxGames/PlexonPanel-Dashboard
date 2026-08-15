"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadDashboardSession,
  logoutDashboard,
  pairDashboardServer,
  requestLiveConnection,
  sendDashboardAction,
} from "../lib/data-source";
import type { ActivityEvent, DashboardWorkspace, TimelinePoint } from "../lib/dashboard-types";
import {
  applyConnectionStatus,
  applyGatewayEvent,
  transformGatewayState,
} from "../lib/transform-state";
import ManagementViews from "./management-views";

type Section = "overview" | "players" | "console" | "chat" | "plugins" | "security";
type AccessState = "loading" | "unpaired" | "ready" | "unavailable";
type TransportState = "connecting" | "live" | "reconnecting" | "unavailable";

const navigation: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "players", label: "Players", icon: "users" },
  { id: "console", label: "Console", icon: "terminal" },
  { id: "chat", label: "Global chat", icon: "chat" },
  { id: "plugins", label: "Plugins", icon: "puzzle" },
  { id: "security", label: "Security", icon: "shield" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    terminal: <><path d="m4 17 6-5-6-5" /><path d="M12 19h8" /></>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    puzzle: <path d="M19.4 15a1.7 1.7 0 0 0 0-3.4H17V9.2a1.7 1.7 0 1 0-3.4 0V11H10V7.4a1.7 1.7 0 1 0-3.4 0V11H3v6h3.6v-1.2a1.7 1.7 0 1 1 3.4 0V19h7v-4Z" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function PairCodeForm({ onPaired, compact = false }: { onPaired: () => Promise<void>; compact?: boolean }) {
  const [pairingCode, setPairingCode] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState("");
  const isValid = /^\d{6}$/.test(pairingCode);

  async function submitPairing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || isWaiting) return;
    setIsWaiting(true);
    setError("");
    try {
      await pairDashboardServer(pairingCode);
      await onPaired();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The server could not be paired.");
      setIsWaiting(false);
    }
  }

  return (
    <form className={compact ? "pair-form compact-form" : "pair-form"} onSubmit={submitPairing}>
      <label htmlFor={compact ? "modal-pairing-code" : "pairing-code"}>Six-digit pairing code</label>
      <input
        id={compact ? "modal-pairing-code" : "pairing-code"}
        className="pair-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={pairingCode}
        onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-invalid={Boolean(error)}
        autoFocus
      />
      {error && <p className="pair-error" role="alert">{error}</p>}
      <button className="primary-button pair-submit" type="submit" disabled={!isValid || isWaiting}>
        {isWaiting ? <><span className="button-spinner" /> Verifying secure link</> : <>Open dashboard <Icon name="arrow" /></>}
      </button>
    </form>
  );
}

function PairingScreen({ onPaired, unavailable, onRetry }: { onPaired: () => Promise<void>; unavailable: boolean; onRetry: () => void }) {
  return (
    <main className="access-screen">
      <section className="access-brand-panel">
        <a className="brand access-brand" href="#pairing-code"><span className="brand-mark">P</span><span className="brand-name">Plexon<span>Panel</span></span></a>
        <div className="access-copy">
          <p className="eyebrow">Paper server command center</p>
          <h1>Your server, securely within reach.</h1>
          <p>Pair this browser directly with the cryptographic identity stored by your PlexonPanel plugin.</p>
        </div>
        <div className="access-security-list">
          <span><i>1</i>Run <code>/plexonpanel pair</code> from the server console.</span>
          <span><i>2</i>Enter the temporary code generated by the plugin.</span>
          <span><i>3</i>This browser becomes an authorized device for that server.</span>
        </div>
        <p className="access-footnote">The plugin private key and your dashboard session never enter browser storage.</p>
      </section>
      <section className="access-form-panel">
        <div className="access-card">
          <span className="access-emblem" aria-hidden="true"><i /></span>
          <p className="eyebrow">Secure access</p>
          <h2>Pair your Paper server</h2>
          <p>The code expires after five minutes and can be used only once.</p>
          {unavailable ? (
            <div className="access-unavailable" role="alert"><strong>Gateway temporarily unavailable</strong><span>Check the gateway deployment and try again.</span><button className="secondary-button" onClick={onRetry}>Retry connection</button></div>
          ) : <PairCodeForm onPaired={onPaired} />}
          <div className="modal-note"><span className="note-dot" />Protected by signed Ed25519 server identity.</div>
        </div>
      </section>
    </main>
  );
}

function PairServerModal({ onClose, onPaired }: { onClose: () => void; onPaired: () => Promise<void> }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="pair-modal" role="dialog" aria-modal="true" aria-labelledby="pair-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <div className="modal-emblem" aria-hidden="true"><span /></div>
        <p className="eyebrow">Secure connection</p>
        <h2 id="pair-title">Pair another Paper server</h2>
        <p className="modal-copy">Run <code>/plexonpanel pair</code> in that server console, then enter its one-time code.</p>
        <PairCodeForm onPaired={onPaired} compact />
        <div className="modal-note"><span className="note-dot" />The new pairing becomes this browser&apos;s active workspace.</div>
      </section>
    </div>
  );
}

function Sparkline({ points }: { points: TimelinePoint[] }) {
  const plotted = useMemo(() => {
    const safe = points.length > 1 ? points : points.length === 1 ? [points[0]!, points[0]!] : [{ label: "Now", value: 0 }, { label: "Now", value: 0 }];
    const min = Math.min(...safe.map((point) => point.value)) - 0.03;
    const max = Math.max(...safe.map((point) => point.value)) + 0.02;
    return safe.map((point, index) => {
      const x = (index / Math.max(safe.length - 1, 1)) * 100;
      const y = 78 - ((point.value - min) / Math.max(max - min, 0.01)) * 56;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }, [points]);
  return (
    <div className="chart" aria-label="TPS performance history">
      <div className="chart-grid" aria-hidden="true"><span /><span /><span /></div>
      <svg viewBox="0 0 100 88" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="tps-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6ee7d7" stopOpacity="0.28" /><stop offset="100%" stopColor="#6ee7d7" stopOpacity="0" /></linearGradient></defs><polygon points={`0,88 ${plotted} 100,88`} fill="url(#tps-fill)" /><polyline points={plotted} className="chart-line-glow" /><polyline points={plotted} className="chart-line" /></svg>
      <div className="chart-axis" aria-hidden="true"><span>{points[0]?.label ?? "Waiting"}</span><span>{points[Math.floor(points.length / 2)]?.label ?? "for"}</span><span>{points[points.length - 1]?.label ?? "data"}</span></div>
    </div>
  );
}

function ActivityMarker({ category }: { category: ActivityEvent["category"] }) {
  return <span className={`activity-marker ${category}`}>{({ player: "P", plugin: "◆", system: "↻", security: "S" })[category]}</span>;
}

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [sectionStorageReady, setSectionStorageReady] = useState(false);
  const [workspace, setWorkspace] = useState<DashboardWorkspace | null>(null);
  const [access, setAccess] = useState<AccessState>("loading");
  const [transport, setTransport] = useState<TransportState>("connecting");
  const [showPairing, setShowPairing] = useState(false);

  const refreshSession = useCallback(async () => {
    setAccess("loading");
    try {
      const session = await loadDashboardSession();
      if (!session.authenticated || !session.state) {
        setWorkspace(null);
        setAccess("unpaired");
        return;
      }
      setWorkspace(transformGatewayState(session.state));
      setAccess("ready");
    } catch {
      setAccess("unavailable");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("plexonpanel.active-section");
      if (navigation.some((item) => item.id === stored)) setActiveSection(stored as Section);
      setSectionStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (sectionStorageReady) window.localStorage.setItem("plexonpanel.active-section", activeSection);
  }, [activeSection, sectionStorageReady]);

  useEffect(() => {
    if (access !== "ready") return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = async () => {
      setTransport(attempts ? "reconnecting" : "connecting");
      try {
        const grant = await requestLiveConnection();
        if (cancelled) return;
        socket = new WebSocket(grant.websocketUrl, ["plexonpanel-v2", `auth.${grant.token}`]);
        socket.onopen = () => { attempts = 0; setTransport("live"); };
        socket.onmessage = (event) => {
          let message: Record<string, unknown>;
          try { message = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
          if (message.type === "dashboard.ready") {
            setWorkspace(transformGatewayState({
              ...record(message.persisted),
              liveState: record(message.liveState),
              connectionStatus: message.connectionStatus,
            }));
          } else if (message.type === "server.event" && typeof message.eventType === "string") {
            setWorkspace((current) => current ? applyGatewayEvent(current, message.eventType as string, record(message.body)) : current);
          } else if (message.type === "server.connection") {
            setWorkspace((current) => current ? applyConnectionStatus(current, message.connectionStatus === "online" ? "online" : "offline") : current);
          } else if (message.type === "server.unpaired") {
            void logoutDashboard().finally(() => { setWorkspace(null); setAccess("unpaired"); });
          }
        };
        socket.onclose = () => {
          if (cancelled) return;
          setTransport("reconnecting");
          attempts += 1;
          retryTimer = setTimeout(() => void connect(), Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5)));
        };
      } catch {
        if (cancelled) return;
        setTransport("unavailable");
        attempts += 1;
        retryTimer = setTimeout(() => void connect(), Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5)));
      }
    };
    void connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close(1000, "Dashboard navigation");
    };
  }, [access]);

  async function finishPairing() {
    setShowPairing(false);
    await refreshSession();
  }

  async function signOut() {
    try {
      await logoutDashboard();
    } finally {
      setWorkspace(null);
      setAccess("unpaired");
    }
  }

  if (access === "loading") return <main className="loading-screen"><div className="brand-mark large" aria-hidden="true">P</div><span>Verifying your secure workspace</span></main>;
  if (access === "unpaired" || access === "unavailable") return <PairingScreen onPaired={finishPairing} unavailable={access === "unavailable"} onRetry={() => void refreshSession()} />;
  if (!workspace) return null;

  const { overview, management } = workspace;
  const live = transport === "live" && overview.server.status === "online";
  const transportLabel = live ? "Live" : transport === "reconnecting" ? "Reconnecting" : overview.server.status === "offline" ? "Server offline" : "Connecting";
  const currentTps = overview.stats[0]?.value ?? "—";

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="#main" aria-label="PlexonPanel home"><span className="brand-mark">P</span><span className="brand-name">Plexon<span>Panel</span></span></a>
        <nav className="primary-nav" aria-label="Dashboard navigation"><p className="nav-caption">Workspace</p>{navigation.map((item) => <button key={item.id} className={`nav-item ${activeSection === item.id ? "active" : ""}`} onClick={() => setActiveSection(item.id)} aria-current={activeSection === item.id ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span>{item.id === "players" && <b>{management.players.length}</b>}</button>)}</nav>
        <div className="sidebar-footer">
          <div className={`connection-card ${live ? "connected" : ""}`}><span className="status-beacon"><i /></span><div><strong>Gateway {transportLabel.toLowerCase()}</strong><span>{overview.server.lastSeen}</span></div></div>
          <button className="profile-button" onClick={() => void signOut()} aria-label="Sign out of this dashboard device"><span className="avatar">ZD</span><span className="profile-copy"><strong>Administrator</strong><small>Sign out device</small></span><span className="more-dots">•••</span></button>
        </div>
      </aside>

      <main className="main-area" id="main">
        <header className="topbar">
          <div className="server-switcher" aria-label="Active server"><span className="server-cube" aria-hidden="true"><i /></span><span><small>Active server</small><strong>{overview.server.name}</strong></span></div>
          <div className="topbar-actions"><span className={`connection-pill ${live ? "live" : ""}`}><i /> {transportLabel}</span><button className="primary-button compact" onClick={() => setShowPairing(true)}><Icon name="plus" /> Pair server</button></div>
        </header>

        <div className="page-content">
          {activeSection !== "overview" ? (
            <ManagementViews section={activeSection} data={management} onPairServer={() => setShowPairing(true)} onAction={sendDashboardAction} />
          ) : (
            <>
              <section className="welcome-row"><div><p className="eyebrow">Command center</p><h1>Welcome back, Administrator.</h1><p>Here is what is happening across your Paper server right now.</p></div><div className={`server-health ${overview.server.status}`}><span className={`health-pulse ${overview.server.status === "online" ? "online" : ""}`}><i /></span><div><span>Server status</span><strong>{overview.server.status === "online" ? "Online" : "Offline"}</strong></div><div className="health-divider" /><div><span>Runtime</span><strong>{overview.server.platform} {overview.server.version}</strong></div></div></section>
              <section className="stats-grid" aria-label="Live server statistics">{overview.stats.map((stat, index) => <article className="stat-card" key={stat.label}><div className={`stat-orb orb-${index + 1}`} aria-hidden="true"><span>{stat.label === "TPS" ? "T" : stat.label === "MSPT" ? "ms" : stat.label === "Players" ? "P" : "↑"}</span></div><div className="stat-copy"><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.tone}><i />{stat.detail}</small></div><button className="card-link" aria-label={`View ${stat.label} details`} onClick={() => setActiveSection(stat.label === "Players" ? "players" : "security")}><Icon name="chevron" /></button></article>)}</section>
              <section className="dashboard-grid">
                <article className="panel performance-panel"><div className="panel-heading"><div><p className="eyebrow">Performance</p><h2>TPS history</h2></div><div className="chart-legend"><span><i /> Live TPS</span><em>Current session</em></div></div><div className="chart-summary"><strong>{currentTps}</strong><span>Current TPS</span><b className={overview.server.status === "online" ? "online" : ""}>{overview.server.status === "online" ? "Connected" : "Last known"}</b></div><Sparkline points={overview.tpsHistory} /></article>
                <article className="panel resources-panel"><div className="panel-heading"><div><p className="eyebrow">Host machine</p><h2>Resource usage</h2></div><span className="live-badge"><i /> {overview.server.status === "online" ? "Live" : "Stored"}</span></div><div className="resource-list">{overview.resources.map((resource) => <div className="resource" key={resource.label}><div className="resource-heading"><span>{resource.label}</span><strong>{resource.displayValue}</strong></div><div className="progress-track"><span className={resource.tone} style={{ width: `${resource.value}%` }} /></div><small>{resource.detail}<b>{resource.value}% used</b></small></div>)}</div><button className="text-button" onClick={() => setActiveSection("security")}>Open security details <Icon name="arrow" /></button></article>
                <article className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Live feed</p><h2>Recent activity</h2></div><button className="secondary-button small" onClick={() => setActiveSection("security")}>View audit</button></div><div className="activity-list">{overview.activity.map((event) => <div className="activity-item" key={event.id}><ActivityMarker category={event.category} /><div><strong>{event.title}</strong><span>{event.detail}</span></div><time>{event.time}</time></div>)}</div></article>
              </section>
            </>
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile dashboard navigation">{navigation.slice(0, 5).map((item) => <button key={item.id} className={activeSection === item.id ? "active" : ""} onClick={() => setActiveSection(item.id)} aria-label={item.label}><Icon name={item.icon} /><span>{item.id === "chat" ? "Chat" : item.label}</span></button>)}</nav>
      {showPairing && <PairServerModal onClose={() => setShowPairing(false)} onPaired={finishPairing} />}
    </div>
  );
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
