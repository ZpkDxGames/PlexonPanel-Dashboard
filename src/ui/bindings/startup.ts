import { session } from "./index";
let startup: Promise<void> | undefined;
export function startSession() {
  if (startup) return startup;
  startup = (async () => {
    if (process.env.NODE_ENV === "development") {
      const mode = new URL(location.href).searchParams.get("fixture");
      if (
        mode &&
        [
          "healthy",
          "stale",
          "skew",
          "partial",
          "stopped",
          "offline",
          "denied",
          "structural",
          "host-stale",
          "starting",
          "stopping",
          "unknown",
          "volume",
        ].includes(mode)
      ) {
        const { makeFixture, fixtureAction, setFixtureMode } =
          await import("../../development/fixtures");
        setFixtureMode(mode);
        const s = makeFixture(
          [
            "structural",
            "host-stale",
            "starting",
            "stopping",
            "unknown",
            "volume",
          ].includes(mode)
            ? "healthy"
            : mode,
        );
        if (
          [
            "structural",
            "host-stale",
            "starting",
            "stopping",
            "unknown",
            "volume",
          ].includes(mode)
        ) {
          s.ready!.server.serverName = "TonimSMP";
          const line =
            "NEGUINCOMCEROL[/168.194.144.215:33319] logged in with entity id 186275 at ([world]454.339, 73.0, 1168.182264153)";
          s.console.push({
            id: "structural-login",
            content: `[Server] ${line}`,
            level: "INFO",
            capturedAt: new Date().toISOString(),
          });
          if (mode === "volume") {
            s.console = Array.from({ length: 5000 }, (_, i) => ({
              id: `volume-${i}`,
              content: `[Server] load test entry ${i}`,
              level: "INFO",
              capturedAt: new Date(Date.now() - 5000 + i).toISOString(),
            }));
          }
          if (mode === "host-stale") {
            s.hostSystem.capturedAt = new Date(
              Date.now() - 60000,
            ).toISOString();
            s.receipts!.hostSystem = Date.now() - 60000;
            (s.service.resources as Record<string, unknown>).capturedAt =
              new Date(Date.now() - 60000).toISOString();
            s.receipts!.service = Date.now() - 60000;
          }
          if (["starting", "stopping", "unknown"].includes(mode)) {
            s.server = {};
            s.ready!.agents.paper = false;
            s.service.state =
              mode === "starting"
                ? "activating"
                : mode === "stopping"
                  ? "deactivating"
                  : "unreported";
          }
          s.presenceDeltas = [
            {
              eventId: "e1",
              epoch: "fixture-boot-1",
              name: "Alex",
              state: "LEFT",
              observedAt: new Date(Date.now() - 600000).toISOString(),
            },
            {
              eventId: "e2",
              epoch: "fixture-boot-2",
              name: "Alex",
              state: "JOINED",
              observedAt: new Date(Date.now() - 30000).toISOString(),
            },
          ];
        }
        session.installFixture(mode, s, async (action, args) => {
          if (action === "backup.full.restore.prepare")
            return {
              requestId: "fixture-restore-token",
              action,
              status: "SUCCESS",
              code: "OK",
              message: "Development fixture token",
              data: {
                confirmationToken: "fixture-confirmation-token",
                serverName: "TonimSMP",
                expiresInSeconds: 60,
              },
            };
          return fixtureAction(action, args);
        });
        return;
      }
    }
    await session.start();
  })();
  return startup;
}
