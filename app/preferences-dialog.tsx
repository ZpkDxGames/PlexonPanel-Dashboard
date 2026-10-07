"use client";
import { useEffect, useRef } from "react";
import { ClientPreferences } from "./client-preferences";

export function PreferencesDialog({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="client-preferences-dialog" aria-labelledby="client-preferences-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header><div><span className="workspace-kicker">YOUR BROWSER</span><h2 id="client-preferences-title">Make it yours</h2><p>Saved automatically for every workspace on this browser.</p></div><button className="ui-button" aria-label="Close client settings" onClick={close}>Done</button></header>
    <ClientPreferences />
  </dialog>;
}
