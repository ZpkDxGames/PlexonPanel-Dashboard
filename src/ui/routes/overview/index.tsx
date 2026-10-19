import Link from "next/link";
import { ServerHero } from "../../chrome/ServerHero";
import { TickPerformanceCard } from "../../instruments/TickPerformanceCard";
import { OnlinePlayersCard } from "../../instruments/OnlinePlayersCard";
import { ComputeLoadCard } from "../../instruments/ComputeLoadCard";
import { MemoryAllocationCard } from "../../instruments/MemoryAllocationCard";
import { TelemetryStudio } from "../../chart/TelemetryStudio";
import { LiveConsole } from "../../console/LiveConsole";
import { Roster, WorldActivity } from "../shared";
export default function Overview() {
  return (
    <>
      <ServerHero />
      <div className="kpi-grid" data-testid="kpi-row">
        <Link className="instrument-link" href="/performance?series=tps">
          <TickPerformanceCard />
        </Link>
        <Link className="instrument-link" href="/performance?series=players">
          <OnlinePlayersCard />
        </Link>
        <Link className="instrument-link" href="/performance?series=cpu">
          <ComputeLoadCard />
        </Link>
        <Link className="instrument-link" href="/performance?series=heap">
          <MemoryAllocationCard />
        </Link>
      </div>
      <div className="overview-main">
        <TelemetryStudio />
        <LiveConsole />
      </div>
      <div className="below-grid">
        <WorldActivity />
        <Roster limit={6} />
      </div>
    </>
  );
}
