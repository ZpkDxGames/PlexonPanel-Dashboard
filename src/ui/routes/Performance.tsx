"use client";
import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useViewSync,
  useTelemetry,
  usePrefs,
  fmt,
  time,
  type TelemetryView,
} from "../bindings";
import { shapeTelemetry } from "../telemetry/series";
import { PerformanceWorkbench } from "../telemetry/PerformanceWorkbench";
import { crosshair } from "../telemetry/crosshair";
import { Table } from "./shared";
function download(text: string, name: string, type = "text/csv") {
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Performance() {
  const sync = useViewSync(),
    current = useTelemetry(sync.horizon),
    [frozen, setFrozen] = useState<TelemetryView | null>(null),
    [drawer, setDrawer] = useState(false),
    [rawOffset, setRawOffset] = useState(0),
    prefs = usePrefs(),
    t = frozen ?? current,
    span = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "35m": 2100000,
      "2h": 7200000,
    }[sync.horizon],
    domainT = useMemo(
      () => [t.now - span, t.now] as [number, number],
      [t.now, span],
    ),
    samples = useMemo(
      () => shapeTelemetry(t).filter((s) => s.t >= domainT[0]),
      [t.paper, t.system, t.host, t.service, domainT],
    );
  return (
    <div className="pp-page pp-performance">
      <PerformanceWorkbench
        samples={samples}
        domainT={domainT}
        paused={!!frozen}
        retained={t.raw.length}
        onTogglePause={() => {
          setFrozen(frozen ? null : structuredClone(current));
          crosshair.set(null);
        }}
        onRawSamples={() => setDrawer(true)}
      />
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
