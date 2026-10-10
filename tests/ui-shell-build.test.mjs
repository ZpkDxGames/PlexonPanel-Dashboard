import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
test('production initial root scripts exclude the workspace owner and Fleet rendering payload',async()=>{
 const html=await readFile('.next/server/app/index.html','utf8');
 const scripts=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith('/_next/static/')))];
 assert.ok(scripts.length>2);
 const initial=(await Promise.all(scripts.map(p=>readFile('.next/'+p.replace('/_next/',''),'utf8')))).join('\n');
 for(const marker of ['PLEXON_UI6_WORKSPACE_CHUNK','Your servers','Server lifecycle']) assert.ok(!initial.includes(marker),'Workspace payload leaked into initial root scripts: '+marker);
 const styles=[...new Set([...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(m=>m[1]))];
 assert.ok(styles.length);
 for(const path of styles){const css=await readFile('.next/'+path.replace('/_next/',''),'utf8');assert.ok(!css.includes('.fleet-card'),'Legacy workspace stylesheet must be deferred too');}
 const emitted=(await Promise.all((await readdir('.next/static/chunks')).filter(p=>p.endsWith('.js')).map(p=>readFile('.next/static/chunks/'+p,'utf8')))).join('\n');
 assert.ok(emitted.includes('PLEXON_UI6_WORKSPACE_CHUNK'));
 assert.ok(emitted.includes('Your servers'));
});
