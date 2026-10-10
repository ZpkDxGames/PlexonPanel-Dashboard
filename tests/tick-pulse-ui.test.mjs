import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {TickPulse} from '../.test-dist/app/charts/tick-pulse.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('mounted Pulse keeps exact lens/table parity and never rasterizes for age ticks or Host-only repeats',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});const {window}=dom;let draws=0;const lines=[],unknown=[];
 const ctx={scale(){},fillRect(){},strokeRect(...args){unknown.push(args);},beginPath(){},moveTo(){},lineTo(...args){lines.push(args);},stroke(){},setLineDash(){},arc(){},fill(){},closePath(){}};
 window.HTMLCanvasElement.prototype.getContext=()=>{draws++;return ctx;};
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 class Observer{observe(){this.callback([{contentRect:{width:390}}]);}constructor(callback){this.callback=callback;}disconnect(){}}
 const saved=new Map();for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,ResizeObserver:Observer,getComputedStyle:()=>({getPropertyValue:()=> 'rgb(30 40 50)'}),IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));const end=Date.now();
 const row=(at,tps=20,mspt=12)=>({at,sources:{paperHealth:at,paperSystem:null,hostSystem:null,service:null},tps,mspt});
 // The first retained capture is older than the visible 30-minute window.
 let history=Array.from({length:220},(_,i)=>row(end-2000000+i*9000,i===0?0:i===1?null:20,i===0?0:i===1?null:12));
 const render=async()=>act(async()=>root.render(React.createElement(TickPulse,{history,receivedAt:end,windowEndAt:end})));
 try{
  await render();const initial=draws;await act(async()=>delay(1150));assert.equal(draws,initial,'age-clock update must not redraw');
  history=[...history,{...history.at(-1),at:end-1,sources:{...history.at(-1).sources,hostSystem:end-1}}];await render();assert.equal(draws,initial,'Host-only history event must not redraw');
  const fullHistory=history;history=history.slice(1);await render();assert.equal(draws,initial,'Host-only retention pruning must not redraw the capture frame');history=fullHistory;await render();assert.equal(draws,initial);
  const plot=document.querySelector('.pulse-inspect');await act(async()=>plot.focus());await act(async()=>plot.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Home',bubbles:true})));await act(async()=>plot.click());
  const dialog=document.querySelector('dialog[open]');assert.ok(dialog);const facts=()=>[...dialog.querySelectorAll('.pulse-facts dd')].map(el=>el.textContent);
  assert.match(facts()[1],/Critical — 0 ticks\/s/);assert.equal(facts()[2],'0 ms');assert.equal(dialog.querySelector('tbody tr td').textContent,new Date(history[0].sources.paperHealth).toISOString());
  const button=label=>[...dialog.querySelectorAll('button')].find(el=>el.textContent===label);
  await act(async()=>button('Next capture').click());assert.match(facts()[1],/Unknown — Not supplied/);assert.equal(facts()[2],'Not supplied');
  await act(async()=>button('Next page').click());assert.equal(dialog.querySelectorAll('tbody tr').length,100);await act(async()=>button('Next page').click());assert.equal(dialog.querySelectorAll('tbody tr').length,20);
  await act(async()=>dialog.querySelector('[aria-label="Capture inspection"]').dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true})));assert.equal(button('Next capture').disabled,true);
  const last=dialog.querySelector('tbody tr:last-child td button');await act(async()=>last.click());assert.equal(facts()[0],last.textContent);assert.equal(facts()[1].includes('20 ticks/s'),true);assert.equal(button('Next capture').disabled,true);
  await act(async()=>dialog.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));assert.equal(document.activeElement,plot);
  history=[...history,row(end,0,0)];await render();assert.equal(draws,initial+1,'one new Paper capture produces one raster draw');assert.ok(lines.some(([,y])=>y===116),'real zero is drawn at the actual baseline');
  history=[...history,row(end,null,null)];await render();assert.ok(unknown.some(([,y])=>y===60),'unknown is outlined away from the zero baseline');
 }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,value]of saved){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
});
