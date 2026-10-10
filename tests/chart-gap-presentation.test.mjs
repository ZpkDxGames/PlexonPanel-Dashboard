import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TelemetryChart} from '../.test-dist/app/telemetry-chart.js';

test('an explicit missing capture is hatched even inside the normal source gap tolerance',()=>{
  const now=Date.now();const history=Array.from({length:31},(_,i)=>({at:now-60000+i*2000,sources:{paperHealth:now-60000+i*2000,paperSystem:null,hostSystem:null,service:null},tps:i===29?null:20,mspt:null,players:null,heap:null,hostCpu:null,processCpu:null,memory:null,gc:null,serviceCpu:null,serviceMemory:null}));
  const html=renderToStaticMarkup(React.createElement(TelemetryChart,{history,spec:{field:'tps',label:'TPS',shortLabel:'TPS',format:String,source:'paper-health',domain:[0,20],series:1},windowMinutes:1,status:'disconnected',sourceLabel:'Paper health / ticks/s',sourceIntervalMs:2000,sourceCapturedAt:now}));
  assert.match(html,/<rect[^>]+fill="url\(#chart-gaps-tps\)"/);
  assert.match(html,/aria-label="TPS: last observed/);
  assert.doesNotMatch(html,/<linearGradient/);
});
