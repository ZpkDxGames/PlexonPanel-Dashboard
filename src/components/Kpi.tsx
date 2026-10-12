import { usePreferences } from "../store/preferences";
import { copy } from "../i18n/en";
import { Icon } from "./Icon";
import { Sparkline } from "./charts/TimeSeries";
import { useTween } from "../lib/motion";
import { navigate } from "../router";
export function Kpi({
  label,
  sub,
  value,
  unit,
  decimals = 0,
  color,
  icon,
  context,
  values,
  gauge,
}: {
  label: string;
  sub: string;
  value: number | null;
  unit: string;
  decimals?: number;
  color: string;
  icon: string;
  context: string;
  values?: (number | null)[];
  gauge?: number;
}) {
  const prefs = usePreferences();
  const shown = useTween(value, Math.min(300, Math.max(80, prefs.telemetryInterval * 2)));
  return (
    <section
      className="card kpi"
      style={{ "--c": color } as React.CSSProperties}
      aria-label={label}
    >
      <div className="kpi-top">
        <span className="kpi-chip">
          <Icon name={icon} />
        </span>
        <div className="kpi-label">
          {label}
          <small>{sub}</small>
        </div>
      </div>
      <div className="kpi-main">
        <strong className="kpi-value num">
          {shown === null
            ? "—"
            : shown.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
        </strong>
        <span className="kpi-unit">{unit}</span>
      </div>
      <div className="kpi-foot">
        <span
          className={`delta ${label === "Tick rate" && value !== null && value >= 18 ? "up" : ""}`}
        >
          {context}
        </span>
      </div>
      {gauge !== undefined ? (
        <div
          className="gauge"
          role="img"
          aria-label={`${Math.round(gauge)} percent used`}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} className={i < (gauge / 100) * 24 ? "on" : ""} />
          ))}
        </div>
      ) : (
        <Sparkline
          values={values ?? []}
          color={color}
          minSpan={label === "Tick rate" ? 3 : label === "CPU load" ? 20 : 1}
        />
      )}
      <button className="sr-only" onClick={() => navigate("Performance")}>
        {copy.explore_ca43c}
        {label}
      </button>
    </section>
  );
}
