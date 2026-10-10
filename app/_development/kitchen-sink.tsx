"use client";

import { TickPulse } from "../charts/tick-pulse";
import { Sparkline } from "../charts/sparkline";
import { pulseSpecimens } from "./pulse-fixtures";
import { useState } from "react";
import { useUiPreferences } from "../../components/ui-preferences-provider";
import type { UiPreferencesV1 } from "../../lib/ui-preferences";
import { iconPaths, type IconName } from "../ui/icons";
import { Badge, Button, Dialog, Disclosure, EmptyState, Field, Icon, Menu, Panel, Popover, Select, Skeleton, Table, Tabs, Toast, type Tone } from "../ui/primitives";

// Build-exclusion test searches every production app/static emitted chunk for this marker.
const DEVELOPMENT_MARKER = "PLEXON_UI6_KITCHEN_SINK_DEV_ONLY";
const tones: Tone[] = ["ok", "warn", "critical", "info", "unknown"];
const toneLabels = { ok: "Verified", warn: "Warning", critical: "Failed", info: "Pending", unknown: "Unknown" };
const tableRows = [{ name: "Normal", state: "Available" }, { name: "Read only", state: "Action disabled" }];
const columns = [{ key: "name", label: "Example", rowHeader: true, render: (row: typeof tableRows[number]) => row.name }, { key: "state", label: "State", render: (row: typeof tableRows[number]) => row.state }];

