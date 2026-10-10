import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const out=process.env.UI6_OUTPUT||'artifacts/ui6-m3';
const stage=process.env.UI6_BUNDLE_STAGE||'before';
await mkdir(out,{recursive:true});
const html=await readFile('.next/server/app/index.html','utf8');
const sources=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith('/_next/static/')))];
const initial=[];for(const url of sources){const bytes=await readFile('.next/'+url.replace('/_next/',''));initial.push({url,bytes:bytes.length,gzipBytes:gzipSync(bytes).length});}
const chunks=[];for(const file of await readdir('.next/static/chunks'))if(file.endsWith('.js')){const bytes=await readFile('.next/static/chunks/'+file);chunks.push({file,bytes:bytes.length,gzipBytes:gzipSync(bytes).length});}
const total=rows=>({bytes:rows.reduce((n,r)=>n+r.bytes,0),gzipBytes:rows.reduce((n,r)=>n+r.gzipBytes,0)});
const result={stage,buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),method:'Actual root prerender script URLs; raw bytes and independently gzipped payloads. Entire static-JS set also shown; not all chunks are initial requests.',initial,initialTotal:total(initial),allStaticJS:chunks,allStaticTotal:total(chunks)};
await writeFile(`${out}/bundle-${stage}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({stage,initial:result.initialTotal,allStatic:result.allStaticTotal}));
