import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const out=process.env.UI6_OUTPUT||'artifacts/ui6-m2';await mkdir(out,{recursive:true});
const canonical=JSON.parse(await readFile('docs/ui6-design/tokens.json','utf8'));
const css=await readFile('app/styles/tokens.css','utf8');
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const lum=hex=>rgb(hex).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const mix=(foreground,background,alpha)=>'#'+rgb(foreground).map((v,i)=>Math.round(v*alpha+rgb(background)[i]*(1-alpha)).toString(16).padStart(2,'0')).join('').toUpperCase();
const rows=[],composites=[];
for(const theme of ['light','dark']) {
  const block=css.match(theme==='light'?/:root, \[data-plexon-theme="light"\] \{([^}]+)\}/:/\[data-plexon-theme="dark"\] \{([^}]+)\}/)[1];
  const shipped={};for(const [,name,value] of block.matchAll(/--ds-([\w-]+):\s*(#[\da-f]{6});/gi)){shipped[name]=value;const key=name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());assert.equal(value,canonical[theme][key],`${theme}/${name} canonical mismatch`);}
  for(const foreground of ['text','muted','ok','warn','critical','info','unknown','mono','cyan','violet','emerald','amber','boundary','border-quiet'])for(const background of ['canvas','surface','raised','sunken']) {
    const threshold=foreground==='boundary'?3:4.5;const required=foreground!=='border-quiet';const actual=ratio(shipped[foreground],shipped[background]);rows.push({theme,foreground,background,ratio:actual,threshold,required,pass:actual>=threshold});
  }
  for(const accent of ['mono','cyan','violet','emerald','amber','critical']){const actual=ratio(shipped['on-accent'],shipped[accent]);rows.push({theme,foreground:'on-accent',background:accent,ratio:actual,threshold:4.5,required:true,pass:actual>=4.5});}
  for(const alpha of [.55,.18])for(const surface of ['canvas','surface','raised','sunken']) {
    const composited=mix('#161B1F',shipped[surface],alpha);
    composites.push({theme,token:alpha===.55?'overlay':'float-shadow',background:surface,alpha,composited,foreground:'none',essential:false,reason:alpha===.55?'Backdrop has no text; background is inert while opaque dialog content is readable.':'Shadow is decorative; essential floating boundary uses the opaque boundary token.',dialogTextOnRaisedRatio:ratio(shipped.text,shipped.raised),dialogMutedOnRaisedRatio:ratio(shipped.muted,shipped.raised),essentialBoundaryOnRaisedRatio:ratio(shipped.boundary,shipped.raised)});
  }
}
assert.ok(rows.filter(r=>r.required).every(r=>r.pass));
const result={method:'WCAG relative sRGB luminance; CSS alpha composite uses sRGB channels, rounded only after mixing; thresholds checked unrounded.',canonicalTokens:'PASS',requiredPairs:rows.filter(r=>r.required).length,minimumTextRatio:Math.min(...rows.filter(r=>r.required&&r.threshold===4.5).map(r=>r.ratio)),minimumBoundaryRatio:Math.min(...rows.filter(r=>r.foreground==='boundary').map(r=>r.ratio)),decorativeQuietFailures:rows.filter(r=>!r.required&&!r.pass).length,rows,composites};
await writeFile(join(out,'contrast.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({required:result.requiredPairs,minText:result.minimumTextRatio,minBoundary:result.minimumBoundaryRatio,composites}));
