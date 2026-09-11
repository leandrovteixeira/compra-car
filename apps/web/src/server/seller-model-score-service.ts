import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';

const MONETARY_CATEGORIES = ['Acabamento','Audio & Conectividade','Conforto','Design','Dirigibilidade','Performance','Seguranca','Tecnologia'] as const;
const SPACE_CODES = ['DM_0001','DM_0002','DM_0003','DM_0004','DM_0006','DM_0007'] as const;
const OWNERSHIP_CODES = ['OW_0001','OW_0002','OW_0003','OW_0004','OW_0005','OW_0006','OW_0007','OW_0009','OW_0010','PW_0028'] as const;
const FUEL_KWH_PER_LITER = 8.9;
export type SellerScoreRadius = 3 | 5 | 10;
export interface SellerModelOption { readonly id:number; readonly label:string; }
export interface SellerCategoryScore { readonly key:string; readonly label:string; readonly score:number|null; }
export interface SellerModelScoreResult { readonly options:readonly SellerModelOption[]; readonly selected:{readonly id:number;readonly label:string;readonly price:number}|null; readonly radius:SellerScoreRadius; readonly peerCount:number; readonly overallScore:number|null; readonly categories:readonly SellerCategoryScore[]; }
interface CurrentPriceRow { readonly product_id:number; readonly amount:number|string; }
interface ProductRow { readonly id:number;readonly brand:string;readonly model:string;readonly version:string;readonly model_year:number; }
interface ValueRow { readonly product_id:number;readonly category:string;readonly perceived_value:number|string|null; }
interface SpecRow { readonly id:number;readonly code:string; }
interface ProductSpecRow { readonly product_id:number;readonly equipment_id:number;readonly value:number|string|null;readonly is_present:boolean|null; }
interface OwnershipMetrics { readonly energy:number|null;readonly range:number|null;readonly warranty:number|null;readonly fe:number|null;readonly consumption:number|null; }
function labelFor(p:ProductRow){return `${p.brand} ${p.model} ${p.version} — ${p.model_year}`;}
function displayCategory(c:string){return ({'Audio & Conectividade':'Áudio & Conectividade',Seguranca:'Segurança'} as Record<string,string>)[c]??c;}
function scoreRatio(value:number|null,max:number){if(value===null||!Number.isFinite(value)||max<=0)return null;return Math.max(0,Math.min(10,(value/max)*10));}
function inverseScoreRatio(value:number|null,min:number){if(value===null||!Number.isFinite(value)||value<=0||min<=0)return null;return Math.max(0,Math.min(10,(min/value)*10));}
function average(values:readonly number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function emptyCategories():readonly SellerCategoryScore[]{return Object.freeze<SellerCategoryScore[]>([
 ...MONETARY_CATEGORIES.slice(0,5).map(c=>({key:c,label:displayCategory(c),score:null})),
 {key:'Ownership',label:'Ownership',score:null},
 ...MONETARY_CATEGORIES.slice(5).map(c=>({key:c,label:displayCategory(c),score:null})),
 {key:'Espaco + Carga',label:'Espaço + Carga',score:null},
]);}

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
 if(peerIds.length<2)return {options,selected:{id:selectedProduct.id,label:labelFor(selectedProduct),price:selectedPrice},radius,peerCount:peerIds.length,overallScore:null,categories:emptyCategories()};
 const allSpecialCodes=[...SPACE_CODES,...OWNERSHIP_CODES];
 const [{data:valueData,error:valueError},{data:specData,error:specError}]=await Promise.all([
  client.from('vw_product_value_by_category').select('product_id,category,perceived_value').in('product_id',peerIds).in('category',[...MONETARY_CATEGORIES]),
  client.from('specs').select('id,code').in('code',allSpecialCodes),
 ]);if(valueError)throw valueError;if(specError)throw specError;
 const values=(valueData??[]) as ValueRow[];
 const monetaryScores:SellerCategoryScore[]=MONETARY_CATEGORIES.map(category=>{const peerValues=values.filter(r=>r.category===category).map(r=>Number(r.perceived_value??0));const best=Math.max(0,...peerValues);const row=values.find(r=>r.category===category&&Number(r.product_id)===selectedProduct.id);const selectedValue=row?Number(row.perceived_value??0):null;return {key:category,label:displayCategory(category),score:scoreRatio(selectedValue,best)};});
 const specs=(specData??[]) as SpecRow[];const specIds=specs.map(s=>s.id);const codeById=new Map(specs.map(s=>[s.id,s.code]));
 let rows:ProductSpecRow[]=[];
 if(specIds.length){const {data,error}=await client.from('product_specs').select('product_id,equipment_id,value,is_present').in('product_id',peerIds).in('equipment_id',specIds);if(error)throw error;rows=(data??[]) as ProductSpecRow[];}
 const valuesByProduct=new Map<number,Map<string,number>>();
 for(const row of rows){if(row.is_present===false)continue;const code=codeById.get(Number(row.equipment_id));if(!code||row.value===null)continue;const value=Number(row.value);if(!Number.isFinite(value))continue;const byCode=valuesByProduct.get(Number(row.product_id))??new Map<string,number>();byCode.set(code,value);valuesByProduct.set(Number(row.product_id),byCode);}
 let spaceScore:number|null=null;
 const spaceSpecs=specs.filter(s=>(SPACE_CODES as readonly string[]).includes(s.code));
 if(spaceSpecs.length){const ratios:number[]=[];for(const spec of spaceSpecs){const peerValues=peerIds.map(id=>valuesByProduct.get(id)?.get(spec.code)).filter((v):v is number=>v!==undefined&&Number.isFinite(v));const best=Math.max(0,...peerValues);if(best<=0)continue;const selected=valuesByProduct.get(selectedProduct.id)?.get(spec.code);if(selected===undefined)continue;ratios.push(Math.max(0,Math.min(1,selected/best)));}if(ratios.length)spaceScore=average(ratios)!*10;}
 const ownershipMetricsByProduct=new Map<number,OwnershipMetrics>();
 for(const id of peerIds){const m=valuesByProduct.get(id);const get=(code:string)=>m?.get(code);const battery=get('PW_0028')??0;const tank=get('OW_0006')??0;const gasConsumption=average([get('OW_0002'),get('OW_0003')].filter((v):v is number=>v!==undefined&&v>0));const ethanolConsumption=average([get('OW_0004'),get('OW_0005')].filter((v):v is number=>v!==undefined&&v>0));const consumption=gasConsumption??ethanolConsumption;const eRange=get('OW_0007')??0;const fuelRange=tank>0&&consumption!==null?tank*consumption:0;const totalWarranty=get('OW_0009');const electricWarranty=get('OW_0010');const electrified=battery>0;const warranty=totalWarranty===undefined?null:electrified&&electricWarranty!==undefined?average([totalWarranty,electricWarranty]):totalWarranty;ownershipMetricsByProduct.set(id,{energy:battery>0||tank>0?battery+tank*FUEL_KWH_PER_LITER:null,range:eRange>0||fuelRange>0?eRange+fuelRange:null,warranty,fe:get('OW_0001')??null,consumption});}
 const selectedOwnership=ownershipMetricsByProduct.get(selectedProduct.id)!;
 const ownershipRatios:number[]=[];
 for(const key of ['energy','range','warranty','consumption'] as const){const peerValues=peerIds.map(id=>ownershipMetricsByProduct.get(id)?.[key]).filter((v):v is number=>v!==null&&v!==undefined&&Number.isFinite(v)&&v>0);const best=Math.max(0,...peerValues);const s=scoreRatio(selectedOwnership[key],best);if(s!==null)ownershipRatios.push(s/10);}
 const peerFe=peerIds.map(id=>ownershipMetricsByProduct.get(id)?.fe).filter((v):v is number=>v!==null&&v!==undefined&&Number.isFinite(v)&&v>0);const minFe=peerFe.length?Math.min(...peerFe):0;const feScore=inverseScoreRatio(selectedOwnership.fe,minFe);if(feScore!==null)ownershipRatios.push(feScore/10);
 const ownershipScore=ownershipRatios.length?average(ownershipRatios)!*10:null;
 const ownershipCategory:SellerCategoryScore={key:'Ownership',label:'Ownership',score:ownershipScore};
 const categories=Object.freeze<SellerCategoryScore[]>([
  ...monetaryScores.slice(0,5),ownershipCategory,...monetaryScores.slice(5),{key:'Espaco + Carga',label:'Espaço + Carga',score:spaceScore},
 ]);const valid=categories.flatMap(c=>c.score===null?[]:[c.score]);const overallScore=valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;
 return {options,selected:{id:selectedProduct.id,label:labelFor(selectedProduct),price:selectedPrice},radius,peerCount:peerIds.length,overallScore,categories};
}
