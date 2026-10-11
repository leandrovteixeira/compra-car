import {describe,it,expect} from 'vitest';
import {validateEngineeringPatchManifest} from '../src/agents/engineering-patch-manifest';
const file={path:'packages/core/src/agents/example.ts',beforeSha256:'a'.repeat(64),afterSha256:'b'.repeat(64)};
const base={branch:'engineering/candidate-01',baseCommit:'a'.repeat(40),files:[file],maxChangedFiles:3};
describe('engineering patch sandbox admission',()=>{
 it('accepts a bounded proposed source change',()=>expect(validateEngineeringPatchManifest(base)).toEqual([]));
 it.each(['../../outside.ts','packages/core/.env','scripts/agents/../secret.ts','.github/workflows/a.yml','packages/core/src/../.env'])('rejects unsafe path %s',path=>{
  expect(validateEngineeringPatchManifest({...base,files:[{...file,path}]})).toContain('UNSAFE_PATH');
 });
 it('rejects duplicate paths and invalid hashes',()=>{
  expect(validateEngineeringPatchManifest({...base,files:[file,file]})).toContain('DUPLICATE_PATH');
  expect(validateEngineeringPatchManifest({...base,files:[{...file,afterSha256:'invalid'}]})).toContain('INVALID_FILE_HASH');
 });
 it('rejects unsafe branches and unlimited changes',()=>{
  expect(validateEngineeringPatchManifest({...base,branch:'main',maxChangedFiles:99})).toEqual(expect.arrayContaining(['UNSAFE_BRANCH','FILE_LIMIT']));
 });
});
