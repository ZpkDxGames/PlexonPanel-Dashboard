import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('demo and styleguide entry imports are compile-time gated',()=>{const entry=readFileSync('src/main.tsx','utf8');assert.match(entry,/if \(import\.meta\.env\.DEV\)/);assert.ok(entry.indexOf('if (import.meta.env.DEV)')<entry.indexOf('import("./development/fixtures")'));const app=readFileSync('src/App.tsx','utf8');assert.match(app,/const Styleguide = import\.meta\.env\.DEV/);});


test("build identity is package-derived and cannot report a stale hard-coded dashboard version",()=>{const script=readFileSync("scripts/identity.mjs","utf8");const pkg=JSON.parse(readFileSync("package.json","utf8"));assert.equal(pkg.version,"6.5.2");assert.match(script,/readFileSync\(new URL\("\.\.\/package\.json"/);assert.doesNotMatch(script,/PlexonPanel 6\.0\.0/);assert.match(script,/referenceDashboard: commit/);});
