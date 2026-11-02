import { describe, expect, it } from 'vitest';
import { officialGwmPricePageForTarget, isCompetingGwmProductPage, officialGwmProductPriceCoverage, resolveGwmPageCandidates } from '../gwm-price-sources';

const target=(model:string,version:string)=>({brand:'GWM',model,version});
describe('GWM official per-trim price source profile',()=>{
 const routes=[
  ['Haval H6','One 1.5 TGDI HEV DHT','haval-h6-hev-one'],
  ['Haval H6','2 1.5 TGDI HEV DHT','haval-h6-hev'],
  ['Haval H6','19 1.5 TGDI PHEV DHT','haval-h6-phev-19'],
  ['Haval H6','35 1.5 TGDI PHEV DHT','haval-h6-phev-35'],
  ['Haval H6','GT 1.5 TGDI PHEV DHT','haval-h6-gt'],
  ['Haval H9','Exclusive 2.4 TD AT','haval-h9'],
  ['Ora 03','EV58','ora-03-bev58'],
  ['Ora 5','BEV','ora5'],
  ['Tank','300HT','tank-300'],
  ['Wey 07','PHEV AWD','wey-07'],
 ] as const;
 it.each(routes)('routes %s %s to its official product URL', (model,version,slug)=>{
  expect(officialGwmPricePageForTarget(target(model,version)))
   .toBe('https://www.gwmmotors.com.br/pt/modelos/'+slug);
 });
 it('does not fetch PHEV35 page for PHEV19',()=>{
  expect(isCompetingGwmProductPage(target('Haval H6','19 1.5 TGDI PHEV DHT'),
   'https://www.gwmmotors.com.br/pt/modelos/haval-h6-phev-35')).toBe(true);
  expect(isCompetingGwmProductPage(target('Haval H6','19 1.5 TGDI PHEV DHT'),
   'https://www.gwmmotors.com.br/pt/modelos/haval-h6-phev-19')).toBe(false);
 });
 it('never targets a GWM page for Kia',()=>{
  expect(officialGwmPricePageForTarget({brand:'Kia',model:'Niro',version:'EX'})).toBeNull();
 });
});

describe('GWM price-source coverage gate',()=>{
 const targets=[
  {productId:'1168',brand:'GWM',model:'Haval H6',version:'One 1.5 TGDI HEV DHT'},
  {productId:'1166',brand:'GWM',model:'Haval H6',version:'19 1.5 TGDI PHEV DHT'},
  {productId:'1173',brand:'GWM',model:'Ora 5',version:'BEV'},
 ] as import('@compra-car/core/agents').PriceTarget[];
 const amounts=['199900.00','250000.00','165990.00'];
 const candidates=targets.map((target,i)=>({
  sourceUrl:officialGwmPricePageForTarget(target)!,amount:amounts[i]!,
  kind:'SINGLE_PRICE' as const,status:'AMBIGUOUS' as const,
  candidateProductIds:targets.map(t=>t.productId),
 }));
 it('counts only dedicated official product pages',()=>{
  expect(officialGwmProductPriceCoverage(targets,candidates)).toMatchObject({
   expected:3,priced:3,missing:[],
  });
 });
 it('reports the exact source that lost its price',()=>{
  const result=officialGwmProductPriceCoverage(targets,candidates.slice(1));
  expect(result).toMatchObject({expected:3,priced:2});
  expect(result.missing).toEqual([{
    productId:'1168',
    url:'https://www.gwmmotors.com.br/pt/modelos/haval-h6-hev-one',
  }]);
 });
 it('rejects promotional-only pages for coverage',()=>{
  const result=officialGwmProductPriceCoverage(targets,[
    {...candidates[0]!,kind:'PROMOTIONAL_PRICE'},
    ...candidates.slice(1),
  ]);
  expect(result.priced).toBe(2);
 });
 it('narrows H6 candidates by product page without guessing MY',()=>{
  const narrowed=resolveGwmPageCandidates(targets,candidates);
  expect(narrowed.map(c=>c.candidateProductIds)).toEqual([
    ['1168'],['1166'],['1173'],
  ]);
  expect(narrowed.every(c=>c.status==='AMBIGUOUS')).toBe(true);
 });
});
