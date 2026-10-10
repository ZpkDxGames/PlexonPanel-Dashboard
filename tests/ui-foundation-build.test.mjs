import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function files(root) {
  const result=[];for(const entry of await readdir(root,{withFileTypes:true})) {
    const path=join(root,entry.name); if(entry.isDirectory())result.push(...await files(path));else result.push(path);
  }return result;
}

test('actual production manifest and emitted chunks exclude the development kitchen sink',async()=>{
  const manifest=JSON.parse(await readFile('.next/server/app-paths-manifest.json','utf8'));
  assert.ok(Object.keys(manifest).some(k=>k==='/page'),'Production app manifest must exist and contain the real home page');
  assert.ok(!JSON.stringify(manifest).includes('kitchen-sink'));
  const marker='PLEXON_UI6_KITCHEN_SINK_DEV_ONLY';
  const pulseMarker='PLEXON_UI6_PULSE_FIXTURES_DEV_ONLY';
  assert.ok((await readFile('app/_development/pulse-fixtures.ts','utf8')).includes(pulseMarker));
  assert.ok((await readFile('app/_development/kitchen-sink.tsx','utf8')).includes(marker),'Marker must exist in the real dev source');
  let inspected=0;
  for(const path of [...await files('.next/server/app'),...await files('.next/static/chunks')]) {
    if(!/\.(?:js|css|html|rsc|json|map)$/.test(path))continue;
    const content=await readFile(path,'utf8');assert.ok(!content.includes(pulseMarker),`Pulse fixtures leaked into ${path}`);assert.ok(!content.includes(marker),`Dev-only marker leaked into ${path}`);inspected++;
    if (path.endsWith('.css')) assert.ok(!content.includes('.lab-section'), `Dev-only gallery CSS leaked into ${path}`);
  }
  assert.ok(inspected>10,'Do not pass an empty output scan');
});

test('production emits joined Hanken subset faces and a non-preloaded Commit Mono face',async()=>{
  const css=(await Promise.all((await files('.next/static/chunks')).filter(p=>p.endsWith('.css')).map(p=>readFile(p,'utf8')))).join('\n');
  const faces=[...css.matchAll(/@font-face\{([^}]+)\}/g)].map(m=>m[1]);
  const hanken=faces.filter(f=>/font-family:["']?Plexon Hanken/.test(f)&&f.includes('unicode-range'));
  assert.equal(hanken.length,2);
  assert.ok(hanken.every(f=>/font-weight:100 900/.test(f)));
  assert.ok(hanken.some(f=>/unicode-range:[^;]*(?:U\+0{0,3}0-FF|U\+\?\?)/i.test(f)));
  assert.ok(hanken.some(f=>/unicode-range:[^;]*U\+100-2BA/i.test(f)));
  assert.equal(faces.filter(f=>/font-family:["']?Plexon Commit Mono/.test(f)&&f.includes('font-weight:400')&&f.includes('unicode-range')).length,1);
  const html=await readFile('.next/server/app/index.html','utf8');
  const preloads=[...html.matchAll(/<link[^>]*as="font"[^>]*>/g)].map(m=>m[0]);
  assert.equal(preloads.length,1,'Only Hanken Latin should preload');
  for(const token of ['ui','mono']){
    const stack=css.match(new RegExp(`--ds-font-${token}:([^;]+)`))?.[1];
    assert.ok(stack&&/"?Plexon Hanken"?,\s*"?hankenLatin Fallback"?/.test(stack),'Adjusted fallback must immediately follow Hanken in '+token);
  }
  assert.ok(faces.some(f=>f.includes('hankenLatin Fallback')&&f.includes('size-adjust')&&f.includes('ascent-override')));
});

test('foundation components use palette tokens and vendored font licenses are present',async()=>{
  for(const path of [...await files('app/ui'),...await files('app/charts'),...await files('app/_development'),...await files('app/styles')]) {
    if(path.endsWith('tokens.css')||!/\.(?:tsx|css)$/.test(path))continue;
    const source=await readFile(path,'utf8');assert.ok(!/#[\da-f]{3,8}\b/i.test(source),`Raw hex in ${path}`);
  }
  for(const license of ['HANKEN-OFL.txt','COMMIT-MONO-OFL.txt'])assert.ok((await readFile(join('app/fonts',license),'utf8')).includes('SIL OPEN FONT LICENSE'));
});
