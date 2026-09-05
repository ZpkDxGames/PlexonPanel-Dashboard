import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
// Accept the supervised preview flags while retaining Next.js and its Vercel build.
const args=process.argv.slice(2).filter(arg=>arg!=="--strictPort").map(arg=>arg==="--host"?"--hostname":arg);
const child=spawn(process.execPath,[fileURLToPath(new URL("../node_modules/next/dist/bin/next",import.meta.url)),"dev",...args],{stdio:"inherit"});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>process.exit(code??1));
child.on("error",error=>{console.error(error.message);process.exit(1);});
