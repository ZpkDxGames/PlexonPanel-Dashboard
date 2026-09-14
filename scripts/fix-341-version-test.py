from pathlib import Path

path = Path("tests/dashboard-3-0-scope.test.mjs")
text = path.read_text()
old = '''test("Dashboard visible version metadata matches package 3.4.0", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const settings = await source("app/settings-view-2-1.tsx");
  const server = await source("app/server-view-2-1.tsx");
  const versionSource = await source("lib/dashboard-version.ts");
  const packageJson = JSON.parse(await source("package.json"));
  const version = versionSource.match(/DASHBOARD_VERSION = "([^\"]+)"/)?.[1];
  assert.equal(version, packageJson.version);
  assert.equal(version, "3.4.0");'''
new = '''test("Dashboard visible version metadata matches package 3.4.1", async () => {
  const dashboard = await source("app/dashboard-2-1.tsx");
  const settings = await source("app/settings-view-2-1.tsx");
  const server = await source("app/server-view-2-1.tsx");
  const versionSource = await source("lib/dashboard-version.ts");
  const packageJson = JSON.parse(await source("package.json"));
  const version = versionSource.match(/DASHBOARD_VERSION = "([^\"]+)"/)?.[1];
  assert.equal(version, packageJson.version);
  assert.equal(version, "3.4.1");'''
if new not in text:
    if text.count(old) != 1:
        raise SystemExit(f"version test fixture: expected one match, found {text.count(old)}")
    text = text.replace(old, new)
path.write_text(text)
print("Dashboard 3.4.1 version test fixture applied")
