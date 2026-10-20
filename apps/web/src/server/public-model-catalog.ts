import 'server-only';

import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';

type ModelRow = { id:number; brand:string; model:string; version:string; model_year:number };
type PriceRow = { product_id:number; amount:number|string };
export type CurrentModelVersion = ModelRow & { price:number|null };
export type CurrentModelCard = { brand:string; model:string; versions:readonly CurrentModelVersion[] };

export async function loadCurrentModelCards(): Promise<readonly CurrentModelCard[]> {
  const client = createLegacySupabaseClientFromEnv();
  const [{data:products,error:productsError},{data:prices,error:priceError}]=await Promise.all([
    client.from('products').select('id,brand,model,version,model_year').eq('is_active',true).eq('is_public',true),
    client.from('vw_current_product_public_prices').select('product_id,amount'),
  ]);
  if(productsError || priceError) throw new Error('Não foi possível consultar o catálogo público.');
  const priceById=new Map(((prices??[]) as PriceRow[]).map(row=>[row.product_id,Number(row.amount)]));
  const latest=new Map<string,ModelRow>();
  for(const p of (products??[]) as ModelRow[]) {
    const key=[p.brand.toLocaleLowerCase('pt-BR'),p.model.toLocaleLowerCase('pt-BR'),p.version.toLocaleLowerCase('pt-BR')].join('|');
    if(!latest.has(key) || latest.get(key)!.model_year<p.model_year) latest.set(key,p);
  }
  const models=new Map<string,{brand:string;model:string;versions:CurrentModelVersion[]}>();
  for(const row of latest.values()){
    const key=[row.brand.toLocaleLowerCase('pt-BR'),row.model.toLocaleLowerCase('pt-BR')].join('|');
    if(!models.has(key)) models.set(key,{brand:row.brand,model:row.model,versions:[]});
    models.get(key)!.versions.push({...row,price:priceById.get(row.id)??null});
  }
  return [...models.values()].map(m=>({...m,versions:m.versions.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity)||a.version.localeCompare(b.version,'pt-BR'))}))
    .sort((a,b)=>a.brand.localeCompare(b.brand,'pt-BR')||a.model.localeCompare(b.model,'pt-BR'));
}
