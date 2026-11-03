import { extractRawCommercialPrices, type RawCommercialPrice } from './raw-commercial-price';

/** Source-agnostic discovery only: never assigns a canonical MMVY. */
export type PriceCandidate = Readonly<{
  amount: string; currency: 'BRL'; kind: 'MSRP'|'SINGLE_PRICE'|'PROMOTIONAL_PRICE';
  method: 'JSON_LD'|'HTML_LABEL'; context: string;
  modelHint: string|null; versionHint: string|null; modelYearHint: number|null;
}>;
const amount=(v:unknown):string|null=>{
  if(typeof v!=='string' && typeof v!=='number')return null;
  const text=String(v).trim();
  const n=Number(text.includes(',')?text.replace(/\./gu,'').replace(',','.'):text);
  return Number.isFinite(n)&&n>=20000&&n<=5000000?n.toFixed(2):null;
};
const objects=(value:unknown):Readonly<Record<string,unknown>>[]=>{
  if(Array.isArray(value))return value.flatMap(objects);
  if(!value||typeof value!=='object')return [];
  const o=value as Record<string,unknown>;
  return [o,...objects(o['@graph'])];
};
export function extractUniversalPriceCandidates(html:string):readonly PriceCandidate[]{
  const candidates:PriceCandidate[]=[];
  const scripts=html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu);
  for(const script of scripts){
    let parsed:unknown;
    try{parsed=JSON.parse(script[1]??'');}catch{continue;}
    for(const object of objects(parsed)){
      const type=object['@type'];
      const types=Array.isArray(type)?type:[type];
      if(!types.some(t=>t==='Product'||t==='Vehicle'||t==='Car'))continue;
      const name=typeof object.name==='string'?object.name:null;
      for(const offer of objects(object.offers)){
        const currency=offer.priceCurrency;
        const price=amount(offer.price);
        if(currency!=='BRL'||!price)continue;
        candidates.push({amount:price,currency:'BRL',kind:'MSRP',method:'JSON_LD',
          context:'Structured offer for '+(name??'unknown product'),modelHint:name,
          versionHint:null,modelYearHint:null});
      }
    }
  }
  const legacy:readonly RawCommercialPrice[]=extractRawCommercialPrices(html);
  for(const price of legacy)candidates.push({
    amount:price.amount,currency:'BRL',kind:price.label,method:'HTML_LABEL',
    context:price.context,modelHint:null,versionHint:price.versionHint,
    modelYearHint:price.modelYearHint,
  });
  return [...new Map(candidates.map(x=>[[x.method,x.amount,x.context].join('|'),x])).values()];
}
