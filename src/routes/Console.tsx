"use client";
import { useTimestamp } from "../presentation/nextgen/time";
import { useState } from "react";
import { MessageSquare, Puzzle, Send, TerminalSquare } from "lucide-react";
import { useSession } from "../hooks";
import { str } from "../adapter/control-state";
import { session } from "../adapter/session";
import { hasScope } from "../presentation/authority";
import { PageHeader } from "../components/PageHeader";
import { ConsolePanel } from "../components/terminal/ConsolePanel";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Field, Input, Textarea } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Empty } from "../components/ui/empty";
import { FormattedText } from "../components/FormattedText";
import { ActionButton, useOperation } from "../features/operations";
export default function Console() {
  const stamp = useTimestamp();
  const snap = useSession(),
    op = useOperation(),
    [chat, setChat] = useState(""),
    [mini, setMini] = useState(false),
    [query, setQuery] = useState("");
  const miniAllowed = !session.reason("chat.send.minimessage", "PAPER");
  return (
    <>
      <PageHeader
        title="Console & Chat"
        description="Live server output, player conversations, and plugin inventory."
      />
      <Tabs defaultValue="console">
        <TabsList aria-label="Console workspace">
          <TabsTrigger value="console">
            <TerminalSquare />
            Console
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare />
            Live Chat
          </TabsTrigger>
          <TabsTrigger value="plugins">
            <Puzzle />
            Plugins
          </TabsTrigger>
        </TabsList>
        <TabsContent value="console">
          <ConsolePanel />
        </TabsContent>
        <TabsContent value="chat">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Global chat"
                action={
                  <Badge dot tone="info">
                    Paper
                  </Badge>
                }
              />
              <CardContent className="min-h-96 space-y-5">
                {hasScope(snap, "chat.view") && snap.state.chat.length ? (
                  snap.state.chat.map((m, i) => (
                    <div key={`${m.capturedAt}:${i}`}>
                      <p className="flex justify-between gap-3 text-xs font-semibold">
                        {str(m.playerName)}
                        <time className="font-mono text-[9px] font-normal text-muted-foreground">
                          {stamp(m.capturedAt)}
                        </time>
                      </p>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        <FormattedText value={str(m.message, "")} />
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty
                    title={
                      hasScope(snap, "chat.view")
                        ? "No chat received"
                        : "Chat access restricted"
                    }
                  >
                    Current session messages arrive from the Host or Paper feed.
                  </Empty>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                title="Send a message"
                description="Reviewed through your Paper authority"
              />
              <CardContent className="space-y-4">
                <Field label="Message">
                  <Textarea
                    rows={5}
                    maxLength={512}
                    value={chat}
                    onChange={(e) => setChat(e.target.value)}
                    placeholder="Say something to your players…"
                  />
                </Field>
                <label className="flex items-center justify-between text-xs">
                  MiniMessage
                  <Switch
                    checked={mini && miniAllowed}
                    disabled={!miniAllowed}
                    onCheckedChange={setMini}
                  />
                </label>
                {!miniAllowed && (
                  <p className="text-[10px] text-muted-foreground">
                    MiniMessage requires chat.send.minimessage and Paper
                    capability.
                  </p>
                )}
                <div className="rounded-lg border bg-background p-3 text-xs">
                  <FormattedText value={chat || "Message preview"} composer />
                </div>
                <ActionButton
                  action="chat.global.send"
                  kind="PAPER"
                  disabled={!chat.trim()}
                  onClick={() =>
                    op.prepare(
                      "chat.global.send",
                      { message: chat, miniMessage: mini && miniAllowed },
                      "PAPER",
                    )
                  }
                >
                  <Send />
                  Review send
                </ActionButton>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="plugins">
          <Card>
            <CardHeader
              title="Plugin inventory"
              action={
                <Input
                  className="w-52"
                  aria-label="Search plugins"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search plugins…"
                />
              }
            />
            <CardContent className="space-y-4">
              {hasScope(snap, "plugins.view") ? (
                snap.state.plugins
                  .filter((p) =>
                    `${p.name} ${p.version}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <div
                      key={str(p.name)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Puzzle size={18} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold">{str(p.name)}</p>
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {str(p.version)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          tone={p.enabled === true ? "success" : "neutral"}
                        >
                          {p.enabled === true
                            ? "Enabled"
                            : p.enabled === false
                              ? "Disabled"
                              : "Unknown"}
                        </Badge>
                        <ActionButton
                          action="plugin.command.reload"
                          kind="PAPER"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            op.prepare(
                              "plugin.command.reload",
                              { plugin: str(p.name) },
                              "PAPER",
                            )
                          }
                        >
                          Review reload
                        </ActionButton>
                      </div>
                    </div>
                  ))
              ) : (
                <Empty title="Plugin access restricted">
                  This device needs plugins.view.
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {op.review}
    </>
  );
}
