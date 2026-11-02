import {describe,it,expect} from 'vitest';
import {priceSourceAppliesToModel} from '../src/agents/price-target-binding';
import type {PriceSourceSnapshot,PriceTarget} from '../src/agents/price-agent-types';
const target=(model:string)=>({model}) as PriceTarget;
const snapshot=(url:string)=>({finalUrl:url,body:'<p>Preço único R$ 165.990</p>'}) as PriceSourceSnapshot;
describe('official price model URLs',()=>{
 it('matches Ora 5 compact URL',()=>expect(priceSourceAppliesToModel(snapshot('https://www.gwmmotors.com.br/pt/modelos/ora5'),target('Ora 5'))).toBe(true));
 it('matches Tank model on tank-300 URL',()=>expect(priceSourceAppliesToModel(snapshot('https://www.gwmmotors.com.br/pt/modelos/tank-300'),target('Tank'))).toBe(true));
 it('does not misassign another model',()=>expect(priceSourceAppliesToModel(snapshot('https://www.gwmmotors.com.br/pt/modelos/ora5'),target('Ora 03'))).toBe(false));
});
