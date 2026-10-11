import "@fontsource-variable/plus-jakarta-sans/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/reference.css";
import "./styles.css";
import { session } from "./adapter/session";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

async function initialize() {
  if (import.meta.env.DEV) {
    const q = new URL(location.href).searchParams;
    const mode =
      q.get("demo") === "1"
        ? q.get("offline") === "1"
          ? "offline"
          : q.get("idle") === "1"
            ? "idle"
            : "healthy"
        : q.get("fixture");
    if (
      mode &&
      [
        "healthy",
        "idle",
        "skew",
        "stale",
        "partial",
        "stopped",
        "offline",
        "denied",
      ].includes(mode)
    ) {
      const { makeFixture, fixtureAction, setFixtureMode } =
        await import("./development/fixtures");
      setFixtureMode(mode);
      session.installFixture(mode, makeFixture(mode), fixtureAction);
      if (!["offline", "stopped", "stale"].includes(mode)) {
        const { startDemo } = await import("./development/demo");
        startDemo(mode);
      }
    } else await session.start();
  } else await session.start();
}

void initialize();
