import {session} from '../adapter/session';
/** Imported exclusively under the development/verification compile-time branch. */
export function startDemo(mode:string) {
 let tick=0;const timer=setInterval(()=>{if(document.hidden)return;const snap=session.getSnapshot();if(!snap.fixture)return;const capturedAt=new Date().toISOString();const idle=mode==='idle';const skew=mode==='skew'?new Date(Date.now()+12000).toISOString():capturedAt;const send=(eventType:string,body:Record<string,unknown>)=>session.receiveFixture({type:'server.event',serverId:snap.state.serverId,agentKind:'PAPER',agentSession:'fixture-paper',eventType,body});
 send('telemetry.server',{...snap.state.server,capturedAt:skew,tps:[idle?20:19.95+Math.sin(tick/5)*.04,19.98,19.99],averageTickMillis:idle?.2:8+Math.sin(tick/9)*3});send('telemetry.system',{...snap.state.system,capturedAt:skew,processCpuPercent:idle?.4:42+Math.sin(tick/4)*8});tick++;
 },3000);if(import.meta.hot)import.meta.hot.dispose(()=>clearInterval(timer));
}
