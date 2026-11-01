import {describe,expect,it} from 'vitest';
import {entryAppliesToTarget} from '../run-price';

describe('Price official URL routing',()=>{
  const page=(url:string)=>({type:'MODEL_PAGE',url});
  it('handles compact and hyphenated URL names',()=>{
    expect(entryAppliesToTarget(page('https://www.gwmmotors.com.br/pt/modelos/ora5'),'Ora 5')).toBe(true);
    expect(entryAppliesToTarget(page('https://www.gwmmotors.com.br/pt/modelos/tank-300'),'TANK 300')).toBe(true);
    expect(entryAppliesToTarget(page('https://www.gwmmotors.com.br/pt/modelos/haval-h6'),'Haval H6 GT')).toBe(true);
  });
  it('does not confuse unrelated models',()=>{
    expect(entryAppliesToTarget(page('https://www.gwmmotors.com.br/pt/modelos/haval-h7'),'Haval H6 GT')).toBe(false);
    expect(entryAppliesToTarget(page('https://www.gwmmotors.com.br/pt/modelos/ora5'),'Ora 03')).toBe(false);
  });
  it('allows official consolidated price lists to serve several models',()=>{
    expect(entryAppliesToTarget({type:'PRICE_LIST',url:'https://www.gwmmotors.com.br/pt/saiba-mais/condicoes-comerciais'},'Haval H6')).toBe(true);
  });
});
