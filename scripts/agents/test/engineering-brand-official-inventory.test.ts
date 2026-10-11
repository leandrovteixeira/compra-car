import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe,it,expect } from 'vitest';
import { safeConnectorUrl } from '@compra-car/core/agents';
interface Source { url:string; kind:string; modelLabelsObserved:string[] }
interface Brand {brand:string;market:string;urls:Source[]}
interface Inventory {schemaVersion:string;independentlyReviewed:boolean;brands:Brand[]}
const inventoryPath=resolve(import.meta.dirname,'../../../docs/agents/fixtures/brand-pilot-official-source-inventory.json');
async function fixture():Promise<Inventory>{
 return JSON.parse(await readFile(inventoryPath,'utf8')) as Inventory;
}
describe('22.5F preliminary official source inventory',()=>{
 it('records two explicitly unreviewed brand discoveries',async()=>{
  const x=await fixture();
  expect(x.schemaVersion).toBe('engineering-brand-source-inventory-v1');
  expect(x.independentlyReviewed).toBe(false);
  expect(x.brands.map(b=>b.brand).sort()).toEqual(['Kia','Volkswagen']);
 });
 it('uses safe source URLs with correct official host allowlists',async()=>{
  for(const b of (await fixture()).brands){
   const domains=b.brand==='Kia'?['kia.com.br']:['vw.com.br'];
   expect(b.market).toBe('BR');
   for(const source of b.urls){
    expect(safeConnectorUrl(source.url,domains)).not.toBeNull();
    expect(source.modelLabelsObserved.length).toBeGreaterThan(0);
   }
  }
 });
 it('retains Kia commercial and pickup discovery evidence',async()=>{
  const kia=(await fixture()).brands.find(b=>b.brand==='Kia')!;
  const models=kia.urls.flatMap(s=>s.modelLabelsObserved);
  expect(models).toContain('Bongo');
  expect(models).toContain('Tasman');
 });
});
