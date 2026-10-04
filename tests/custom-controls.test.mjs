import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import { Select } from "../.test-dist/components/select.js";
import { PlayerHead, clearPlayerHeadSessionCache } from "../.test-dist/components/player-head.js";
import { UiPreferencesProvider } from "../.test-dist/components/ui-preferences-provider.js";

async function domTest(run) {
 const dom = new JSDOM('<div id="root"></div><button id="outside">Outside</button>', { url: "https://fixture.test", pretendToBeVisual: true });
 dom.window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
 const saved = new Map();
 for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
 }
 const { createRoot } = await import("react-dom/client");
 const root = createRoot(dom.window.document.getElementById("root"));
 const render = element => act(async () => root.render(element));
 const event = async (node, type, data) => act(async () => node.dispatchEvent(new dom.window[type.startsWith("key") ? "KeyboardEvent" : "MouseEvent"](type, { bubbles: true, cancelable: true, ...data })));
 try { await run({ dom, root, render, event, document: dom.window.document }); }
 finally { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
const options = () => [React.createElement("option", { key: "none", value: "", disabled: true }, "Choose"), ...["Alpha", "Bravo", "Charlie"].map(label => React.createElement("option", { key: label, value: label.toLowerCase() }, label))];

test("custom select supports arrows, disabled options, typeahead, Enter, Escape, Tab and outside dismissal", async () => domTest(async ({ render, event, document }) => {
 const changes = [];
 function Field() { const [value, setValue] = useState("alpha"); return React.createElement(Select, { value, "aria-label": "World", onValueChange(next) { changes.push(next); setValue(next); } }, options()); }
 await render(React.createElement(Field));
 const trigger = document.querySelector('[role="combobox"]'); trigger.focus();
 assert.equal(document.querySelector("select"), null);
 await event(trigger, "keydown", { key: "ArrowDown" });
 assert.equal(trigger.getAttribute("aria-expanded"), "true");
 assert.equal(document.getElementById(trigger.getAttribute("aria-activedescendant")).textContent.trim(), "Alpha✓");
 await event(trigger, "keydown", { key: "End" }); await event(trigger, "keydown", { key: "Enter" });
 assert.equal(trigger.textContent.trim(), "Charlie"); assert.deepEqual(changes, ["charlie"]);
 assert.equal(document.activeElement, trigger); assert.equal(document.querySelector('[role="listbox"]'), null);
 await event(trigger, "keydown", { key: "b" }); await event(trigger, "keydown", { key: "Enter" });
 assert.equal(trigger.textContent.trim(), "Bravo");
 await event(trigger, "click"); await event(trigger, "keydown", { key: "Escape" });
 assert.equal(document.querySelector('[role="listbox"]'), null);
 await event(trigger, "click"); await event(trigger, "keydown", { key: "Tab" });
 assert.equal(document.querySelector('[role="listbox"]'), null);
 await event(trigger, "click"); await event(document.getElementById("outside"), "pointerdown");
 assert.equal(document.querySelector('[role="listbox"]'), null);
}));

test("custom dropdown belongs to its dialog and unmount removes the portaled menu", async () => domTest(async ({ render, event, root, document }) => {
 await render(React.createElement("dialog", { open: true }, React.createElement(Select, { value: "alpha", "aria-label": "Accent", onValueChange() {} }, options())));
 await event(document.querySelector('[role="combobox"]'), "click");
 assert.ok(document.querySelector('dialog [role="listbox"]'));
 await act(async () => root.render(null));
 assert.equal(document.querySelector('[role="listbox"]'), null);
}));

test("player heads use applied textures and reset load/failure state when the identity changes", async () => domTest(async ({ render, event, document }) => {
 clearPlayerHeadSessionCache();
 const props = { uuid: "c35b35bf-9d8e-39a9-b599-f03dfc68512d", name: "ZpkDxGames", size: 40 };
 const head = extra => React.createElement(UiPreferencesProvider, null, React.createElement(PlayerHead, { ...props, ...extra }));
 await render(head({}));
 assert.equal(document.querySelector("img").getAttribute("src"), "https://mc-heads.net/avatar/ZpkDxGames/40");
 await event(document.querySelector("img"), "error"); assert.equal(document.querySelector("img"), null);
 await render(head({ skinTextureId: "ab".repeat(32) }));
 let image = document.querySelector("img"); assert.ok(image); assert.equal(image.className, "");
 assert.match(image.src, new RegExp("ab".repeat(32)));
 await event(image, "load"); assert.equal(image.className, "loaded");
 await render(head({ skinTextureId: "cd".repeat(32) }));
 image = document.querySelector("img"); assert.equal(image.className, ""); assert.match(image.src, new RegExp("cd".repeat(32)));
 assert.equal(image.getAttribute("referrerpolicy"), "no-referrer");
}));
