"use client";
import { useTimestamp } from "../presentation/nextgen/time";
import { useState } from "react";
import { Monitor, RefreshCw, ShieldCheck } from "lucide-react";
import { useSession } from "../hooks";
import { session, type Kind } from "../adapter/session";
import { records, str } from "../adapter/control-state";
import { reconcileDeviceGrant } from "../adapter/device-grant";
import { ACTION_SCOPES } from "../adapter/scopes";
import { useQuery } from "../features/useQuery";
import { ActionButton, useOperation } from "../features/operations";
import { PageHeader } from "../components/PageHeader";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Empty, Notice } from "../components/ui/empty";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { VirtualRows } from "../components/VirtualRows";
export default function Access() {
  const stamp = useTimestamp();
  const snap = useSession(),
    op = useOperation(),
    [source, setSource] = useState<Kind>("HOST"),
    [query, setQuery] = useState(""),
    [authority, setAuthority] = useState("");
  const grant = reconcileDeviceGrant(snap.grant, snap.state.ready?.device),
    auditAction = grant?.scopes.includes("audit.view")
      ? "audit.list"
      : "audit.self",
    deviceKind: Kind = session.reason("devices.list", "PAPER")
      ? "HOST"
      : "PAPER";
  const devices = useQuery("devices.list", deviceKind),
    audit = useQuery(auditAction, source, { limit: 200 });
  const entries = records(audit.data.entries).filter((e) =>
    JSON.stringify(e).toLowerCase().includes(query.toLowerCase()),
  );
  const capability = (kind: Kind, action: string, scope: string) => {
    const caps =
      kind === "PAPER"
        ? snap.state.ready?.server.paperCapabilities
        : snap.state.ready?.server.hostCapabilities;
    return caps?.[action] === true || caps?.[scope] === true
      ? "Advertised"
      : caps?.[action] === false || caps?.[scope] === false
        ? "Disabled"
        : "Not advertised";
  };
  return (
    <>
      <PageHeader
        title="Access & Audit"
        description="Understand your authority. Trace every operation."
        action={
          <Badge>
            <ShieldCheck size={12} />
            {grant?.role ?? "Grant unavailable"}
          </Badge>
        }
      />
      <Tabs defaultValue="audit">
        <TabsList aria-label="Access views">
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="devices">Paired devices</TabsTrigger>
          <TabsTrigger value="authority">Authority matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="audit">
          <Card>
            <CardHeader
              title="Operation trail"
              description="Private results from the selected agent"
              action={
                <div className="flex gap-2">
                  <Select
                    className="w-24"
                    aria-label="Audit source"
                    value={source}
                    onChange={(e) => setSource(e.target.value as Kind)}
                  >
                    <option value="HOST">Host</option>
                    <option value="PAPER">Paper</option>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Refresh audit"
                    onClick={() => void audit.refresh()}
                  >
                    <RefreshCw />
                  </Button>
                </div>
              }
            />
            <div className="p-4">
              <Input
                aria-label="Search audit"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search action, actor, or result…"
              />
            </div>
            {audit.error && (
              <div className="px-4 pb-4">
                <Notice>{audit.error}</Notice>
              </div>
            )}
            {entries.length ? (
              <VirtualRows
                rows={entries}
                label="Audit entries"
                getKey={(e) =>
                  str(e.requestId, `${e.timestamp}:${e.action}:${e.actor}`)
                }
                render={(e) => (
                  <div className="flex flex-wrap items-start justify-between gap-3 border-t px-5 py-4">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs">
                        {str(e.action)}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {str(e.actor)} · {str(e.target)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {str(e.reason ?? e.message, "")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        tone={e.status === "SUCCESS" ? "success" : "warning"}
                      >
                        {str(e.status)}
                      </Badge>
                      <p className="mt-2 font-mono text-[9px] text-muted-foreground">
                        {stamp(e.timestamp)}
                      </p>
                    </div>
                  </div>
                )}
              />
            ) : (
              <Empty title="No audit records received">
                Read permission and a connected source are required.
              </Empty>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="devices">
          <Card>
            <CardHeader
              title="Paired browsers"
              description="A changed role requires a new pairing"
              icon={<Monitor size={16} className="text-muted-foreground" />}
            />
            <CardContent className="space-y-4">
              {devices.error && <Notice>{devices.error}</Notice>}
              {records(devices.data.devices).map((d) => {
                const current =
                  d.deviceId === snap.state.ready?.device.deviceId;
                return (
                  <div
                    key={str(d.deviceId)}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{str(d.name)}</p>
                      <p className="mt-2 break-all font-mono text-[9px] text-muted-foreground">
                        {str(d.deviceId)}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {str(d.role)} ·{" "}
                        {Array.isArray(d.scopes)
                          ? `${d.scopes.length} scopes`
                          : "Scopes unknown"}
                      </p>
                      <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                        Created {stamp(d.createdAt ?? d.issuedAt)}
                        <br />
                        Expires {stamp(d.expiresAt)} · Last active{" "}
                        {stamp(d.lastSeen ?? d.lastActiveAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      {current && <Badge tone="success">This browser</Badge>}
                      <ActionButton
                        action="devices.revoke"
                        kind="PAPER"
                        variant="destructive"
                        blocked={
                          current
                            ? "This browser cannot revoke itself here."
                            : ""
                        }
                        onClick={() =>
                          op.prepare(
                            "devices.revoke",
                            { deviceId: str(d.deviceId) },
                            "PAPER",
                          )
                        }
                      >
                        Review revoke
                      </ActionButton>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="authority">
          <Card>
            <CardHeader
              title="Your authority matrix"
              description="Effective device grant intersected with each agent’s advertised capability"
            />
            <div className="p-4">
              <Input
                aria-label="Search authority"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                placeholder="Action or canonical scope…"
              />
            </div>
            <div
              className="max-h-[600px] overflow-auto"
              tabIndex={0}
              role="region"
              aria-label="Authority matrix"
            >
              <table className="w-full min-w-[760px] text-left text-[10px]">
                <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">Action / Scope</th>
                    <th className="p-4">Device grant</th>
                    <th className="p-4">Paper</th>
                    <th className="p-4">Host</th>
                    <th className="p-4">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ACTION_SCOPES)
                    .filter(([a, s]) =>
                      `${a} ${s}`
                        .toLowerCase()
                        .includes(authority.toLowerCase()),
                    )
                    .map(([action, scope]) => {
                      const kind: Kind =
                          /^(server\.(start|stop|restart)|maintenance\.|backup\.|provider\.|events\.|console\.history)/.test(
                            action,
                          )
                            ? "HOST"
                            : "PAPER",
                        reason = session.reason(action, kind);
                      return (
                        <tr key={action} className="border-t">
                          <td className="p-4 font-mono">
                            {action}
                            <p className="mt-1 text-[9px] text-muted-foreground">
                              {scope}
                            </p>
                          </td>
                          <td className="p-4">
                            {grant?.scopes.includes(scope)
                              ? "Granted"
                              : "Missing"}
                          </td>
                          <td className="p-4">
                            {capability("PAPER", action, scope)}
                          </td>
                          <td className="p-4">
                            {capability("HOST", action, scope)}
                          </td>
                          <td
                            className={`max-w-64 p-4 leading-5 ${reason ? "text-muted-foreground" : "text-primary"}`}
                          >
                            {reason || `Available through ${kind}`}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      {op.review}
    </>
  );
}
