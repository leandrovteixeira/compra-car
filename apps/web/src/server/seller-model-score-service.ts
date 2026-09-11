import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';

const MONETARY_CATEGORIES = ['Acabamento','Audio & Conectividade','Conforto','Design','Dirigibilidade','Ownership','Performance','Seguranca','Tecnologia'] as const;
const SPACE_CODES = ['DM_0001','DM_0002','DM_0003','DM_0004','DM_0006','DM_0007'] as const;
export type SellerScoreRadius = 3 | 5 | 10;
export interface SellerModelOption { readonly id:number; readonly label:string; }
export interface SellerCategoryScore { readonly key:string; readonly label:string; readonly score:number|null; }
export interface SellerModelScoreResult { readonly options:readonly SellerModelOption[]; readonly selected:{readonly id:number;readonly label:string;readonly price:number}|null; readonly radius:SellerScoreRadius; readonly peerCount:number; readonly overallScore:number|null; readonly categories:readonly SellerCategoryScore[]; }
interface CurrentPriceRow { readonly product_id:number; readonly amount:number|string; }
interface ProductRow { readonly id:number;readonly brand:string;readonly model:string;readonly version:string;readonly model_year:number; }
interface ValueRow { readonly product_id:number;readonly category:string;readonly perceived_value:number|string|null; }
interface SpecRow { readonly id:number;readonly code:string; }
interface ProductSpecRow { readonly product_id:number;readonly equipment_id:number;readonly value:number|string|null;readonly is_present:boolean|null; }
function labelFor(p:ProductRow){return `${p.brand} ${p.model} ${p.version} — ${p.model_year}`;}
function displayCategory(c:string){return ({'Audio & Conectividade':'Áudio & Conectividade',Seguranca:'Segurança'} as Record<string,string>)[c]??c;}
function scoreRatio(value:number|null,max:number){if(value===null||!Number.isFinite(value)||max<=0)return null;return Math.max(0,Math.min(10,(value/max)*10));}

export async function loadSellerModelScore(productId:number|null,radius:SellerScoreRadius):Promise<SellerModelScoreResult>{
 const client=createLegacySupabaseClientFromEnv();
 const [{data:priceData,error:priceError},{data:productData,error:productError}]=await Promise.all([
  client.from('vw_current_product_public_prices').select('product_id,amount'),
  client.from('products').select('id,brand,model,version,model_year').eq('is_active',true).order('brand').order('model').order('version'),
 ]);
 if(priceError)throw priceError;if(productError)throw productError;
 const prices=(priceData??[]) as CurrentPriceRow[];const priceByProduct=new Map(prices.map(r=>[Number(r.product_id),Number(r.amount)]));
 const products=((productData??[]) as ProductRow[]).filter(p=>priceByProduct.has(Number(p.id)));
 const options=Object.freeze(products.map(p=>({id:p.id,label:labelFor(p)})));
 const selectedProduct=productId===null?null:products.find(p=>p.id===productId)??null;
 if(!selectedProduct)return {options,selected:null,radius,peerCount:0,overallScore:null,categories:Object.freeze([])};
 const selectedPrice=priceByProduct.get(selectedProduct.id)!;const minPrice=selectedPrice*(1-radius/100);const maxPrice=selectedPrice*(1+radius/100);
 const peerIds=products.filter(p=>{const price=priceByProduct.get(p.id)!;return price>=minPrice&&price<=maxPrice;}).map(p=>p.id);
 if(peerIds.length<2)return {options,selected:{id:selectedProduct.id,label:labelFor(selectedProduct),price:selectedPrice},radius,peerCount:peerIds.length,overallScore:null,categories:Object.freeze(MONETARY_CATEGORIES.map(c=>({key:c,label:displayCategory(c),score:null})).concat([{key:'Espaco + Carga',label:'Espaço + Carga',score:null}]))};
 const [{data:valueData,error:valueError},{data:specData,error:specError}]=await Promise.all([
  client.from('vw_product_value_by_category').select('product_id,category,perceived_value').in('product_id',peerIds).in('category',[...MONETARY_CATEGORIES]),
  client.from('specs').select('id,code').in('code',[...SPACE_CODES]),
 ]);if(valueError)throw valueError;if(specError)throw specError;
 const values=(valueData??[]) as ValueRow[];
 const monetaryScores:SellerCategoryScore[]=MONETARY_CATEGORIES.map(category=>{const peerValues=values.filter(r=>r.category===category).map(r=>Number(r.perceived_value??0));const best=Math.max(0,...peerValues);const row=values.find(r=>r.category===category&&Number(r.product_id)===selectedProduct.id);const selectedValue=row?Number(row.perceived_value??0):null;return {key:category,label:displayCategory(category),score:scoreRatio(selectedValue,best)};});
 const specs=(specData??[]) as SpecRow[];const specIds=specs.map(s=>s.id);let spaceScore:number|null=null;
 if(specIds.length){const {data,error}=await client.from('product_specs').select('product_id,equipment_id,value,is_present').in('product_id',peerIds).in('equipment_id',specIds);if(error)throw error;const rows=(data??[]) as ProductSpecRow[];const ratios:number[]=[];for(const spec of specs){const sr=rows.filter(r=>Number(r.equipment_id)===spec.id&&r.is_present!==false);const best=Math.max(0,...sr.map(r=>Number(r.value??0)));if(best<=0)continue;const selected=sr.find(r=>Number(r.product_id)===selectedProduct.id);if(!selected)continue;const value=Number(selected.value??0);if(Number.isFinite(value))ratios.push(Math.max(0,Math.min(1,value/best)));}if(ratios.length)spaceScore=ratios.reduce((a,b)=>a+b,0)/ratios.length*10;}
 const categories=Object.freeze([...monetaryScores,{key:'Espaco + Carga',label:'Espaço + Carga',score:spaceScore}]);const valid=categories.flatMap(c=>c.score===null?[]:[c.score]);const overallScore=valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;
 return {options,selected:{id:selectedProduct.id,label:labelFor(selectedProduct),price:selectedPrice},radius,peerCount:peerIds.length,overallScore,categories};
}
