import { describe, expect, it } from 'vitest';
import { reconcileSourceFirstPrices } from '../src/agents/source-first-price-reconciliation';
import type { PriceSourceSnapshot, PriceTarget } from '../src/agents/price-agent-types';

const target=(id:string,model:string,version:string,modelYear=2027)=>({
  productId:id,brand:'GWM',model,version,modelYear,mmvIdentity:id,
  currentPrice:null,knownPriceAliases:[],
}) as PriceTarget;
const snapshot=(url:string,body:string):PriceSourceSnapshot=>({
  targetKey:'dummy',sourceUrl:url,finalUrl:url,
  sourceKind:'OFFICIAL_MODEL_PAGE',body,contentType:'text/html',
  contentHash:'hash',fetchedAt:'2026-11-02T00:00:00Z',
});
describe('source-first official price reconciliation',()=>{
 it('preserves Ora5 and Wey07 values as candidates when MY is absent',()=>{
   const sources=[
     snapshot('https://www.gwmmotors.com.br/pt/modelos/ora5','<p>P eço ú ico:*<b>R$ 165.990</b></p>'),
     snapshot('https://www.gwmmotors.com.br/pt/modelos/wey-07','<p>Preço único: R$ 429.000</p>'),
   ];
   const r=reconcileSourceFirstPrices(sources,[target('1173','Ora 5','BEV'),target('1213','Wey 07','PHEV AWD')]);
   expect(r.candidates.map(x=>x.amount)).toEqual(['165990.00','429000.00']);
   expect(r.candidates.every(x=>x.status==='AMBIGUOUS')).toBe(true);
   expect(r.observations).toHaveLength(0);
 });
 it('accepts explicit version and MY from official text, once per page',()=>{
   const source=snapshot('https://www.gwmmotors.com.br/pt/modelos/ora5',
     '<p>Ora 5 BEV ano modelo 2027 Preço único: R$ 165.990</p>');
   const r=reconcileSourceFirstPrices([source,source],[target('1173','Ora 5','BEV')]);
   expect(r.candidates).toHaveLength(1);
   expect(r.observations[0]).toMatchObject({msrpAmount:'165990.00',target:{productId:'1173'}});
 });
 it('never assigns promotional prices or generic structured Offer as MSRP',()=>{
   const source=snapshot('https://www.example.com/modelos/teste',
     '<p>Teste EX ano modelo 2027 Por R$ 159.990</p>'+
     '<script type="application/ld+json">'+JSON.stringify({
       '@type':'Product',name:'Teste EX ano modelo 2027',
       offers:{'@type':'Offer',price:169990,priceCurrency:'BRL'}
     })+'</script>');
   const r=reconcileSourceFirstPrices([source],[target('1','Teste','EX')]);
   expect(r.observations).toHaveLength(0);
   expect(r.candidates).toHaveLength(2);
 });
});
