import {describe,it,expect} from 'vitest';
import {matchRawPrice} from '../src/agents/raw-price-matching';
import type {PriceTarget} from '../src/agents/price-agent-types';
const target={productId:'1173',brand:'GWM',model:'Ora 5',version:'BEV',modelYear:2027,
  mmvIdentity:'ora5',currentPrice:null} as PriceTarget;
const price={amount:'165990.00',context:'ORA 5 BEV ano modelo 2027 Preço único: R$ 165.990,00',
 label:'SINGLE_PRICE',versionHint:null,modelYearHint:2027} as const;
describe('compact source-to-canonical matching',()=>{
 it('matches when both version and MY are explicit',()=>{
   expect(matchRawPrice(price,'https://www.gwmmotors.com.br/pt/modelos/ora5',[target]))
     .toMatchObject({status:'MATCHED',productId:'1173'});
 });
 it('defers unknown MY instead of guessing',()=>{
   expect(matchRawPrice({...price,modelYearHint:null},
     'https://www.gwmmotors.com.br/pt/modelos/ora5',[target]).status).toBe('AMBIGUOUS');
 });
 it('disambiguates Haval H6 PHEV19 when published MY and commercial trim are explicit',()=>{
   const h6=(id:string,version:string)=>({...target,productId:id,model:'Haval H6',version});
   const x={...price,context:'Haval H6 PHEV19 ano modelo 2027 Preço único: R$ 250.000'};
   expect(matchRawPrice(x,'https://www.gwmmotors.com.br/pt/modelos/haval-h6',
     [h6('1','19 1.5 TGDI PHEV DHT'),h6('2','35 1.5 TGDI PHEV DHT'),
      h6('3','2 1.5 TGDI HEV DHT')]))
     .toMatchObject({status:'MATCHED',productId:'1'});
 });
 it('does not invent an exact trim from a multi-version model page',()=>{
   const other={...target,productId:'888',version:'Premium'};
   expect(matchRawPrice({...price,context:'ORA 5 ano modelo 2027 Preço único: R$ 165.990'},
     'https://www.gwmmotors.com.br/pt/modelos/ora5',
     [target,other]).status).toBe('AMBIGUOUS');
 });
});
