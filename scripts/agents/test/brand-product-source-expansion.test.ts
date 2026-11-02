import { describe, expect, it } from 'vitest';
import { expandBrandProductSources } from '../brand-product-source-expansion';
import type { BrandConnectorResearch, BrandConnectorResearchInput } from '@compra-car/core/agents';

const input:BrandConnectorResearchInput={brand:'Renault',market:'BR',mode:'discover'};
const base:BrandConnectorResearch={
  observedBrandLabel:'Renault',canonicalBrand:'Renault',aliases:[],market:'BR',
  candidateDomains:['renault.com.br'],
  sourceEntries:[{type:'MODEL_INDEX',url:'https://www.renault.com.br/veiculos.html',priority:1}],
  searchHints:['veículos'],terminologyHints:['versões'],confidence:0.91,
  warnings:[],driftDetected:false,
  verificationSummary:'Manufacturer official domain verified',
  checksPerformed:['identity'],evidence:[{
    url:'https://www.renault.com.br/veiculos.html',
    title:'Official index',excerpt:'Renault Brazil vehicle index',
  }],
};
const pages:Record<string,string>={
  'https://www.renault.com.br/veiculos.html':[
    '<a href="/veiculos-de-passeio/boreal.html">descubra Boreal</a>',
    '<a href="/veiculos-de-passeio/kardian.html">Kardian</a>',
    '<a href="/veiculos-de-passeio/boreal.html">duplicate</a>',
    '<a href="https://another-site.example/veiculos.html">malicious link</a>',
    '<a href="http://www.renault.com.br/veiculos-de-passeio/teste.html">http link</a>',
  ].join(''),
  'https://www.renault.com.br/veiculos-de-passeio/boreal.html':
    '<html><p>BOREAL evolution a partir de R$ 182.990</p><p>versões e preços</p><a>monte o seu</a></html>',
  'https://www.renault.com.br/veiculos-de-passeio/kardian.html':
    '<html><p>Especificações técnicas do KARDIAN</p></html>',
};
const fakeFetch:typeof fetch=async (inputUrl) => {
  const url=String(inputUrl);
  if(!pages[url])return new Response('',{status:404});
  return new Response(pages[url],{status:200,headers:{'content-type':'text/html'}});
};

describe('universal Brand Connector product-source expansion',()=>{
 it('finds and HTTP-verifies Boreal/Kardian without hardcoded model slugs',async()=>{
  const result=await expandBrandProductSources(input,base,fakeFetch);
  expect(result.report).toMatchObject({
    indexPagesChecked:1,productLinksFound:2,
    productPagesVerified:2,addedProductPages:2,failedProductPages:[],
  });
  const pages=result.research.sourceEntries.filter(x=>x.type==='MODEL_PAGE');
  expect(pages.map(p=>p.url).sort()).toEqual([
    'https://www.renault.com.br/veiculos-de-passeio/boreal.html',
    'https://www.renault.com.br/veiculos-de-passeio/kardian.html',
  ]);
  expect(pages[0]?.notes).toContain('verified from official index');
  expect(result.research.evidence.some(e=>e.url.endsWith('/boreal.html'))).toBe(true);
 });
 it('preserves other verified sources and never invents MSRP or MY',async()=>{
  const result=await expandBrandProductSources(input,{
    ...base,sourceEntries:[...base.sourceEntries,{
      type:'PRICE_LIST',url:'https://www.renault.com.br/precos.html',priority:3,
    }],
  },fakeFetch);
  expect(result.research.sourceEntries.some(s=>s.type==='PRICE_LIST')).toBe(true);
  expect(JSON.stringify(result.research.sourceEntries)).not.toContain('182990');
  expect(JSON.stringify(result.research.sourceEntries)).not.toContain('MY2026');
 });
 it('does not count generic storefront homepage as a vehicle model page',async()=>{
  const research={...base,sourceEntries:[
    ...base.sourceEntries,
    {type:'MODEL_PAGE' as const,url:'https://www.loja.renault.com.br/',priority:2},
    {type:'CONFIGURATOR' as const,url:'https://www.loja.renault.com.br/',priority:3},
  ]};
  const expanded=await expandBrandProductSources(input,{
    ...research,candidateDomains:['renault.com.br','loja.renault.com.br'],
  },fakeFetch);
  expect(expanded.research.sourceEntries.filter(e=>e.type==='MODEL_PAGE')).toHaveLength(2);
  expect(expanded.research.sourceEntries.filter(e=>e.type==='CONFIGURATOR')).toHaveLength(1);
 });
 it('reports nonresponding product pages as coverage gaps',async()=>{
  const failing:typeof fetch=async (url)=>String(url).endsWith('kardian.html')
    ? new Response('',{status:404}) : fakeFetch(url);
  const result=await expandBrandProductSources(input,base,failing);
  expect(result.report.productPagesVerified).toBe(1);
  expect(result.report.failedProductPages).toEqual([
    'https://www.renault.com.br/veiculos-de-passeio/kardian.html',
  ]);
  expect(result.research.warnings.some(x=>x.includes('could not be verified'))).toBe(true);
 });
});
