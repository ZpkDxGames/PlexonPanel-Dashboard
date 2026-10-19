"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Pause, Play, X } from "lucide-react";
import {
  useTelemetry,
  usePrefs,
  useLedger,
  fmt,
  time,
  type Horizon,
  type TelemetryView,
} from "../bindings";
import { StudioChart, type ChartView } from "../studio/StudioChart";
import {
  MetricRibbon,
  metricList,
  HorizonSelector,
} from "../studio/TelemetryStudio";
import { Title, Table } from "./shared";
function download(text: string, name: string, type = "text/csv") {
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Performance() {
  const [window, setWindow] = useState<Horizon>("15m"),
    current = useTelemetry(window),
    [frozen, setFrozen] = useState<TelemetryView | null>(null),
    [crosshair, setCrosshair] = useState<number | null>(null),
    [active, setActive] = useState("tps"),
    [drawer, setDrawer] = useState(false),
    [rawOffset, setRawOffset] = useState(0),
    prefs = usePrefs(),
    ledger = useLedger(),
    t = frozen ?? current,
    nearest =
      crosshair == null
        ? null
        : t.paper.reduce(
            (a, p) =>
              Math.abs(p.at - crosshair) < Math.abs(a.at - crosshair) ? p : a,
            t.paper[0],
          ),
    metrics = metricList(
      nearest
        ? {
            ...t,
            tps: nearest.tps,
            mspt: nearest.mspt,
            p95: nearest.p95 ?? null,
            p99: nearest.p99 ?? null,
          }
        : t,
      "tick",
    ),
    tracks: { view: ChartView; title: string; height: number }[] = [
      { view: "tick", title: "01 / Tick & MSPT", height: 140 },
      { view: "gc", title: "02 / GC pauses · interval delta", height: 72 },
      { view: "memory", title: "03 / Memory tiers · GiB", height: 120 },
      { view: "compute", title: "04 / Service and node CPU", height: 110 },
      {
        view: "entities",
        title: "05 / Loaded chunks and entities",
        height: 110,
      },
    ];
  return (
    <div className="pp-page">
      <Title
        code="R03 / Telemetry"
        title="Read the whole signal."
        detail="Five tracks. One clock. Explicit boundaries between boots."
      />
      <section className="pp-pane pp-analyzer">
        <header className="pp-pane__head">
          <h2>Analyzer</h2>
          <div className="row push">
            <HorizonSelector value={window} onChange={setWindow} extended />
            <button
              className="pp-ctl"
              aria-label={frozen ? "Resume analyzer" : "Pause analyzer"}
              aria-pressed={!!frozen}
              onClick={() =>
                setFrozen(frozen ? null : structuredClone(current))
              }
            >
              {frozen ? <Play size={13} /> : <Pause size={13} />}
              <span>{frozen ? "Resume" : "Pause"}</span>
            </button>
            <button
              className="pp-ctl"
              aria-label="Open raw samples"
              onClick={() => setDrawer(true)}
            >
              <Download size={13} />
              <span className="desktop-only">Raw samples</span>
            </button>
          </div>
        </header>
        <MetricRibbon metrics={metrics} active={active} onSelect={setActive} />
        {tracks.map((track) => (
          <div
            className="pp-track-chart"
            key={track.view}
            style={{ "--track-h": `${track.height}px` } as React.CSSProperties}
          >
            <h3 className="pp-track-title">{track.title}</h3>
            <StudioChart
              data={t}
              view={track.view}
              active={active}
              crosshair={crosshair}
              onCrosshair={setCrosshair}
              stale={ledger.paper.state !== "live"}
            />
          </div>
        ))}
        <footer className="pp-pane__foot muted" style={{ fontSize: 10 }}>
          {prefs.timezone === "UTC"
            ? "UTC"
            : Intl.DateTimeFormat().resolvedOptions().timeZone}{" "}
          · {t.raw.length} retained samples · 2h requests show only retained
          history (35m maximum)
        </footer>
      </section>
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="pp-overlay" />
          <Dialog.Content className="pp-glass pp-drawer">
            <header>
              <Dialog.Title>Raw samples</Dialog.Title>
              <Dialog.Close className="pp-ctl" aria-label="Close raw samples">
                <X size={14} />
              </Dialog.Close>
            </header>
            <Dialog.Description
              className="muted"
              style={{ padding: "0 18px 15px", fontSize: 12 }}
            >
              Unclamped producer values. Gaps remain unavailable.
            </Dialog.Description>
            <div className="row" style={{ padding: "0 18px 15px" }}>
              <button
                className="pp-ctl"
                onClick={() =>
                  download(
                    [
                      "time,epoch,tps,mean,p95,p99,gc,heap,cpu",
                      ...t.raw.map((r) =>
                        [
                          new Date(r.at).toISOString(),
                          r.epoch,
                          r.tps,
                          r.mspt,
                          r.p95,
                          r.p99,
                          r.gc,
                          r.heap,
                          r.serviceCpu,
                        ]
                          .map(
                            (v) => `"${String(v ?? "").replaceAll('"', '""')}"`,
                          )
                          .join(","),
                      ),
                    ].join("\n"),
                    "plexonpanel-samples.csv",
                  )
                }
              >
                Export CSV
              </button>
              <span className="muted">{t.raw.length} samples</span>
            </div>
            <div
              style={{ overflow: "auto", height: "calc(100% - 150px)" }}
              onScroll={(e) =>
                setRawOffset(
                  Math.max(0, Math.floor(e.currentTarget.scrollTop / 39) - 5),
                )
              }
            >
              <div style={{ height: t.raw.length * 39, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: rawOffset * 39,
                    left: 0,
                    right: 0,
                  }}
                >
                  <Table label="Raw telemetry samples">
                    <thead>
                      <tr>
                        {[
                          "Time",
                          "Epoch",
                          "TPS",
                          "Mean",
                          "p95",
                          "p99",
                          "GC",
                          "Heap",
                          "CPU",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.raw.slice(rawOffset, rawOffset + 35).map((r, i) => (
                        <tr key={i}>
                          <td>{time(r.at, prefs.timezone)}</td>
                          <td>{r.epoch}</td>
                          {[
                            r.tps,
                            r.mspt,
                            r.p95,
                            r.p99,
                            r.gc,
                            r.heap == null ? null : r.heap / 2 ** 30,
                            r.serviceCpu,
                          ].map((v, i) => (
                            <td key={i}>{fmt(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
