import { skinCandidates } from "../bindings/skins";
import { useState } from "react";
import {
  fmt,
  gib,
  usePrefs,
  useRoster,
  useTelemetry,
  useLedger,
  useSourceLedger,
  type Tone,
  type TelemetryView,
  type JsonMap,
  type Preferences,
} from "../bindings";
export function SourceTag({
  source,
  stale = false,
  ageMs,
}: {
  source: "paper" | "host";
  stale?: boolean;
  ageMs?: number | null;
}) {
  return (
    <span
      className="pp-src"
      data-stale={stale || undefined}
      aria-label={`${source} source${stale ? ", stale" : ""}`}
    >
      {stale && (
        <span>
          stale {ageMs == null ? "—" : Math.round(ageMs / 1000) + "s"}
        </span>
      )}
      <i className="pp-dot" />
      {source === "paper" ? "P" : "H"}
    </span>
  );
}
type PlayerHeadProps = {
  uuid: string;
  name: string;
  skinTexture?: string | null;
  provider: Preferences["skinProvider"];
  size?: number;
};
export function PlayerHead(props: PlayerHeadProps) {
  const candidates = skinCandidates(props);
  // A new identity/provider resets fallback progress without a stale failed frame.
  return (
    <HeadImage
      key={JSON.stringify([
        props.provider,
        props.uuid,
        props.name,
        props.skinTexture,
        props.size,
      ])}
      candidates={candidates}
      name={props.name}
      size={props.size ?? 20}
    />
  );
}
function HeadImage({
  candidates,
  name,
  size,
}: {
  candidates: string[];
  name: string;
  size: number;
}) {
  const [stageIndex, setStageIndex] = useState(0);
  return (
    <span
      className="pp-avatar"
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {candidates[stageIndex] ? (
        <img
          src={candidates[stageIndex]}
          alt=""
          onError={() => setStageIndex((i) => i + 1)}
          loading="lazy"
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
export function AvatarStack({ players }: { players: JsonMap[] }) {
  const p = usePrefs();
  return (
    <div className="pp-avatar-stack">
      {players.length ? (
        players
          .slice(0, 6)
          .map((v) => (
            <PlayerHead
              key={String(v.uuid)}
              uuid={String(v.uuid)}
              name={String(v.name)}
              skinTexture={
                typeof v.skinTexture === "string" ? v.skinTexture : null
              }
              provider={p.skinProvider}
            />
          ))
      ) : (
        <small className="muted">No one online</small>
      )}
      {players.length > 6 && (
        <span className="pp-tag" style={{ marginLeft: 8 }}>
          +{players.length - 6}
        </span>
      )}
    </div>
  );
}
export function EqualizerBars({
  samples,
  target = 20,
}: {
  samples: (number | null)[];
  target?: number;
}) {
  const data = samples.slice(-30),
    n = 30;
  return (
    <svg
      viewBox="0 0 150 28"
      preserveAspectRatio="none"
      className="pp-eq"
      role="img"
      aria-label="Tick history; target 20 TPS"
    >
      <line
        x1="0"
        x2="150"
        y1="1"
        y2="1"
        stroke="rgb(var(--emerald)/.4)"
        strokeWidth=".5"
        strokeDasharray="2 2"
      />
      {data.map((v, i) => {
        if (v == null) return null;
        const h = Math.max(2, (Math.min(v, target) / target) * 25),
          tone = v >= 19 ? "emerald" : v >= 15 ? "amber" : "rose";
        return (
          <rect
            key={i}
            x={(n - data.length + i) * 5}
            y={28 - h}
            width="3.5"
            height={h}
            rx=".7"
            fill={`rgb(var(--${tone}) / ${0.35 + (0.65 * i) / n})`}
          />
        );
      })}
    </svg>
  );
}
export function CapacityTrack({
  value,
  max,
}: {
  value: number | null;
  max: number | null;
}) {
  return (
    <span className="pp-track" data-tone="cyan">
      <i
        style={{
          width: `${max && value != null ? Math.min(100, (value / max) * 100) : 0}%`,
        }}
      />
    </span>
  );
}
export function DualGauge({
  service,
  node,
  cores,
}: {
  service: number | null;
  node: number | null;
  cores: number;
}) {
  return (
    <>
      {[
        ["svc", service, "indigo"],
        ["node", node, "cyan"],
      ].map(([label, v, tone]) => {
        const value = typeof v === "number" ? v : null;
        return (
          <div className="pp-gauge" key={label} data-tone={tone}>
            <span>{label}</span>
            <span className="pp-track">
              <i
                style={{
                  width: `${value == null ? 0 : Math.min(100, value)}%`,
                }}
              />
              {value != null && value > 100 && (
                <i
                  className="pp-burst"
                  style={{
                    width: `${Math.min(100, ((value - 100) / (100 * Math.max(1, cores - 1))) * 100)}%`,
                  }}
                />
              )}
            </span>
            <b>
              {value != null && value > 100
                ? `×${fmt(value / 100, 1)}`
                : `${fmt(value, 1)}%`}
            </b>
          </div>
        );
      })}
    </>
  );
}
export function SegmentedMemoryBar({
  used,
  committed,
  cgroup,
  max,
}: {
  used: number | null;
  committed: number | null;
  cgroup: number | null;
  max: number | null;
}) {
  const extent = Math.max(max ?? 0, cgroup ?? 0, committed ?? 0, 1);
  return (
    <>
      <div className="pp-memory">
        {[cgroup, committed, used].map((v, i) => (
          <i
            key={i}
            style={{
              width: `${v == null ? 0 : (v / extent) * 100}%`,
              background:
                i === 0
                  ? "rgb(var(--indigo)/.5)"
                  : `rgb(var(--violet)/${i === 1 ? 0.45 : 1})`,
            }}
          />
        ))}
      </div>
      <div className="pp-memory-legend">
        {[
          [used, "used"],
          [committed, "commit"],
          [cgroup, "cg"],
        ].map(([n, label]) => (
          <span key={String(label)}>
            <i className="pp-dot" />{" "}
            {typeof n === "number" ? fmt(n / 2 ** 30) : "—"} {label}
          </span>
        ))}
        <span className="push">
          max {max == null ? "—" : fmt(max / 2 ** 30)}
        </span>
      </div>
    </>
  );
}
type DeckData = Pick<
  TelemetryView,
  | "tps"
  | "mspt"
  | "p95"
  | "cpu"
  | "nodeCpu"
  | "cores"
  | "heap"
  | "committed"
  | "max"
  | "cgroup"
> & {
  ticks: (number | null)[];
  players: JsonMap[];
  online: number | null;
  capacity: number | null;
  peak: number | null;
  ledger?: ReturnType<typeof useLedger>;
  sources?: ReturnType<typeof useSourceLedger>;
};
export const PREVIEW_DECK: DeckData = {
  tps: 20,
  mspt: 9.9,
  p95: 11.1,
  cpu: 24.4,
  nodeCpu: 7.9,
  cores: 4,
  heap: 1.1 * 2 ** 30,
  committed: 1.7 * 2 ** 30,
  max: 4 * 2 ** 30,
  cgroup: 2.8 * 2 ** 30,
  ticks: Array.from({ length: 30 }, (_, i) => 19.7 + Math.sin(i) * 0.3),
  players: [{ uuid: "preview", name: "Alex" }],
  online: 1,
  capacity: 10,
  peak: 3,
};
export function InstrumentDeck({ data }: { data: DeckData }) {
  const d = data;
  const items: {
    label: string;
    tone: Tone;
    source: "paper" | "host";
    value: string;
    unit: string;
    delta: string;
    viz: React.ReactNode;
  }[] = [
    {
      label: "Tick performance",
      tone: "emerald",
      source: "paper",
      value: fmt(d.tps, 2),
      unit: "TPS",
      delta: `p95 ${fmt(d.p95)} ms`,
      viz: (
        <>
          <EqualizerBars samples={d.ticks} />
          <div className="pp-viz-note">
            <span>{fmt(d.mspt)} ms mean</span>
            <span>50 ms budget</span>
          </div>
        </>
      ),
    },
    {
      label: "Online players",
      tone: "cyan",
      source: "paper",
      value: fmt(d.online, 0),
      unit: `/ ${fmt(d.capacity, 0)}`,
      delta: `peak ${fmt(d.peak, 0)}`,
      viz: (
        <>
          <AvatarStack players={d.players} />
          <CapacityTrack value={d.online} max={d.capacity} />
          <div className="pp-viz-note">
            <span>Instance capacity</span>
            <span>
              {fmt(d.online, 0)} / {fmt(d.capacity, 0)}
            </span>
          </div>
        </>
      ),
    },
    {
      label: "Compute load",
      tone: "indigo",
      source: "host",
      value: fmt(d.cpu),
      unit: "%",
      delta:
        d.cpu != null && d.cpu > 100
          ? "multi-core burst"
          : `of ${d.cores} core${d.cores > 1 ? "s" : ""}`,
      viz: <DualGauge service={d.cpu} node={d.nodeCpu} cores={d.cores} />,
    },
    {
      label: "Memory allocation",
      tone: "violet",
      source: "paper",
      value: d.heap == null ? "—" : fmt(d.heap / 2 ** 30),
      unit: "GiB",
      delta: `${d.heap != null && d.max ? fmt((d.heap / d.max) * 100, 0) : "—"}% heap`,
      viz: (
        <SegmentedMemoryBar
          used={d.heap}
          committed={d.committed}
          cgroup={d.cgroup}
          max={d.max}
        />
      ),
    },
  ];
  return (
    <section className="pp-deck pp-deck--instruments" aria-label="Instruments">
      {items.map((item) => {
        const l =
            d.sources?.[
              item.source === "host"
                ? "service"
                : item.tone === "violet"
                  ? "paperSystem"
                  : "paperHealth"
            ] ?? d.ledger?.[item.source],
          stale = !!l && l.state !== "live";
        return (
          <div
            className="pp-cell pp-inst"
            key={item.label}
            data-tone={item.tone}
            data-stale={stale || undefined}
          >
            <div className="pp-inst__top">
              <span className="pp-kicker">{item.label}</span>
              <SourceTag source={item.source} stale={stale} ageMs={l?.ageMs} />
            </div>
            <div className="pp-inst__metric">
              <span className="pp-inst__value pp-num">{item.value}</span>
              <span className="pp-inst__unit">{item.unit}</span>
              {!stale && (
                <span className="pp-tag pp-inst__delta">{item.delta}</span>
              )}
            </div>
            <div className="pp-inst__viz">{item.viz}</div>
          </div>
        );
      })}
    </section>
  );
}
export function ConnectedInstrumentDeck() {
  const t = useTelemetry("1m"),
    r = useRoster(),
    ledger = useLedger(),
    sources = useSourceLedger();
  return (
    <InstrumentDeck
      data={{ ...t, ticks: t.paper.map((p) => p.tps), ...r, ledger, sources }}
    />
  );
}
