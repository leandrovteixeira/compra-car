import type { PriceTarget } from './price-agent-types';
import type { RawCommercialPrice } from './raw-commercial-price';

const norm=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
  .toLowerCase().replace(/[^a-z0-9]+/gu,' ').trim();
const compact=(s:string)=>norm(s).replace(/ /gu,'');

export type RawPriceMatch =
 | { status:'MATCHED'; productId:string; price:RawCommercialPrice }
 | { status:'AMBIGUOUS'|'UNRESOLVED'; candidateIds:readonly string[]; price:RawCommercialPrice };

export function matchRawPrice(
 price:RawCommercialPrice,
 sourceUrl:string,
 targets:readonly PriceTarget[],
):RawPriceMatch {
 const context=norm(price.context);
 let path='';
 try {path=compact(decodeURIComponent(new URL(sourceUrl).pathname));}catch{return {status:'UNRESOLVED',candidateIds:[],price};}
 const candidates=targets.filter(t=>{
   const model=compact(t.model);
   return model.length>2 && (compact(context).includes(model)||path.includes(model));
 });
 // Never assign a model-wide value to one of several variants by guesswork.
 if(candidates.length!==1)return {status:candidates.length?'AMBIGUOUS':'UNRESOLVED',
   candidateIds:candidates.map(t=>t.productId),price};
 const target=candidates[0]!;
 if(price.modelYearHint!==null && target.modelYear!==price.modelYearHint)
   return {status:'UNRESOLVED',candidateIds:[],price};
 const version=norm(target.version);
 const aliases=[version,...(target.knownPriceAliases??[]).map(norm)].filter(Boolean);
 // Explicit version marker is necessary for versioned vehicles. A unique
 // model alone is insufficient when the source has no model-year evidence.
 if(!aliases.some(alias=>context.includes(alias)) || price.modelYearHint===null)
   return {status:'AMBIGUOUS',candidateIds:[target.productId],price};
 return {status:'MATCHED',productId:target.productId,price};
}
