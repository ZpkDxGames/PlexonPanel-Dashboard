import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyControlState } from "../.test-dist/lib/control-state.js";
import {
  ConsoleView,
  ChatView,
  PluginsView,
  OverviewView,
} from "../.test-dist/app/control-views.js";
import {
  FilesView,
  BackupsView,
  ServerView,
} from "../.test-dist/app/advanced-views.js";
import {
  HistoryPlayerDrawer21,
  PlayersView21,
} from "../.test-dist/app/management-views-2-1.js";
const props = {
  state: emptyControlState("test"),
  can: () => false,
  run: async () => {
    throw new Error("denied");
  },
  notice: () => {},
  connected: false,
};
test("read-only console and chat omit execution controls", () => {
  const console = renderToStaticMarkup(React.createElement(ConsoleView, props)),
    chat = renderToStaticMarkup(React.createElement(ChatView, props));
  assert.ok(!console.includes('aria-label="Console command"'));
  assert.ok(!chat.includes('type="submit"'));
  assert.match(console, /Read-only console/);
});
test("host and file routes show explicit unavailable states without privileged controls", () => {
  for (const view of [FilesView, BackupsView, ServerView]) {
    const html = renderToStaticMarkup(React.createElement(view, props));
    assert.ok(!html.includes(">Restore</button>"));
    assert.ok(!html.includes(">Restart</button>"));
    assert.ok(!html.includes(">Save</button>"));
    assert.ok(/unavailable|not installed|companion/i.test(html));
  }
});
test("uploaded-looking log content and plugin names remain escaped text", () => {
  const state = {
    ...props.state,
    plugins: [
      {
        name: "<img src=x onerror=alert(1)>",
        version: "1",
        authors: [],
        enabled: true,
      },
    ],
    console: [{ content: "<script>alert(1)</script>", level: "WARN" }],
  };
  for (const View of [PluginsView, OverviewView]) {
    const html = renderToStaticMarkup(
      React.createElement(View, { ...props, state }),
    );
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(!html.includes("<img src=x"));
  }
});
test("Players distinguishes missing scope, local policy and older agents", () => {
  const baseReady = {
    serverId: "test",
    protocolVersion: 3,
    version: "2.2.0",
    agents: { paper: true, host: false, hostInstalled: false },
    device: { deviceId: "device", role: "Observer", scopes: [] },
    server: {
      fingerprint: "fingerprint",
      pluginVersion: "3.0.0",
      hostVersion: null,
      minecraftVersion: "26.2",
      capabilities: {},
      paperCapabilities: { "players.history.view": false },
      hostCapabilities: {},
      paperSession: "session",
    },
  };
  const render = (ready) =>
    renderToStaticMarkup(
      React.createElement(PlayersView21, {
        ...props,
        connected: true,
        state: { ...props.state, ready },
      }),
    );
  assert.match(render(baseReady), /device grant does not include player history/i);
  assert.match(
    render({
      ...baseReady,
      device: { ...baseReady.device, scopes: ["players.history.view"] },
    }),
    /disabled by local Paper policy/i,
  );
  const old = structuredClone(baseReady);
  old.device.scopes = ["players.history.view"];
  old.server.paperCapabilities = {};
  old.server.pluginVersion = "2.0.0";
  assert.match(render(old), /predates the player-history capability/i);
});
test("offline history detail is read-only and exposes no player actions", () => {
  const entry = {
    eventId: "event",
    sessionId: "session",
    uuid: "player",
    name: "Alex",
    state: "LEFT",
    observedAt: "2026-09-06T12:00:00Z",
    sessionStartedAt: "2026-09-06T11:00:00Z",
    sessionEndedAt: null,
    sessionDurationMillis: null,
    termination: "UNKNOWN_DISCONNECT",
  };
  const html = renderToStaticMarkup(
    React.createElement(HistoryPlayerDrawer21, {
      entry,
      entries: [entry],
      close: () => {},
    }),
  );
  assert.match(html, /read only/i);
  assert.match(html, /Unknown/);
  assert.doesNotMatch(html, />Heal<|>Kick<|>Teleport<|>Ban</);
});
