export const TELEMETRY_STALE_MS = 30_000;
export function capturedAtMillis(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
export type TelemetryKind = "disconnected" | "waiting" | "live" | "delayed" | "stale" | "skew";
/** Capture and browser receipt are independent clocks; unrelated traffic is never a receipt. */
export function classifyTelemetry({capturedAt,receivedAt,connected,now}:{capturedAt:unknown;receivedAt?:number;connected:boolean;now:number}):{kind:TelemetryKind;label:string;usable:boolean;skewAheadMs:number;ageMs:number|null} {
  const at=capturedAtMillis(capturedAt);
  const receipt=typeof receivedAt==='number'&&Number.isFinite(receivedAt)&&receivedAt>0?receivedAt:null;
  const clock=Math.max(now,receipt??0),skewAheadMs=at===null||receipt===null?0:at-receipt,skew=skewAheadMs>5000;
  const ageMs=at===null?null:Math.max(0,clock-(skew?receipt!:at));
  if(!connected)return {kind:'disconnected',label:'disconnected',usable:false,skewAheadMs,ageMs};
  if(at===null)return {kind:'waiting',label:'waiting for telemetry',usable:false,skewAheadMs,ageMs};
  if(receipt===null&&at>clock+5000)return {kind:'stale',label:'clock mismatch',usable:false,skewAheadMs,ageMs};
  const aged=ageMs!>30000?'stale':ageMs!>10000?'delayed':'live',seconds=Math.floor(ageMs!/1000);
  const note=`clock skew +${Math.round(skewAheadMs/1000)} s · received ${seconds} s ago`;
  return {kind:skew&&aged==='live'?'skew':aged,label:skew?(aged==='live'?note:`${aged} · ${note}`):`${aged} · ${seconds}s`,usable:aged!=='stale',skewAheadMs,ageMs};
}
/** Compatibility for historical observations without browser receipt metadata. */
export function telemetryFreshness(capturedAt:unknown,connected:boolean,now:number){return classifyTelemetry({capturedAt,connected,now});}
