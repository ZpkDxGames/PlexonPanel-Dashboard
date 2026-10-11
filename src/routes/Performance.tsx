import { useMemo, useState } from "react";
import { useSession } from "../hooks";
import { CrosshairGroup, TimeSeries } from "../components/charts/TimeSeries";
import { Panel, Status } from "../components/ui";

export default function Performance() {
  const { state } = useSession();
  const [minutes, setMinutes] = useState(15);
  const samples = useMemo(() => { const cutoff = Date.now() - minutes * 60_000; return state.history.filter((sample) => sample.at >= cutoff); }, [state.history, minutes]);
  const spikes = useMemo(() => samples.filter((sample) => typeof sample.mspt === "number" && sample.mspt > 50), [samples]);
  const gcRate = useMemo(() => { const first = samples.find((sample) => typeof sample.gc === "number"), last = [...samples].reverse().find((sample) => typeof sample.gc === "number"); return first && last && last.at > first.at ? ((last.gc! - first.gc!) / ((last.at - first.at) / 60000)) : null; }, [samples]);
  return <CrosshairGroup>
    <div className="performance-toolbar"><div className="segmented" aria-label="Time range">{[5,15,35].map((value) => <button key={value} className={minutes === value ? "active" : ""} onClick={() => setMinutes(value)}>{value}m</button>)}</div><span>{samples.length} observed samples · no interpolation across gaps</span></div>
    <div className="performance-grid">
      <Panel eyebrow="Correlation" title="TPS and mean MSPT" className="wide-panel" action={<Status tone={spikes.length ? "warning" : "success"}>{spikes.length ? `${spikes.length} spike samples` : "Within tick budget"}</Status>}><TimeSeries title="Tick correlation" samples={samples} yMax={100} threshold={50} series={[{key:"tps",label:"TPS",unit:"TPS",color:"#56d4c4"},{key:"mspt",label:"Mean MSPT",unit:"ms",color:"#efad67"}]} /></Panel>
      <Panel eyebrow="Rule-based evidence" title="Lag-spike strip"><div className="heat-strip" aria-label={`${spikes.length} samples above 50 milliseconds`}>{samples.slice(-120).map((sample) => <i key={sample.at} className={typeof sample.mspt === "number" && sample.mspt > 50 ? "hot" : typeof sample.mspt === "number" ? "ok" : "gap"} title={`${new Date(sample.at).toLocaleTimeString()} · ${sample.mspt ?? "unknown"} ms`} />)}</div><div className="spike-list">{spikes.length ? spikes.slice(-5).reverse().map((sample) => <div key={sample.at}><time>{new Date(sample.at).toLocaleTimeString()}</time><strong>{sample.mspt?.toFixed(1)} ms</strong><span>Threshold crossed; cause unknown</span></div>) : <p>No observed mean-MSPT samples exceeded 50 ms in this window.</p>}</div></Panel>
      <Panel eyebrow="Compute" title="CPU alignment"><TimeSeries title="Process and host CPU" source="Paper JVM + Host" height={220} samples={samples} yMax={100} series={[{key:"processCpu",label:"JVM process",unit:"%",color:"#6f9fec"},{key:"hostCpu",label:"Host",unit:"%",color:"#b38aef"}]} /></Panel>
      <Panel eyebrow="Memory" title="Heap and host memory"><TimeSeries title="Memory sources" source="Paper JVM + Host" height={220} samples={samples} series={[{key:"heap",label:"Heap used",unit:"bytes",color:"#56d4c4"},{key:"memory",label:"Host used",unit:"bytes",color:"#efad67"}]} /></Panel>
      <Panel eyebrow="Garbage collection" title="Cumulative pause movement"><div className="single-evidence"><strong>{gcRate === null ? "—" : `${gcRate.toFixed(1)} ms/min`}</strong><span>Derived from cumulative pause counter over observed samples</span><small>No pause percentile or cause is inferred.</small></div></Panel>
      <Panel eyebrow="Distribution" title="MSPT percentiles unavailable"><div className="single-evidence"><strong>Backend required</strong><span>p95/p99 need raw ticks or a declared histogram window.</span><small>Mean values are not used as percentile substitutes.</small></div></Panel>
    </div>
  </CrosshairGroup>;
}
