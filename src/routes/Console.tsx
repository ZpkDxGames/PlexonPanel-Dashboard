import { useMemo, useRef, useState } from "react";
import { str, type JsonMap } from "../adapter/control-state";
import { session, type Prepared } from "../adapter/session";
import { FormattedText } from "../components/FormattedText";
import { PlayerHead } from "../components/PlayerHead";
import { Button, Notice, Panel, Status } from "../components/ui";
import { ActionReview } from "../features/ActionReview";
import { useSession } from "../hooks";

type Tab = "console" | "chat" | "plugins";
const lineHeight = 28;

function stamp(value: unknown) {
  const at = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? new Intl.DateTimeFormat(undefined, { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits:3, hour12:false }).format(at) : "--:--:--.---";
}

function ConsoleLines({ lines, wrap }: { lines: JsonMap[]; wrap: boolean }) {
  const [scrollTop, setScrollTop] = useState(0); const height = 520;
  const start = wrap ? Math.max(0, lines.length - 400) : Math.max(0, Math.floor(scrollTop / lineHeight) - 8);
  const count = wrap ? 400 : Math.ceil(height / lineHeight) + 16;
  const visible = lines.slice(start, start + count);
  return <div className={`terminal-scroll ${wrap ? "wrap" : "nowrap"}`} style={{ height }} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} tabIndex={0} aria-label="Console output">
    <div className="terminal-spacer" style={wrap ? undefined : { height: lines.length * lineHeight }}>
      <div style={wrap ? undefined : { transform:`translateY(${start * lineHeight}px)` }}>{visible.map((line, index) => <div className="terminal-line" key={str(line.id, `${start+index}`)} title={`Timestamp source: ${line.capturedAt ? "server capture" : "browser receipt"}`}>
        <time>{stamp(line.capturedAt ?? line.receivedAt)}</time><span className={`level level-${str(line.level,"info").toLowerCase()}`}>{str(line.level,"INFO")}</span><span className="line-source" title={str(line.source,"unknown")}>{str(line.source,"unknown")}</span><span className="line-message"><FormattedText value={str(line.content ?? line.rawText, "")} /></span>
      </div>)}</div>
    </div>
  </div>;
}

