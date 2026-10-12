import { copy } from "../i18n/en";
import { useNow, useSession } from "../hooks";
import { number, record, str } from "../adapter/control-state";
import { classifyTelemetry } from "../adapter/telemetry-freshness";
import { bytes } from "../store/selectors";
import { Panel, Status } from "./ui";
export function HostTelemetry() {
  const { state } = useSession(),
    now = useNow(),
    host = state.hostSystem;
  const fresh = classifyTelemetry({
    capturedAt: host.capturedAt,
    receivedAt: state.receipts?.hostSystem,
    connected: !!state.ready?.agents.host,
    now,
  });
  const n = (key: string, suffix = "") => {
    const v = number(host[key]);
    return v === null
      ? "—"
      : v.toLocaleString(undefined, { maximumFractionDigits: 2 }) + suffix;
  };
  const b = (key: string) => {
    const v = number(host[key]);
    const size = bytes(v);
    return v === null ? "—" : `${size.value} ${size.unit}`;
  };
  const resources = record(state.service.resources);
  const facts = [
    ["Host CPU", n("hostCpuPercent", "%")],
    ["Logical processors", n("logicalProcessors")],
    [
      "Load · 1 / 5 / 15 min",
      ["loadAverage1m", "loadAverage5m", "loadAverage15m"]
        .map((k) => n(k))
        .join(" / "),
    ],
    [
      "Physical memory",
      `${b("physicalMemoryUsedBytes")} / ${b("physicalMemoryTotalBytes")}`,
    ],
    ["Available memory", b("physicalMemoryAvailableBytes")],
    ["Swap", `${b("swapUsedBytes")} / ${b("swapTotalBytes")}`],
    ["Disk used", `${b("diskUsedBytes")} / ${b("diskTotalBytes")}`],
    ["Disk available", b("diskUsableBytes")],
    ["Server directory", b("serverDirectoryBytes")],
    [
      "Operating system",
      `${str(host.operatingSystem, "—")} · ${str(host.architecture, "—")}`,
    ],
  ];
  const available = facts.filter(
    ([, value]) => String(value).replace(/[— /·]/g, "").length > 0,
  );
  const missing = facts.filter((f) => !available.includes(f));
  return (
    <Panel
      title={copy.refine_81e1eb23}
      eyebrow={copy.refine_ebab072f}
      className="wide-panel"
      action={
        <Status tone={fresh.usable ? "success" : "neutral"}>
          {fresh.label}
        </Status>
      }
    >
      <dl className="host-facts">
        {available.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 && (
        <p className="subtle" style={{ marginTop: 16 }}>
          Not reported: {missing.map(([label]) => label).join(", ")}.
        </p>
      )}
      <p className="subtle" style={{ marginTop: 16 }}>
        {copy.refine_8f880d73}{" "}
        {resources.scope === "MINECRAFT_SERVICE"
          ? "Service CPU and memory are shown in the charts above."
          : ""}
      </p>
    </Panel>
  );
}
