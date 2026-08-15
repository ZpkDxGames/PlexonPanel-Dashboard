"use client";

import { useEffect, useMemo, useState } from "react";
import { demoDataSource } from "../lib/data-source";
import type { ActivityEvent, DashboardOverview, TimelinePoint } from "../lib/dashboard-types";
import ManagementViews from "./management-views";

type Section = "overview" | "players" | "console" | "chat" | "plugins" | "security";

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

function Sparkline({ points }: { points: TimelinePoint[] }) {
  const plotted = useMemo(() => {
    const min = Math.min(...points.map((point) => point.value)) - 0.03;
    const max = Math.max(...points.map((point) => point.value)) + 0.02;
    return points.map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 78 - ((point.value - min) / (max - min)) * 56;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }, [points]);

  return (
    <div className="chart" aria-label="TPS performance over the last hour">
      <div className="chart-grid" aria-hidden="true"><span /><span /><span /></div>
      <svg viewBox="0 0 100 88" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="tps-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6ee7d7" stopOpacity="0.28" /><stop offset="100%" stopColor="#6ee7d7" stopOpacity="0" /></linearGradient></defs>
        <polygon points={`0,88 ${plotted} 100,88`} fill="url(#tps-fill)" />
        <polyline points={plotted} className="chart-line-glow" />
        <polyline points={plotted} className="chart-line" />
      </svg>
      <div className="chart-axis" aria-hidden="true"><span>{points[0]?.label}</span><span>{points[Math.floor(points.length / 2)]?.label}</span><span>{points[points.length - 1]?.label}</span></div>
    </div>
  );
}

function ActivityMarker({ category }: { category: ActivityEvent["category"] }) {
  const glyph = { player: "P", plugin: "◆", system: "↻", security: "S" }[category];
  return <span className={`activity-marker ${category}`}>{glyph}</span>;
}

