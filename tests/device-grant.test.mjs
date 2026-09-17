import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reconcileDeviceGrant } from "../.test-dist/lib/device-grant.js";

test("device permissions use the intersection of signed and reported scopes", () => {
  const grant = reconcileDeviceGrant(
    {
      deviceId: "owner-browser",
      role: "Owner",
      scopes: ["maintenance.view", "backup.view"],
    },
    {
      deviceId: "owner-browser",
      role: "Owner",
      scopes: ["maintenance.view", "backup.view", "maintenance.run"],
    },
  );

  assert.deepEqual(grant, {
    deviceId: "owner-browser",
    role: "Owner",
    scopes: ["maintenance.view", "backup.view"],
    metadataMatches: false,
  });
  assert.equal(grant.scopes.includes("maintenance.run"), false);
});

test("matching signed and reported grants remain fully available", () => {
  const scopes = ["maintenance.view", "maintenance.run"];
  assert.deepEqual(
    reconcileDeviceGrant(
      { deviceId: "owner-browser", role: "Owner", scopes },
      { deviceId: "owner-browser", role: "Owner", scopes: [...scopes].reverse() },
    ),
    {
      deviceId: "owner-browser",
      role: "Owner",
      scopes,
      metadataMatches: true,
    },
  );
});

test("device or role disagreements fail closed", () => {
  const signed = {
    deviceId: "owner-browser",
    role: "Owner",
    scopes: ["maintenance.run"],
  };

  assert.equal(
    reconcileDeviceGrant(signed, {
      deviceId: "different-browser",
      role: "Owner",
      scopes: ["maintenance.run"],
    }),
    null,
  );
  assert.deepEqual(
    reconcileDeviceGrant(signed, {
      deviceId: "owner-browser",
      role: "Operator",
      scopes: ["maintenance.run"],
    }),
    {
      deviceId: "owner-browser",
      role: "",
      scopes: [],
      metadataMatches: false,
    },
  );
});

test("active dashboard and access views consume the reconciled signed grant", async () => {
  const dashboard = await readFile(
    new URL("../app/dashboard-2-1.tsx", import.meta.url),
    "utf8",
  );
  const access = await readFile(
    new URL("../app/infrastructure-views-2-1.tsx", import.meta.url),
    "utf8",
  );
  const backups = await readFile(
    new URL("../app/backups-view-3-4-1.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(dashboard.includes("reconcileDeviceGrant(credential, ready.device)"), true);
  assert.equal(dashboard.includes("canAction(\n          action,\n          grant.scopes,"), true);
  assert.equal(access.includes("currentGrant?.scopes"), true);
  assert.equal(access.includes("Re-pair required"), true);
  assert.equal(backups.includes("Re-pair Owner to resolve"), true);
  assert.equal(
    backups.includes("This browser's signed grant does not include maintenance.run"),
    true,
  );
});
