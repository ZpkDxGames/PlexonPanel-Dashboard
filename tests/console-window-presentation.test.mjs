import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ConsoleView} from '../.test-dist/app/console-view.js';
import {emptyControlState} from '../.test-dist/lib/control-state.js';

test('console renders a bounded window of real loaded lines and keeps offline command input disabled',()=>{
  const now=Date.now();const state={...emptyControlState('server'),console:Array.from({length:2500},(_,i)=>({capturedAt:new Date(now+i).toISOString(),content:`Loaded entry ${i}`,level:'INFO',journalCursor:`cursor-${i}`}))};
  const html=renderToStaticMarkup(React.createElement(ConsoleView,{state,connected:false,can:()=>false,run:()=>Promise.reject(new Error('No dispatch')),notice:()=>{}}));
  assert.equal((html.match(/class="pp-console-entry"/g)??[]).length,250);
  assert.match(html,/Loaded entry 2499/);assert.doesNotMatch(html,/>Loaded entry 0</);
  assert.match(html,/aria-label="Console command"[^>]*disabled=""|disabled=""[^>]*aria-label="Console command"/);
  assert.match(html,/Clears this view only\. Server logs are not deleted\./);
  assert.match(html,/aria-live="off"/);
});
