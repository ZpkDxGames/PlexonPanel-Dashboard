"use client";
import { ClientPreferences } from './client-preferences';
import { Dialog, Button } from './ui/primitives';
export function PreferencesDialog({close}:{close:()=>void}){return <Dialog open onClose={close} title="Make it yours" description="Saved automatically for every workspace on this browser." className="client-preferences-dialog" actions={<Button onClick={close}>Done</Button>}><div className="pp-workspace"><ClientPreferences/></div></Dialog>;}
