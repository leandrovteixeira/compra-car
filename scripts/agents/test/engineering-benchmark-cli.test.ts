import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe,it,expect,vi } from 'vitest';
import { runEngineeringBenchmarkCli } from '../engineering-benchmark-cli';

const golden=[{id:'synthetic-kia',expectedIdentityKeys:['KIA|SORENTO|2026'],expectedRejectedKeys:[]}];
const correct=[{id:'synthetic-kia',resolvedIdentityKeys:['KIA|SORENTO|2026'],rejectedKeys:[],ambiguousKeys:[]}];
describe('offline Engineering benchmark replay',()=>{
 it('accepts matching benchmark and rejects identity regressions',async()=>{
   const root=await mkdtemp(join(tmpdir(),'engineering-bench-'));
   try{
     const file=join(root,'fixture.json');
     const emit=vi.fn();
     await writeFile(file,JSON.stringify({schemaVersion:'engineering-offline-v1',reviewed:true,golden,
       baseline:correct,candidate:correct}));
     expect(await runEngineeringBenchmarkCli(['--golden',file],emit)).toBe(0);
     await writeFile(file,JSON.stringify({schemaVersion:'engineering-offline-v1',reviewed:true,golden,
       baseline:correct,candidate:[{...correct[0],resolvedIdentityKeys:['KIA|SPORTAGE|2026']}]}));
     expect(await runEngineeringBenchmarkCli(['--golden',file],emit)).toBe(2);
   }finally{await rm(root,{recursive:true,force:true});}
 });
 it('refuses unreviewed fixture',async()=>{
   const root=await mkdtemp(join(tmpdir(),'engineering-bench-'));
   try{
     const file=join(root,'fixture.json');
     await writeFile(file,JSON.stringify({schemaVersion:'engineering-offline-v1',reviewed:false,
       golden,baseline:correct,candidate:correct}));
     await expect(runEngineeringBenchmarkCli(['--golden',file])).rejects.toThrow('ENGINEERING_UNREVIEWED_FIXTURE');
   }finally{await rm(root,{recursive:true,force:true});}
 });
});
