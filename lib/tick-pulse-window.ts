/** Presentation frame only, not another history or transport owner. */
export type TickPulseWindow = Readonly<{serverId:string;capturedAt:number|null;endAt:number}>;
export function advanceTickPulseWindow(previous:TickPulseWindow,serverId:string,capturedAt:number|null,now:number):TickPulseWindow {
  // Receipt/age-clock changes alone cannot admit a previously future capture.
  if(previous.serverId===serverId&&(previous.capturedAt===capturedAt||capturedAt===null))return previous;
  return {serverId,capturedAt,endAt:now};
}
