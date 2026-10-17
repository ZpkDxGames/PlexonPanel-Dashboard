import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

test("SSR starts from stable defaults and browser hydration restores all saved choices", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () =>
        JSON.stringify({
          theme: "light",
          motion: "off",
          skinProvider: "disabled",
          textSize: "large",
          accent: "blue",
        }),
    },
  });
  try {
    const url = pathToFileURL(`${process.cwd()}/src/store/preferences.ts`);
    const { preferences } = await import(`${url.href}?startup-test`);
    assert.equal(preferences.getSnapshot().theme, "dark");
    preferences.hydrate();
    assert.equal(preferences.getSnapshot().theme, "light");
    assert.equal(preferences.getSnapshot().motion, "off");
    assert.equal(preferences.getSnapshot().skinProvider, "disabled");
    assert.equal(preferences.getSnapshot().textSize, "large");
    assert.equal(preferences.getSnapshot().accent, "blue");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
