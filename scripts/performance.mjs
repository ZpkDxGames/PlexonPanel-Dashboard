import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const files = (await readdir("dist/assets")).filter((name)=>name.endsWith(".js"));
const assets = [];
for (const name of files) { const bytes=await readFile(`dist/assets/${name}`); assets.push({name,bytes:bytes.length,gzipBytes:gzipSync(bytes).length}); }
const initial = assets.filter((item)=>item.name.startsWith("index-"));
const report={createdAt:new Date().toISOString(),budget:{initialRouteGzipBytes:180*1024},initialRouteGzipBytes:initial.reduce((n,item)=>n+item.gzipBytes,0),assets};
await mkdir("artifacts",{recursive:true}); await writeFile("artifacts/performance.json",JSON.stringify(report,null,2));
console.log(JSON.stringify({initialRouteGzipBytes:report.initialRouteGzipBytes,budgetBytes:report.budget.initialRouteGzipBytes,assetCount:assets.length},null,2));
if(report.initialRouteGzipBytes>report.budget.initialRouteGzipBytes)process.exitCode=1;