function PairServerModal({ onClose }: { onClose: () => void }) {
  const [pairingCode, setPairingCode] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const isValid = /^\d{6}$/.test(pairingCode);

  function submitPairing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isValid) setIsWaiting(true);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="pair-modal" role="dialog" aria-modal="true" aria-labelledby="pair-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <div className="modal-emblem" aria-hidden="true"><span /></div>
        <p className="eyebrow">Secure connection</p>
        <h2 id="pair-title">Pair a Paper server</h2>
        <p className="modal-copy">Run <code>/plexonpanel pair</code> in your server console, then enter the one-time code shown there.</p>
        <form onSubmit={submitPairing}>
          <label htmlFor="pairing-code">Six-digit pairing code</label>
          <input id="pairing-code" className="pair-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
          <button className="primary-button pair-submit" type="submit" disabled={!isValid}>
            {isWaiting ? <><span className="button-spinner" /> Waiting for server</> : <>Pair server <Icon name="arrow" /></>}
          </button>
        </form>
        <div className="modal-note"><span className="note-dot" />Preview mode validates the flow without storing your code.</div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [showPairing, setShowPairing] = useState(false);

  useEffect(() => { demoDataSource.getOverview().then(setOverview); }, []);

  if (!overview) {
    return <main className="loading-screen"><div className="brand-mark large" aria-hidden="true">P</div><span>Preparing your command center</span></main>;
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="#main" aria-label="PlexonPanel home"><span className="brand-mark">P</span><span className="brand-name">Plexon<span>Panel</span></span></a>
        <nav className="primary-nav" aria-label="Dashboard navigation">
          <p className="nav-caption">Workspace</p>
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${activeSection === item.id ? "active" : ""}`} onClick={() => setActiveSection(item.id)} aria-current={activeSection === item.id ? "page" : undefined}>
              <Icon name={item.icon} /><span>{item.label}</span>{item.id === "players" && <b>84</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="connection-card"><span className="status-beacon"><i /></span><div><strong>Gateway preview</strong><span>Not connected yet</span></div></div>
          <button className="profile-button" aria-label="Open profile menu"><span className="avatar">ZD</span><span className="profile-copy"><strong>Administrator</strong><small>Owner</small></span><span className="more-dots">•••</span></button>
        </div>
      </aside>

      <main className="main-area" id="main">
        <header className="topbar">
          <button className="server-switcher" aria-label="Choose a server"><span className="server-cube" aria-hidden="true"><i /></span><span><small>Active server</small><strong>{overview.server.name}</strong></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button>
          <div className="topbar-actions"><span className="demo-pill"><i /> Preview data</span><button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" /><span /></button><button className="primary-button compact" onClick={() => setShowPairing(true)}><Icon name="plus" /> Pair server</button></div>
        </header>

        <div className="page-content">
          {activeSection !== "overview" ? (
            <ManagementViews section={activeSection} onPairServer={() => setShowPairing(true)} />
          ) : (
            <>
              <section className="welcome-row">
                <div><p className="eyebrow">Command center</p><h1>Good evening, Administrator.</h1><p>Here is what is happening across your server right now.</p></div>
                <div className="server-health"><span className="health-pulse"><i /></span><div><span>Data status</span><strong>Preview</strong></div><div className="health-divider" /><div><span>Runtime</span><strong>{overview.server.platform} {overview.server.version}</strong></div></div>
              </section>
              <section className="stats-grid" aria-label="Preview server statistics">
                {overview.stats.map((stat, index) => (
                  <article className="stat-card" key={stat.label}><div className={`stat-orb orb-${index + 1}`} aria-hidden="true"><span>{stat.label === "TPS" ? "T" : stat.label === "MSPT" ? "ms" : stat.label === "Players" ? "P" : "↑"}</span></div><div className="stat-copy"><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.tone}><i />{stat.detail}</small></div><button className="card-link" aria-label={`View ${stat.label} details`}><Icon name="chevron" /></button></article>
                ))}
              </section>

              <section className="dashboard-grid">
                <article className="panel performance-panel">
                  <div className="panel-heading"><div><p className="eyebrow">Performance</p><h2>TPS history</h2></div><div className="chart-legend"><span><i /> Demo TPS</span><button>Last hour <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button></div></div>
                  <div className="chart-summary"><strong>19.98</strong><span>Current TPS</span><b>+0.04%</b></div><Sparkline points={overview.tpsHistory} />
                </article>

                <article className="panel resources-panel">
                  <div className="panel-heading"><div><p className="eyebrow">Host machine</p><h2>Resource usage</h2></div><span className="live-badge"><i /> Preview</span></div>
                  <div className="resource-list">{overview.resources.map((resource) => <div className="resource" key={resource.label}><div className="resource-heading"><span>{resource.label}</span><strong>{resource.displayValue}</strong></div><div className="progress-track"><span className={resource.tone} style={{ width: `${resource.value}%` }} /></div><small>{resource.detail}<b>{resource.value}% used</b></small></div>)}</div>
                  <button className="text-button">Open resource monitor <Icon name="arrow" /></button>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading"><div><p className="eyebrow">Preview feed</p><h2>Recent activity</h2></div><button className="secondary-button small">View all</button></div>
                  <div className="activity-list">{overview.activity.map((event) => <div className="activity-item" key={event.id}><ActivityMarker category={event.category} /><div><strong>{event.title}</strong><span>{event.detail}</span></div><time>{event.time}</time></div>)}</div>
                </article>
              </section>
            </>
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile dashboard navigation">{navigation.slice(0, 5).map((item) => <button key={item.id} className={activeSection === item.id ? "active" : ""} onClick={() => setActiveSection(item.id)} aria-label={item.label}><Icon name={item.icon} /><span>{item.id === "chat" ? "Chat" : item.label}</span></button>)}</nav>
      {showPairing && <PairServerModal onClose={() => setShowPairing(false)} />}
    </div>
  );
}
