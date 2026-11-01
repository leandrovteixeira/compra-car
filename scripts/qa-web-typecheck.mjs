import {spawnSync} from 'node:child_process';
const r=spawnSync('pnpm',['--filter','@compra-car/web','exec','tsc','--noEmit','--pretty','false'],{encoding:'utf8',maxBuffer:10485760});
console.log('TSC_EXIT',r.status,'SIGNAL',r.signal);
console.log((r.stdout||'').slice(-24000));
console.log((r.stderr||'').slice(-6000));
process.exit(r.status===0?0:1);
