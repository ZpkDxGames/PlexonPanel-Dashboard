import { readVerifiedTransfer } from "../adapter/transfers";
import { saveServerIcon } from "../lib/server-icon";
import { useEffect, useState } from "react";
import { useSession } from "../hooks";
import { usePreferences } from "../store/preferences";
import { BlockMark } from "./BlockMark";
const attempted = new Set<string>();
export function ServerIcon() {
  const snap = useSession();
  const { state } = snap,
    prefs = usePreferences();
  const source = prefs.serverIcons[state.serverId];
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (source || snap.fixture || snap.phase !== "live" || !state.ready) return;
    const key =
      state.serverId +
      ":" +
      (state.ready.server.hostSession ?? state.ready.server.paperSession);
    if (attempted.has(key)) return;
    const kind =
      state.ready.agents.host &&
      state.ready.server.hostCapabilities["files.download"]
        ? "HOST"
        : "PAPER";
    if (
      !state.ready.server[
        kind === "HOST" ? "hostCapabilities" : "paperCapabilities"
      ]["files.download"]
    )
      return;
    attempted.add(key);
    if (attempted.size > 64) attempted.delete(attempted.values().next().value!);
    void readVerifiedTransfer(
      "files.download",
      { root: "server", path: "server-icon.png" },
      kind,
      new AbortController().signal,
      () => {},
      256 * 1024,
    )
      .then((blob) => saveServerIcon(blob, state.serverId))
      .catch(() => {});
  }, [source, snap.fixture, snap.phase, state.serverId, state.ready]);

  return source && source !== failed ? (
    <img
      className="server-art"
      src={source}
      alt=""
      onError={() => setFailed(source)}
    />
  ) : (
    <BlockMark />
  );
}
