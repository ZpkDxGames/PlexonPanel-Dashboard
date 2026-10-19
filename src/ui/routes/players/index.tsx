import { Heading, Roster, SessionTimeline, Panel } from "../shared";
import {
  usePlayers,
  useControl,
  useQuery,
  duration,
} from "../../hooks/useControl";
import { Sparkline } from "../../primitives/Sparkline";
import { SourceChip } from "../../primitives/SourceChip";
export default function Players() {
  const p = usePlayers(),
    { state } = useControl(),
    kind = state.ready?.server.hostCapabilities["players.history.view"]
      ? "HOST"
      : "PAPER",
    query = useQuery("players.history.list", kind, { limit: 25 });
  return (
    <>
      <Heading
        id="R04 · Players"
        title="The people behind the pixels."
        detail="Live roster and exact UUID history, scoped to this server and boot."
      />
      <div className="roster-layout">
        <Roster searchable />
        <div className="space-y-4">
          <SessionTimeline query={query} />
          <Panel title="Boot-session stats" tone="emerald">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="eyebrow">Observed peak</dt>
                <dd className="num text-2xl my-2">{p.sessionPeak ?? "—"}</dd>
                <dd>
                  <SourceChip source="Paper" />
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Unique joins</dt>
                <dd className="num text-2xl my-2">
                  {typeof query.data.uniqueJoins === "number"
                    ? query.data.uniqueJoins
                    : "Not reported"}
                </dd>
                <dd>
                  <SourceChip source="Host" />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="eyebrow">Mean closed session</dt>
                <dd className="num my-2">
                  {duration(query.data.meanClosedSessionMillis)}
                </dd>
                <dd>
                  <SourceChip source="Host" />
                </dd>
              </div>
            </dl>
            <Sparkline values={state.history.map((s) => s.players)} />
            <p className="text-secondary text-xs mt-3">
              Current boot only. The Host reports unique joins and completed
              join/leave durations.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
