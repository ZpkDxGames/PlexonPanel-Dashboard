import { firefox, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4173",
  b = await firefox.launch(),
  c = await b.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
await c.route("**/*", (r) =>
  new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
);
await c.addInitScript(() =>
  localStorage.setItem(
    "plexon:preferences",
    JSON.stringify({ motion: "off", skinProvider: "disabled" }),
  ),
);
const p = await c.newPage(),
  results = [],
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${base}/?fixture=healthy#Players`);
await p.locator(".player-row").first().waitFor();
await p.getByRole("button", { name: "Inspect LumaCraft", exact: true }).click();
const uuid = await p.evaluate(async () => {
  const { session } = await import("/src/adapter/session.ts");
  return session.getSnapshot().state.players.find((p) => p.name === "LumaCraft")
    .uuid;
});
async function review(action, subject, typed = false) {
  const d = p.locator(".review-dialog");
  await expect(d).toBeVisible();
  await expect(d.locator(".review-target")).toContainText(action);
  const params = JSON.parse(
    await d.locator(".parameter-preview").first().textContent(),
  );
  expect(params.playerId ?? params.backupId).toBe(subject);
  const dispatch = d.getByRole("button", {
    name: "Dispatch operation",
    exact: true,
  });
  if (typed) {
    await expect(dispatch).toBeDisabled();
    await d.locator("input").fill("WRONG-SUBJECT");
    await expect(dispatch).toBeDisabled();
  }
  results.push({ action, subject, typed, parameters: params });
  await d.getByRole("button", { name: "Cancel", exact: true }).click();
}
for (const [label, action] of [
  ["Heal", "player.heal"],
  ["Feed", "player.feed"],
]) {
  await p.getByRole("button", { name: label, exact: true }).click();
  await review(action, uuid);
}
await p
  .getByLabel("Private message", { exact: true })
  .fill("Synthetic review only");
await p.getByRole("button", { name: "Review message", exact: true }).click();
await review("player.message", uuid);
await p.getByRole("button", { name: "Review game mode", exact: true }).click();
await review("player.gamemode", uuid);
await p.getByRole("button", { name: "Moderate", exact: true }).click();
for (const [label, action, typed] of [
  ["Whitelist", "player.whitelist.add", false],
  ["Remove whitelist", "player.whitelist.remove", false],
  ["Kick", "player.kick", false],
  ["Ban", "player.ban", true],
  ["Kill", "player.kill", true],
  ["OP", "player.op", true],
  ["De-op", "player.deop", true],
]) {
  await p.getByRole("button", { name: label, exact: true }).click();
  await review(action, uuid, typed);
}
await p.evaluate(() => (location.hash = "Backups"));
await p.locator(".backup-table tbody tr").first().waitFor();
const id = await p
  .locator(".backup-table tbody tr")
  .first()
  .locator("td small")
  .textContent();
for (const [label, action, typed] of [
  ["Verify", "backup.full.verify", false],
  ["Delete", "backup.full.delete", true],
]) {
  await p
    .locator(".backup-table tbody tr")
    .first()
    .getByRole("button", { name: label, exact: true })
    .click();
  await review(action, id, typed);
}
await p
  .getByRole("button", { name: "Review upload retry", exact: true })
  .click();
await review("backup.full.retry-upload", id);
const unexpected = await p.evaluate(
  async (actions) => {
    const { actionLog } = await import("/src/development/fixtures.ts");
    return actionLog.filter((row) => actions.includes(row.action));
  },
  results.map((row) => row.action),
);
expect(unexpected).toEqual([]);
expect(errors).toEqual([]);
await b.close();
await mkdir("artifacts/nextgen", { recursive: true });
await writeFile(
  "artifacts/nextgen/action-parity.json",
  JSON.stringify(
    {
      scope:
        "Prepare and cancel only. All network outside localhost blocked; no agent mutations executed.",
      results,
      errors,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ preparedAndCancelled: results.length, errors }));
