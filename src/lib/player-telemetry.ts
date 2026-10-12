import { number, type JsonMap } from "../adapter/control-state";

/** Protocol 3 PlayerSnapshot uses pingMillis. Legacy fixture/replay data used ping. */
export function playerPingMillis(player: JsonMap): number | null {
  return number(player.pingMillis ?? player.ping);
}
