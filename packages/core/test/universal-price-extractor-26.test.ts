import {describe,it,expect} from 'vitest';
import {extractUniversalPriceCandidates} from '../src/agents/universal-price-extractor';
describe('universal price candidate extraction',()=>{
 it('extracts JSON-LD Product Offer in BRL without canonical MMV',()=>{
  const html='<script type="application/ld+json">'+JSON.stringify({
   '@type':'Product',name:'Veículo EX',offers:{'@type':'Offer',priceCurrency:'BRL',price:'194990.00'}
  })+'</script>';
  expect(extractUniversalPriceCandidates(html)).toEqual([expect.objectContaining({
   amount:'194990.00',method:'JSON_LD',modelHint:'Veículo EX'})]);
 });
 it('rejects foreign currency structured offers',()=>{
  expect(extractUniversalPriceCandidates('<script type="application/ld+json">'+
   JSON.stringify({'@type':'Product',offers:{price:194990,priceCurrency:'USD'}})+'</script>')).toHaveLength(0);
 });
 it('retains Ora5 fragmented HTML extraction',()=>{
  expect(extractUniversalPriceCandidates('<p>P eço ú ico:*<b>R$ 165.990</b></p>'))
   .toEqual([expect.objectContaining({amount:'165990.00',method:'HTML_LABEL',kind:'SINGLE_PRICE'})]);
 });
 it('does not mistake bonuses or installments for MSRP',()=>{
  expect(extractUniversalPriceCandidates('Bônus R$ 20.000,00 ou 48 parcelas de R$ 990,00')).toHaveLength(0);
 });
});
