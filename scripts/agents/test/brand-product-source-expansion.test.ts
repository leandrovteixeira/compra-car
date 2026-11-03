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
 it('records transport and phase telemetry without treating generic price wording as an amount',async()=>{
   const result=await expandBrandProductSources(input,base,fakeFetch);
   expect(result.report).toMatchObject({
     httpRequests:3,httpFailedRequests:0,httpRedirects:0,
     productPagesVerified:2,productPagesWithBrlAmount:1,
     productPagesWithPriceTermsOnly:0,
   });
   expect(result.report.htmlBytesDownloaded).toBeGreaterThan(0);
   expect(result.report.elapsedMs).toBeGreaterThanOrEqual(0);
   expect(result.research.sourceCrawlTelemetry).toEqual(result.report);
   const observed=result.research.sourceEntries.filter(e=>e.type==='MODEL_PAGE');
   expect(observed.find(x=>x.url.includes('/boreal.html'))?.notes)
     .toContain('BRL_AMOUNT_VISIBLE');
   expect(observed.find(x=>x.url.includes('/kardian.html'))?.notes)
     .not.toContain('BRL_AMOUNT_VISIBLE');
 });
 it('does not count a price keyword without a vehicle amount',async()=>{
   const index='<a href="/veiculos-de-passeio/boreal.html">Boreal</a>';
   const fetcher:typeof fetch=async url=>new Response(
     String(url).endsWith('veiculos.html')?index:
       '<html><h1>Boreal</h1><p>Confira nossos preços e ofertas</p></html>',
     {status:200,headers:{'content-type':'text/html'}},
   );
   const expanded=await expandBrandProductSources(input,base,fetcher);
   expect(expanded.report.productPagesWithBrlAmount).toBe(0);
   expect(expanded.report.productPagesWithPriceTermsOnly).toBe(1);
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
 it('discovers electric and hybrid product-page categories',async()=>{
  const index='<a href="/electric-vehicles/megane-e-tech.html">Megane</a>'+
    '<a href="/veiculos-hibridos/koleos.html">Koleos</a>';
  const fetcher:typeof fetch=async url=>{
    const text=String(url).endsWith('veiculos.html')?index:'<h1>Model page</h1>';
    return new Response(text,{status:200,headers:{'content-type':'text/html'}});
  };
  const expanded=await expandBrandProductSources(input,base,fetcher);
  expect(expanded.report.productPagesVerified).toBe(2);
  expect(expanded.research.sourceEntries.map(e=>e.url)).toEqual(
    expect.arrayContaining([
      'https://www.renault.com.br/electric-vehicles/megane-e-tech.html',
      'https://www.renault.com.br/veiculos-hibridos/koleos.html',
    ]),
  );
 });
 it('recovers SPA product pages from official sitemap and embedded routes',async()=>{
  const origin='https://www.gwmmotors.com.br';
  const pages:Record<string,{body:string;contentType:string}>={
    [origin+'/pt/modelos']:{body:'<script>const routes=["\\/pt\\/modelos\\/haval-h7"];</script>',contentType:'text/html'},
    [origin+'/pt']:{body:'<main>GWM model index</main>',contentType:'text/html'},
    [origin+'/sitemap.xml']:{
      body:'<sitemapindex><sitemap><loc>'+origin+'/models-sitemap.xml</loc></sitemap></sitemapindex>',
      contentType:'application/xml',
    },
    [origin+'/models-sitemap.xml']:{
      body:'<urlset>'+
        '<url><loc>'+origin+'/pt/modelos/haval-h6-phev-19</loc></url>'+
        '<url><loc>'+origin+'/pt/modelos/haval-h6-hev-one</loc></url>'+
        '<url><loc>https://outside.example/pt/modelos/evil</loc></url>'+
        '</urlset>',
      contentType:'application/xml',
    },
  };
  const linked=[
    'haval-h7','haval-h6-phev-19','haval-h6-hev-one',
  ];
  for(const name of linked)pages[origin+'/pt/modelos/'+name]={
    body:'<h1>GWM '+name+'</h1><p>Preço único: R$ 250.000</p>',
    contentType:'text/html',
  };
  const fetcher:typeof fetch=async url=>{
    const found=pages[String(url)];
    return found
      ?new Response(found.body,{status:200,headers:{'content-type':found.contentType}})
      :new Response('',{status:404});
  };
  const research:BrandConnectorResearch={
    ...base,observedBrandLabel:'GWM',canonicalBrand:'GWM',
    candidateDomains:['gwmmotors.com.br'],
    sourceEntries:[{type:'MODEL_INDEX',url:origin+'/pt/modelos',priority:1}],
    evidence:[{url:origin+'/pt/modelos',title:'GWM index',excerpt:'Official car list'}],
  };
  const result=await expandBrandProductSources({
    brand:'GWM',market:'BR',mode:'discover',
  },research,fetcher);
  expect(result.report.productPagesVerified).toBe(3);
  expect(result.report.productLinksFound).toBe(3);
  expect(result.report.httpRequests).toBe(7);
  expect(result.research.sourceEntries.filter(x=>x.type==='MODEL_PAGE')
    .map(x=>x.url)).toEqual(expect.arrayContaining(
      linked.map(name=>origin+'/pt/modelos/'+name),
    ));
  expect(JSON.stringify(result.research)).not.toContain('outside.example');
 });
 it('discards sitemap media, order forms and redirects to generic homepage',async()=>{
   const root='https://www.gwmmotors.com.br';
   const pages:Record<string,string>={
     [root+'/pt/modelos']:'<a href="/pt/modelos/haval-h7">Haval H7</a>'+
       '<a href="/pt/modelos/pedido">Pedido</a>'+
       '<a href="/pt/media-center/modelos/haval-h7">Notícia</a>',
     [root+'/pt']:'<h1>Home</h1>',
     [root+'/pt/modelos/haval-h7']:'<h1>Haval H7</h1>',
     [root+'/sitemap.xml']:'<urlset></urlset>',
   };
   const fetcher:typeof fetch=async url=>{
     const text=String(url),body=pages[text];
     if(body===undefined)return new Response('',{status:404});
     if(text.endsWith('/pt/modelos/haval-h7'))return new Response('',{
       status:302,headers:{location:'/pt'},
     });
     return new Response(body,{status:200,headers:{
       'content-type':text.endsWith('.xml')?'application/xml':'text/html',
     }});
   };
   const result=await expandBrandProductSources({
     brand:'GWM',market:'BR',mode:'discover',
   },{...base,brand:'GWM',canonicalBrand:'GWM',
      observedBrandLabel:'GWM',candidateDomains:['gwmmotors.com.br'],
      sourceEntries:[{type:'MODEL_INDEX',url:root+'/pt/modelos',priority:1}],
      evidence:[{url:root+'/pt/modelos',title:'Official index',excerpt:'GWM'}],
   } as BrandConnectorResearch,fetcher);
   expect(result.report.productPagesVerified).toBe(0);
   expect(result.research.sourceEntries.filter(e=>e.type==='MODEL_PAGE')).toHaveLength(0);
   expect(result.report.failedProductPages).toContain(root+'/pt/modelos/haval-h7');
 });
 it('rechecks inherited GWM model URLs instead of counting them blindly',async()=>{
   const root='https://www.gwmmotors.com.br';
   const fetcher:typeof fetch=async url=>{
     const target=String(url);
     if(target.endsWith('/pt/modelos/haval-h7'))return new Response(
       '<h1>Haval H7</h1><p>R$ 259.000</p>',
       {status:200,headers:{'content-type':'text/html'}});
     if(target.endsWith('/pt/modelos'))return new Response('<h1>Index</h1>',{
       status:200,headers:{'content-type':'text/html'}});
     return new Response('',{status:404});
   };
   const research:BrandConnectorResearch={...base,
     observedBrandLabel:'GWM',canonicalBrand:'GWM',
     candidateDomains:['gwmmotors.com.br'],
     sourceEntries:[
       {type:'MODEL_INDEX',url:root+'/pt/modelos',priority:1},
       {type:'MODEL_PAGE',url:root+'/pt/modelos/haval-h7',priority:2},
     ],
     evidence:[{url:root+'/pt/modelos',title:'GWM',excerpt:'Official'}],
   };
   const result=await expandBrandProductSources({
     brand:'GWM',market:'BR',mode:'discover',
   },research,fetcher);
   expect(result.report.productPagesVerified).toBe(1);
   expect(result.report.productPagesWithBrlAmount).toBe(1);
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