export default function KitchenSink() {
  const { preferences, updatePreference, resolved } = useUiPreferences();
  const [selection, setSelection] = useState("first"); const [tab, setTab] = useState("current"); const [dialog, setDialog] = useState(false);
  const [message, setMessage] = useState("No fixture action selected."); const [toast, setToast] = useState(true);
  return <div className="deepslate lab" data-development-only={DEVELOPMENT_MARKER}>
    <header className="lab-header"><a className="lab-skip" href="#lab-main">Skip to primitives</a><div><p className="pp-muted">Development · foundation specimens</p><h1>Deepslate laboratory</h1><p className="pp-muted">Primitive states only. No live server data or actions.</p></div><Badge tone="info">{resolved.theme} theme</Badge></header>
    <aside className="lab-controls" aria-label="Presentation controls">
      <Select label="Theme" options={[{value:"system",label:"System"},{value:"light",label:"Light"},{value:"dark",label:"Dark"}]} value={preferences.theme} onChange={v => updatePreference("theme", v as UiPreferencesV1["theme"])} />
      <Select label="Accent" options={["monochrome","cyan","violet","emerald","amber"].map(value => ({value,label:value}))} value={preferences.accent} onChange={v => updatePreference("accent", v as UiPreferencesV1["accent"])} />
      <Select label="Density" options={["compact","comfortable","spacious"].map(value => ({value,label:value}))} value={preferences.density} onChange={v => updatePreference("density", v as UiPreferencesV1["density"])} />
      <Select label="Contrast" options={[{value:"system",label:"System"},{value:"standard",label:"Standard"},{value:"high",label:"High"}]} value={preferences.contrast} onChange={v => updatePreference("contrast", v as UiPreferencesV1["contrast"])} />
    </aside>
    <main id="lab-main" className="lab-main" tabIndex={-1}>
      <section className="lab-section" aria-labelledby="lab-pulse"><h2 id="lab-pulse">Tick Pulse and sparklines</h2>{pulseSpecimens.map(specimen=><div key={specimen.name}><h3>{specimen.name}</h3><TickPulse accessibleLabel={`${specimen.name} Tick Pulse specimen`} history={specimen.history} receivedAt={specimen.end} windowEndAt={specimen.end} intervalMs={specimen.intervalMs??2000} status={specimen.name}/><Sparkline history={specimen.history} field="tps" now={specimen.end}/></div>)}</section>
      <section className="lab-section" aria-labelledby="lab-type"><h2 id="lab-type">Type & identifiers</h2><p className="lab-type-specimen">Overview · conexão segura · João · São Paulo · configuração · ação</p><p className="pp-muted">Hanken Grotesk for UI labels and tabular numerals: 20.00 · 50.0 ms · 0123456789</p><p>Command <code>status --server example.local</code></p><p>Path <code>config/paper-global.yml</code></p><p>Fixture UUID <code>00000000-0000-0000-0000-000000000001</code></p></section>
      <section className="lab-section" aria-labelledby="lab-buttons"><h2 id="lab-buttons">Button</h2><p className="pp-muted">Enabled, hover, active, focus, disabled and busy. Move focus or point to inspect interaction states.</p>
        {["primary", "secondary", "quiet", "danger"].map(variant => <div key={variant} className="lab-button-row"><span>{variant}</span><div className="pp-row"><Button variant={variant as "primary"} onClick={() => setMessage(`${variant} fixture clicked`)}>{variant === "danger" ? "Remove fixture" : "Action"}</Button><Button variant={variant as "primary"} disabled>Disabled</Button><Button variant={variant as "primary"} busy>Working…</Button></div></div>)}
        <div className="pp-row"><Button icon="download" onClick={() => setMessage("Download fixture selected")}>With icon</Button><Button icon="search" aria-label="Search specimen" onClick={() => setMessage("Search fixture selected")} /><Button icon="close" disabled aria-label="Unavailable close specimen" /></div>
      </section>
      <section className="lab-section" aria-labelledby="lab-panels"><h2 id="lab-panels">Panel, Badge & Skeleton</h2><div className="lab-grid"><Panel title="Ready"><p>Opaque surfaces and quiet boundaries.</p><div className="pp-row">{tones.map(tone => <Badge key={tone} tone={tone}>{toneLabels[tone]}</Badge>)}</div></Panel><Panel title="Loading"><Skeleton label="Loading fixture panel" /></Panel><Panel title="Empty"><EmptyState title="No entries supplied" action={<Button onClick={() => setMessage("Empty-state fixture selected")}>Example action</Button>}>An explicit empty state, with an optional action.</EmptyState></Panel><Panel title="Error"><Badge tone="critical">Fixture unavailable</Badge><p>No values substituted for missing data.</p><Button onClick={() => setMessage("Retry fixture selected")}>Retry fixture</Button></Panel></div></section>
      <section className="lab-section" aria-labelledby="lab-fields"><h2 id="lab-fields">Field & Select</h2><div className="lab-grid">
        <Field label="Normal field" placeholder="Enter example text" hint="Help text stays attached to its field." />
        <Field label="Required field" required placeholder="Example" />
        <Field label="Invalid field" defaultValue="" error="Enter a fixture value." />
        <Field label="Read-only field" readOnly value="Read only" hint="Readable and selectable." />
        <Field label="Disabled field" disabled value="Unavailable" />
        <Field label="Identifier field" className="pp-identifier" defaultValue="example.local" hint="Hostnames use Commit Mono 400." />
        <Select label="Normal select" value={selection} onChange={setSelection} options={[{value:"first",label:"First option"},{value:"second",label:"Second option"},{value:"disabled",label:"Unavailable option",disabled:true},{value:"third",label:"Third option"}]} hint="Arrows, Home/End and typeahead; Enter selects; Escape closes." />
        <Select label="Disabled select" value="first" onChange={() => {}} disabled options={[{value:"first",label:"Unavailable"}]} />
        <Select label="Read-only select" value="first" onChange={() => {}} readOnly options={[{value:"first",label:"Fixed selection"},{value:"second",label:"Other option"}]} hint="Focusable for inspection; choices cannot be changed." />
        <Select label="Invalid select" value="" onChange={setSelection} options={[{value:"first",label:"First option"}]} error="Choose an example option." />
        <Select label="Empty select" value="" onChange={() => {}} options={[]} hint="No options supplied." />
      </div></section>
      <section className="lab-section" aria-labelledby="lab-floating"><h2 id="lab-floating">Dialog, Popover & Menu</h2><div className="pp-row">
        <Button onClick={() => setDialog(true)}>Open dialog specimen</Button><Button disabled>Unavailable dialog</Button>
        <Popover label="Open popover" title="Source disclosure"><p>Top-layer content. Escape or an outside click closes it.</p></Popover><Popover label="Disabled popover" title="Unavailable" disabled><p>Closed content is inert.</p></Popover>
        <Menu label="Open menu" items={[{label:"Copy fixture",icon:"copy",onSelect:()=>setMessage("Copy fixture selected")},{label:"Download fixture",icon:"download",onSelect:()=>setMessage("Download fixture selected")},{label:"Unavailable action",disabled:true,onSelect:()=>{}}]} />
        <Menu label="Disabled menu" disabled items={[]} />
      </div><p className="pp-muted">Open, closed, focused and unavailable states. Dialog traps focus and restores its opener.</p></section>
      <section className="lab-section" aria-labelledby="lab-tabs"><h2 id="lab-tabs">Tabs & Disclosure</h2><Tabs label="Fixture views" tabs={[{id:"current",label:"Current",content:<p>Selected tab content. Arrow keys move focus; Enter or Space activates.</p>},{id:"history",label:"History",content:<p>History fixture; no server history supplied.</p>},{id:"disabled",label:"Unavailable",disabled:true,content:<p>Disabled content</p>}]} value={tab} onChange={setTab} /><div className="lab-grid"><Disclosure title="Closed disclosure"><p>Hidden until expanded; no focusable children while closed.</p><Button onClick={()=>setMessage("Disclosure fixture selected")}>Contained action</Button></Disclosure><Disclosure title="Open disclosure" defaultOpen><p>Native semantics and keyboard activation.</p></Disclosure></div></section>
      <section className="lab-section" aria-labelledby="lab-tables"><h2 id="lab-tables">Table</h2><div className="lab-grid"><Table caption="Fixture rows" columns={columns} rows={tableRows} rowKey={row=>row.name} /><Table caption="Empty fixture table" columns={columns} rows={[]} rowKey={row=>row.name} empty={<EmptyState title="No rows" >The table is empty.</EmptyState>} /><Table caption="Loading fixture table" columns={columns} rows={[]} rowKey={row=>row.name} loading /></div></section>
      <section className="lab-section" aria-labelledby="lab-toasts"><h2 id="lab-toasts">Toast & feedback</h2><div className="pp-stack">{tones.map(tone=><Toast key={tone} tone={tone}>{toneLabels[tone]} fixture message.</Toast>)}{toast ? <Toast onDismiss={()=>setToast(false)}>Dismissible fixture notification.</Toast> : <Button onClick={()=>setToast(true)}>Show notification again</Button>}<p role="status">{message}</p></div></section>
      <section className="lab-section" aria-labelledby="lab-icons"><h2 id="lab-icons">Icon set</h2><p className="pp-muted">One stroke set, 16/20 px, currentColor. Decorative icons are hidden from assistive technology.</p><ul className="lab-icons">{Object.keys(iconPaths).map(name=><li key={name}><Icon name={name as IconName} /><Icon name={name as IconName} size="small" /><span>{name}</span></li>)}</ul><p><Icon name="info" label="Information specimen" /> Named standalone icon</p></section>
    </main>
    <Dialog open={dialog} onClose={()=>setDialog(false)} title="Dialog specimen" description="A fixture dialog, with no operational action." actions={<><Button onClick={()=>setDialog(false)}>Cancel</Button><Button variant="primary" onClick={()=>{setMessage("Dialog fixture confirmed");setDialog(false);}}>Confirm fixture</Button></>}><Field label="Dialog field" placeholder="Focus remains in this dialog" /><Select label="Dialog select" value={selection} onChange={setSelection} options={[{value:"first",label:"First option"},{value:"second",label:"Second option"}]} /><Badge tone="warn">Fixture confirmation</Badge></Dialog>
    <footer className="lab-footer pp-muted">Development specimen · {DEVELOPMENT_MARKER}</footer>
  </div>;
}
