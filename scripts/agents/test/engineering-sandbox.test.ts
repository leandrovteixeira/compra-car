import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe,it,expect } from 'vitest';
import { applyEngineeringPatchInSandbox } from '../engineering-sandbox';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
describe('offline engineering sandbox executor',()=>{
 it('applies only declared hash-verified replacement in temporary workspace',async()=>{
  const root=await mkdtemp(join(tmpdir(),'eng-sandbox-'));
  const path='packages/core/src/agents/example.ts';
  try {
    await mkdir(join(root,'packages/core/src/agents'),{recursive:true});
    await writeFile(join(root,path),'before');
    const manifest={branch:'engineering/candidate-one',baseCommit:'a'.repeat(40),
     maxChangedFiles:1,files:[{path,beforeSha256:hash('before'),afterSha256:hash('after')}]};
    expect(await applyEngineeringPatchInSandbox(root,manifest,{[path]:'after'})).toEqual([path]);
    expect(await readFile(join(root,path),'utf8')).toBe('after');
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('never writes when any replacement fails verification',async()=>{
  const root=await mkdtemp(join(tmpdir(),'eng-sandbox-'));
  const path='scripts/agents/example.ts';
  try{
    await mkdir(join(root,'scripts/agents'),{recursive:true});
    await writeFile(join(root,path),'before');
    const manifest={branch:'engineering/candidate-one',baseCommit:'b'.repeat(40),maxChangedFiles:1,
      files:[{path,beforeSha256:hash('before'),afterSha256:hash('expected')}]};
    await expect(applyEngineeringPatchInSandbox(root,manifest,{[path]:'different'})).rejects.toThrow('ENGINEERING_PATCH_HASH_MISMATCH');
    expect(await readFile(join(root,path),'utf8')).toBe('before');
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
