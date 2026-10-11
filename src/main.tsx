import "@fontsource-variable/plus-jakarta-sans/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/reference.css";
import "./styles.css";
import { session } from "./adapter/session";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

async function initialize() {
  if (import.meta.env.DEV) {
    const mode = new URL(location.href).searchParams.get("fixture");
    if (mode && ["healthy", "skew", "stale", "partial", "stopped", "offline", "denied"].includes(mode)) {
      const { makeFixture, fixtureAction, setFixtureMode } = await import("./development/fixtures");
      setFixtureMode(mode);
      session.installFixture(mode, makeFixture(mode), fixtureAction);
    } else await session.start();
  } else await session.start();
}

void initialize();
