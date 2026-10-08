// Run after a clean optimized production build; these are emitted assets, not transfer measurements.
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

if(!existsSync('.next/BUILD_ID'))throw new Error('A production build is required');
const directory='.next/static/chunks';
const files=readdirSync(directory).filter(file=>/\.(js|css)$/.test(file)).sort();
const asset=file=>readFileSync(directory+'/'+file);
const sum=(names,measure)=>names.reduce((total,file)=>total+measure(asset(file)),0);
const js=files.filter(file=>file.endsWith('.js'));
const css=files.filter(file=>file.endsWith('.css'));
const html=readFileSync('.next/server/app/index.html','utf8');
const initialHtmlScripts=[...new Set([...html.matchAll(/(?:src|href)="\/_next\/(static\/chunks\/[^" ]+\.js)"/g)].map(match=>match[1]))];
if(!js.length||!css.length||!initialHtmlScripts.length)throw new Error('Incomplete production asset inventory');
const initial=initialHtmlScripts.map(file=>file.split('/').at(-1));
const source=readFileSync('app/dashboard.css');
const nextVersion=JSON.parse(readFileSync('node_modules/next/package.json','utf8')).version;
const result={
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  environment:`Node ${process.versions.node} / Next ${nextVersion} / clean optimized production build; all emitted chunks, not initial route transfer`,
  cssSourceBytes:source.length,cssSourceLines:source.toString().split('\n').length-1,
  productionJsBytes:sum(js,bytes=>bytes.length),productionJsGzipBytes:sum(js,bytes=>gzipSync(bytes).length),
  productionCssBytes:sum(css,bytes=>bytes.length),
  chunks:files.map(file=>({file,bytes:asset(file).length,sha256:createHash('sha256').update(asset(file)).digest('hex')})),
  initialHtmlScripts,initialHtmlJsBytes:sum(initial,bytes=>bytes.length),initialHtmlJsGzipBytes:sum(initial,bytes=>gzipSync(bytes).length),
};
writeFileSync('docs/ui-evidence/build-metrics.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,chunks:result.chunks.length,initialHtmlScripts:initialHtmlScripts.length}));