export default function Console() {
  const snap = useSession(); const [tab,setTab] = useState<Tab>("console"); const [query,setQuery] = useState(""); const [level,setLevel] = useState("all"); const [paused,setPaused] = useState(false); const [frozen,setFrozen] = useState<JsonMap[]>([]); const [cleared,setCleared] = useState(false); const [wrap,setWrap] = useState(false); const [command,setCommand] = useState(""); const [chat,setChat] = useState(""); const [mini,setMini] = useState(false); const [prepared,setPrepared] = useState<Prepared|null>(null); const [error,setError] = useState("");
  const current = paused ? frozen : snap.state.console;
  const lines = useMemo(() => cleared ? [] : current.filter((line) => (level === "all" || str(line.level).toLowerCase() === level) && str(line.content ?? line.rawText, "").toLowerCase().includes(query.toLowerCase())), [current,query,level,cleared]);
  const consoleKind = snap.state.ready?.consoleAuthority === "HOST" ? "HOST" : "PAPER";
  const prepare = (action:string, parameters:JsonMap, kind:"HOST"|"PAPER"=consoleKind) => { setError(""); try { setPrepared(session.prepare(action,parameters,kind)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Action unavailable."); } };
  const togglePause = () => { if (!paused) setFrozen(snap.state.console); setPaused((value)=>!value); };
  const exportLines = () => { const value=lines.map((line)=>`${str(line.capturedAt)} ${str(line.level)} ${str(line.source)} ${str(line.content)}`).join("\n"); const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob([value],{type:"text/plain"})); link.download=`plexon-console-${Date.now()}.log`; link.click(); URL.revokeObjectURL(link.href); };
  return <>
    <div className="workspace-tabs" role="tablist"><button className={tab==="console"?"active":""} onClick={()=>setTab("console")}>Console</button><button className={tab==="chat"?"active":""} onClick={()=>setTab("chat")}>Chat</button><button className={tab==="plugins"?"active":""} onClick={()=>setTab("plugins")}>Plugins</button></div>
    {tab === "console" && <Panel eyebrow="Bound stream" title="Server console" action={<Status tone={snap.phase==="live"?"success":"neutral"}>{snap.state.ready?.consoleAuthority ?? "unavailable"}</Status>}>
      <div className="console-toolbar"><input aria-label="Search console" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search output"/><select aria-label="Level filter" value={level} onChange={(e)=>setLevel(e.target.value)}><option value="all">All levels</option><option value="info">Info</option><option value="warn">Warnings</option><option value="error">Errors</option></select><Button onClick={togglePause}>{paused?`Resume · ${snap.state.console.length-frozen.length} new`:"Pause"}</Button><Button onClick={()=>setWrap(v=>!v)}>{wrap?"No wrap":"Wrap"}</Button><Button onClick={exportLines} disabled={!lines.length}>Export</Button><Button variant="quiet" onClick={()=>setCleared(v=>!v)}>{cleared?"Undo clear":"Clear view"}</Button></div>
      <ConsoleLines lines={lines} wrap={wrap}/>
      <div className="terminal-status"><span>{lines.length} visible / {snap.state.console.length} retained</span><span>{paused?"paused; ingestion continues":"following live IDs"}</span><span>{snap.state.ready?.consoleAuthority === "HOST" ? "Host journal" : "Paper fallback"}</span></div>
      <form className="command-composer" onSubmit={(e)=>{e.preventDefault();if(command.trim())prepare("console.execute",{command:command.trim()});}}><span aria-hidden="true">›</span><textarea aria-label="Server command" value={command} onChange={(e)=>setCommand(e.target.value.replace(/[\r\n]+/g," "))} placeholder="Run an allowed command" rows={1}/><Button variant="primary" type="submit" disabled={!command.trim() || Boolean(session.reason("console.execute",consoleKind))}>Review</Button></form>
      {error&&<div className="console-error"><Notice tone="error" title="Console action unavailable">{error}</Notice></div>}
    </Panel>}
    {tab === "chat" && <div className="chat-layout"><Panel eyebrow="Paper stream" title="Global chat" action={<Status tone={snap.state.ready?.agents.paper?"success":"neutral"}>{snap.state.chat.length} retained</Status>}><div className="chat-stream">{snap.state.chat.length?snap.state.chat.map((item,index)=><div className="chat-line" key={`${str(item.capturedAt)}:${index}`}><PlayerHead uuid={str(item.playerUuid,"00000000-0000-4000-8000-000000000000")} name={str(item.playerName,"Unknown")}/><div><strong>{str(item.playerName,"Unknown")}</strong><time>{stamp(item.capturedAt)}</time><p><FormattedText value={str(item.message,"")}/></p></div></div>):<div className="inline-empty"><strong>No chat received</strong><span>Messages appear only when the device has chat.view.</span></div>}</div></Panel><Panel eyebrow="Reviewed send" title="Compose message"><div className="chat-compose"><label className="field">Message<textarea rows={5} value={chat} onChange={(e)=>setChat(e.target.value.slice(0,512))}/></label><label className="check-row"><input type="checkbox" checked={mini} onChange={(e)=>setMini(e.target.checked)} disabled={Boolean(session.reason("chat.global.send","PAPER"))}/> MiniMessage (requires advertised grant)</label><div className="composer-preview"><span>Preview</span><p><FormattedText value={chat||"Your message preview"} composer/></p></div><Button variant="primary" onClick={()=>prepare("chat.global.send",{message:chat,miniMessage:mini},"PAPER")} disabled={!chat.trim()||Boolean(session.reason("chat.global.send","PAPER"))}>Review send</Button></div></Panel></div>}
    {tab === "plugins" && <Panel eyebrow="Paper inventory" title="Plugins" action={<span className="subtle">Observed inventory only</span>}><div className="plugin-list">{snap.state.plugins.length?snap.state.plugins.map((plugin)=><div className="plugin-row" key={str(plugin.name)}><div><strong>{str(plugin.name)}</strong><span>{str(plugin.version,"Version unknown")}</span></div><Status tone={plugin.enabled===true?"success":"neutral"}>{plugin.enabled===true?"enabled":"disabled"}</Status><Button disabled={Boolean(session.reason("plugin.command.reload","PAPER"))} title={session.reason("plugin.command.reload","PAPER")} onClick={()=>prepare("plugin.command.reload",{plugin:str(plugin.name)},"PAPER")}>Review reload</Button></div>):<div className="inline-empty"><strong>No plugin inventory</strong><span>Waiting for a Paper inventory snapshot.</span></div>}</div></Panel>}
    <ActionReview prepared={prepared} onClose={()=>setPrepared(null)}/>
  </>;
}
