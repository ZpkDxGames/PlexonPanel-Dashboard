import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const base=process.env.UI6_EXTRACTION_BASE || '40d159a';
const out=process.env.UI6_OUTPUT || 'artifacts/ui6-m3/m3a';
await mkdir(out,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const original=path=>execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8'});
function markup(source) {
  const file=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),roots=[];
  function visit(node){if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node)){roots.push(node.getText(file));return;}ts.forEachChild(node,visit);}visit(file);return roots;
}
const before=markup(original('app/dashboard.tsx')),after=markup(await readFile('app/dashboard.tsx','utf8'));
assert.deepEqual(after,before,'Every complete JSX subtree must be byte-identical during M3a');
const css=execFileSync('git',['ls-files','*.css'],{encoding:'utf8'}).trim().split('\n');
const styles=[];for(const path of css){const before=hash(original(path)),after=hash(await readFile(path));assert.equal(after,before,`M3a changed ${path}`);styles.push({path,sha256:after});}
const protectedPaths=['protocol','relay','lib/data-source.ts','lib/control-state.ts','lib/fleet-feed.ts','lib/browser-store.ts','package.json','package-lock.json','docs/ui-evidence/after'];
const protectedDiff=execFileSync('git',['diff',base,'--',...protectedPaths],{encoding:'utf8'});assert.equal(protectedDiff,'','Protected logic/dependencies/accepted evidence must be unchanged');
const browserBefore=hash(original('scripts/verify-ui-browser.mjs')),browserAfter=hash(await readFile('scripts/verify-ui-browser.mjs'));assert.equal(browserAfter,browserBefore);
const result={status:'PASS',base,jsxRoots:after.length,jsxSHA256:hash(after.join('\n')),styles,browserScriptSHA256:browserAfter,protectedPaths};
await writeFile(`${out}/extraction-diff-review.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,jsxRoots:result.jsxRoots,styles:styles.length,unchangedBrowserScript:true}));
