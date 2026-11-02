import { describe, expect, it } from 'vitest';
import { officialGwmPricePageForTarget, isCompetingGwmProductPage } from '../gwm-price-sources';

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
