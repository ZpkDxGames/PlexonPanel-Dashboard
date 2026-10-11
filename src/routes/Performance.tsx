import { useMemo, useState } from "react";
import { useNow, useSession } from "../hooks";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { tickSeries, cpuSeries, memorySeries } from "../components/charts/presets";
import { Button, Panel, Status } from "../components/ui";
import { gcPauseRate, metricPoints, observedSpikes, summarize, type TimeWindow } from "../lib/telemetryView";

export default function Performance() {
  const { state } = useSession(), now = useNow();
  const [minutes, setMinutes] = useState(15), [zoom, setZoom] = useState<TimeWindow | null>(null), [pausedAt, setPausedAt] = useState<number | null>(null);
  const [frozen, setFrozen] = useState(state.history);
  const history = pausedAt === null ? state.history : frozen;
  const latestCapture = useMemo(() => Math.max(0,...history.map((sample) => sample.at)),[history]);
  const end = pausedAt ?? Math.max(now,latestCapture);
  const window = useMemo(() => zoom ?? { from: end - minutes * 60_000, to: end }, [zoom, end, minutes]);
  const spikes = useMemo(() => observedSpikes(history, window), [history, window]);
  const mspt = useMemo(() => metricPoints(history, "mspt", window), [history, window]);
  const observed = summarize(mspt), gcRate = useMemo(() => gcPauseRate(history, window), [history, window]);
  const reset = () => setZoom(null);
  const togglePause = () => { if (pausedAt === null) { setPausedAt(Math.max(now,latestCapture)); setFrozen(state.history); } else { setPausedAt(null); setZoom(null); } };
  return <CrosshairGroup>
    <div className="performance-toolbar"><div className="segmented" aria-label="Time range">{[5, 15, 35].map((value) => <button key={value} aria-pressed={minutes === value && !zoom} className={minutes === value && !zoom ? "active" : ""} onClick={() => { setMinutes(value); reset(); }}>{value}m</button>)}</div><span>{zoom ? "Selected capture window" : "Session history"} · {observed?.count ?? 0} tick samples</span><div className="performance-controls"><Button onClick={togglePause}>{pausedAt === null ? "Freeze view" : "Resume live"}</Button>{zoom && <Button onClick={reset}>Reset zoom</Button>}</div></div>
    <div className="performance-summary"><div><span>Observed mean MSPT</span><strong>{observed ? `${observed.average.toFixed(1)} ms` : "—"}</strong><small>Average of reported means</small></div><div><span>Maximum observed MSPT</span><strong>{observed ? `${observed.max.toFixed(1)} ms` : "—"}</strong><small>Within selected captures</small></div><div><span>Over-budget samples</span><strong>{observed ? spikes.length : "—"}</strong><small>Reported means above 50 ms</small></div></div>
    <div className="performance-grid">
      <Panel eyebrow="Correlation" title="TPS and mean MSPT" className="wide-panel" action={<Status tone={!observed ? "neutral" : spikes.length ? "warning" : "info"}>{!observed ? "Awaiting tick samples" : spikes.length ? `${spikes.length} over budget` : "No observed spikes"}</Status>}><TimeSeries title="Tick correlation" samples={history} window={window} onZoom={setZoom} yMax={20} threshold={50} series={tickSeries}/><p className="chart-hint">Drag across the chart to inspect a window. Use arrow keys for exact captures. Empty intervals remain gaps.</p></Panel>
      <Panel eyebrow="Rule-based evidence" title="Lag-spike timeline"><div className="heat-strip" aria-label={`${spikes.length} observed means above 50 milliseconds`}>{mspt.slice(-120).map((point) => <i key={point.at} className={point.value === null ? "gap" : point.value > 50 ? "hot" : "ok"} title={`${new Date(point.at).toLocaleTimeString()} · ${point.value ?? "unknown"} ms`}/>)}</div><div className="spike-list">{spikes.length ? spikes.slice(-5).reverse().map((point) => <div key={point.at}><time>{new Date(point.at).toLocaleTimeString()}</time><strong>{point.value!.toFixed(1)} ms</strong><span>Above tick budget · cause unknown</span></div>) : <p>{observed ? "No observed mean-MSPT samples exceeded 50 ms in this window." : "No tick samples in this window. Server health is unknown."}</p>}</div></Panel>
      <Panel eyebrow="Compute" title="Process and node CPU"><TimeSeries title="Process and host CPU" source="Paper JVM + Host node" height={230} samples={history} window={window} series={cpuSeries}/></Panel>
      <Panel eyebrow="Memory" title="Heap and physical memory"><TimeSeries title="Memory sources" source="Paper JVM + Host node" height={230} samples={history} window={window} series={memorySeries}/></Panel>
      <Panel eyebrow="Garbage collection" title="Observed pause rate"><div className="single-evidence"><strong>{gcRate === null ? "—" : `${gcRate.toFixed(1)} ms/min`}</strong><span>Change in the cumulative pause counter over continuous observations.</span><small>Counter resets and missing intervals are excluded.</small></div></Panel>
      <Panel eyebrow="Measurement boundary" title="Tick distributions"><div className="single-evidence"><strong>p95 / p99 not supplied</strong><span>Raw ticks or a server histogram are needed to report percentiles.</span><small>Reported means cannot establish a tick distribution.</small></div></Panel>
    </div>
  </CrosshairGroup>;
}
