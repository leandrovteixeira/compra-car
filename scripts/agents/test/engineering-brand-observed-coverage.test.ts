import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { observeBrandCaptureLabels, saveBrandCaptureObservations } from '../engineering-brand-observed-coverage';
describe('brand source observed coverage, not canonical golden', () => {
  it('reports present and absent text without approving either', async () => {
    const root=await mkdtemp(join(tmpdir(),'observed-brands-'));
    try {
      await mkdir(join(root,'snapshots'));
      await writeFile(join(root,'snapshots','hash.html'),'<main>Sorento Bongo</main>');
      const capturePath=join(root,'capture.json'), inventoryPath=join(root,'inventory.json');
      await writeFile(capturePath,JSON.stringify({schemaVersion:'engineering-source-capture-v1',
        independentlyReviewed:false,captures:[{brand:'Kia',sourceUrl:'https://www.kia.com.br/',
        contentSha256:'hash'}]}));
      await writeFile(inventoryPath,JSON.stringify({brands:[{brand:'Kia',urls:[
        {url:'https://www.kia.com.br/',modelLabelsObserved:['Sorento','Tasman']}]}]}));
      const result=await observeBrandCaptureLabels(capturePath,inventoryPath);
      expect(result.independentlyReviewed).toBe(false);
      expect(result.observations.map(o=>o.found)).toEqual([true,false]);
      expect(result.missingLabels).toBe(1);
      await saveBrandCaptureObservations(capturePath,inventoryPath);
      expect(JSON.parse(await readFile(join(root,'observed-coverage.json'),'utf8')).missingLabels).toBe(1);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
});
