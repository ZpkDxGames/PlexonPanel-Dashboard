"use client";
import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  Palette,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  preferences,
  usePreferences,
  type Preferences,
} from "../store/preferences";
import { useSession } from "../hooks";
import { session } from "../adapter/session";
import { diagnostics } from "../adapter/control-state";
import { PairingForm } from "../components/PairingForm";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Notice } from "../components/ui/empty";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
function Preference<K extends keyof Preferences>({
  label,
  name,
  options,
}: {
  label: string;
  name: K;
  options: readonly string[];
}) {
  const prefs = usePreferences();
  return (
    <Field label={label}>
      <Select
        value={String(prefs[name])}
        onChange={(e) =>
          preferences.update({ [name]: e.target.value } as Partial<Preferences>)
        }
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
export default function Settings() {
  const snap = useSession(),
    prefs = usePreferences(),
    [origin, setOrigin] = useState(snap.relay.origin),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [build, setBuild] = useState<Record<string, unknown>>({});
  useEffect(() => setOrigin(snap.relay.origin), [snap.relay.origin]);
  useEffect(() => {
    let active = true;
    void fetch("/build.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (active) setBuild(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const save = async () => {
    setError("");
    setMessage("");
    try {
      await session.setRelayOrigin(origin);
      setMessage("Relay origin saved. Reconnecting to the selected server.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Relay configuration failed");
    }
  };
  const exportDiagnostics = () => {
    const report = {
        build,
        protocolVersion: 3,
        diagnostics: diagnostics(snap.state).split("\n"),
      },
      url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
      );
    const a = document.createElement("a");
    a.href = url;
    a.download = "plexonpanel-redacted-diagnostics.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeader
        title="Settings"
        description="Make the workspace yours. Keep your connection in view."
      />
      <Tabs defaultValue="appearance">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        <TabsContent value="appearance">
          <Card>
            <CardHeader
              title="Workspace preferences"
              description="Saved on this browser"
              icon={<Palette size={17} className="text-primary" />}
            />
            <CardContent>
              <div className="grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Preference
                  label="Theme"
                  name="theme"
                  options={["dark", "light", "system"]}
                />
                <Preference
                  label="Density"
                  name="density"
                  options={["compact", "comfortable", "spacious"]}
                />
                <Preference
                  label="Text size"
                  name="textSize"
                  options={["small", "standard", "large"]}
                />
                <Preference
                  label="Accent"
                  name="accent"
                  options={["teal", "blue", "violet"]}
                />
                <Preference
                  label="Motion"
                  name="motion"
                  options={["full", "reduced", "off"]}
                />
                <Preference
                  label="Timezone"
                  name="timezone"
                  options={["browser", "UTC"]}
                />
                <label className="flex items-center justify-between gap-4 text-xs">
                  Chart gradient fills
                  <Switch
                    checked={prefs.chartFill}
                    onCheckedChange={(chartFill) =>
                      preferences.update({ chartFill })
                    }
                    aria-label="Chart gradient fills"
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="connection">
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Relay connection"
                description="HTTPS and WSS use the same configured origin"
                icon={<Radio size={17} className="text-primary" />}
              />
              <CardContent className="space-y-5">
                <Field label="Relay HTTPS origin">
                  <Input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="https://relay.example.com"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void save()}>Save origin</Button>
                  <Button variant="outline" onClick={() => session.reconnect()}>
                    Reconnect
                  </Button>
                </div>
                {error && <Notice danger>{error}</Notice>}
                {message && <Notice>{message}</Notice>}
                <p className="text-xs text-muted-foreground">
                  {snap.credentials.length} paired server credentials in this
                  browser.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                title="Pair another server"
                description="A fresh one-time code creates a scoped browser identity"
              />
              <CardContent>
                <PairingForm />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="privacy">
          <Card>
            <CardHeader
              title="Data & privacy"
              description="Operational history stays on your VPS"
              icon={<ShieldCheck size={17} className="text-primary" />}
            />
            <CardContent className="space-y-6">
              <div className="max-w-lg">
                <Preference
                  label="Player skin provider"
                  name="skinProvider"
                  options={[
                    "disabled",
                    "proxy",
                    "crafatar",
                    "mc-heads",
                    "minotar",
                  ]}
                />
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  External skin providers receive player UUIDs and your request
                  IP. Disabled uses a local identity tile.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Device credentials", "Origin-bound IndexedDB"],
                  [
                    "Console, chat & player events",
                    "VPS persistence · volatile tab memory",
                  ],
                  ["UI preferences", "Eight choices in localStorage"],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-xl border bg-background p-4"
                  >
                    <h3 className="text-xs font-semibold">{title}</h3>
                    <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="diagnostics">
          <Card>
            <CardHeader
              title="Connection diagnostics"
              description="Credential-free state and build identity"
              icon={
                <SlidersHorizontal
                  size={17}
                  className="text-muted-foreground"
                />
              }
            />
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(diagnostics(snap.state))
                      .then(() => toast.success("Redacted diagnostics copied"))
                      .catch(() => toast.error("Clipboard unavailable"));
                  }}
                >
                  <Copy />
                  Copy diagnostics
                </Button>
                <Button onClick={exportDiagnostics}>
                  <Download />
                  Export redacted JSON
                </Button>
              </div>
              <pre
                tabIndex={0}
                aria-label="Redacted diagnostics"
                className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-terminal p-5 font-mono text-[10px] leading-6"
              >
                {diagnostics(snap.state)}
              </pre>
              <p className="break-all font-mono text-[9px] text-muted-foreground">
                Build {String(build.commit ?? "not reported")} ·{" "}
                {String(build.builtAt ?? "time not reported")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
