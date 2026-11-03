import { CarbootBackLink } from '@/components/carboot-back-link';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { TechnicalSheetActions } from '@/components/admin/technical-sheet-actions';
import { TechnicalSpecCategoryTable } from '@/components/admin/technical-spec-category-table';
import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';
import { loadCurrentModelCards } from '@/server/public-model-catalog';

interface Props { readonly searchParams:Promise<{brand?:string;model?:string}> }
type Spec={id:number;type:string;group_name_pt:string|null;spec_set:string;detail:string;display_pt:string|null;detail_pt:string|null;display_order:number|null;display_unit_pt:string|null;unit:string|null;display_multiplier:number|null};
type Value={product_id:number;equipment_id:number;value:number|string|null;is_present:boolean|null};
const money=(value:number|null)=>value===null?'Preço não disponível':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);

export default async function CurrentModelSpecsPage({searchParams}:Props){
  const {brand,model}=await searchParams;
  const all=await loadCurrentModelCards();
  const selected=all.find(x=>x.brand===brand && x.model===model);
  if(!selected) return <section><CarbootBackLink href="/fichas-tecnicas"/><h1 className="mt-5 text-xl">Modelo não encontrado</h1></section>;
  const ids=selected.versions.map(x=>x.id);
  const client=createLegacySupabaseClientFromEnv();
  const [{data:specs,error:specError},{data:values,error:valuesError}]=await Promise.all([
    client.from('specs').select('id,type,group_name_pt,spec_set,detail,display_pt,detail_pt,display_order,display_unit_pt,unit,display_multiplier').eq('is_active',true).order('display_order').order('id'),
    client.from('product_specs').select('product_id,equipment_id,value,is_present').in('product_id',ids),
  ]);
  if(specError||valuesError) throw new Error('Não foi possível carregar as especificações atuais.');
  const valueMap=new Map(((values??[]) as Value[]).map(v=>[`${v.product_id}|${v.equipment_id}`,v]));
  const groups=new Map<string,Spec[]>();
  const categoryOrder = ['Dimensões', 'Custo de Posse', 'Motorização', 'Exterior', 'Interior', 'Conveniência', 'Segurança'] as const;
  const categoryRows=new Map<string,Spec[][]>(categoryOrder.map(category=>[category,[]]));
  for(const spec of (specs??[]) as Spec[]){
    const key=spec.type==='scale' ? `${spec.group_name_pt ?? ''}|${spec.spec_set}` : String(spec.id);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key)!.push(spec);
  }
  for(const group of groups.values()){
    const category=group[0]?.group_name_pt?.trim();
    if(!category || !categoryRows.has(category)) throw new Error(`Categoria não reconhecida na Ficha Técnica: ${category ?? '(vazia)'}`);
    categoryRows.get(category)!.push(group);
  }
  const label=(group:Spec[])=>group[0]?.display_pt||group[0]?.detail_pt||group[0]?.detail||'Especificação';
  function cell(group:Spec[],id:number){
    if(group[0]?.type==='scale'){
      const selectedOption=group.find(s=>valueMap.get(`${id}|${s.id}`)?.is_present===true);
      return selectedOption?.detail_pt||selectedOption?.detail||'—';
    }
    const spec=group[0];if(!spec)return '—';
    const v=valueMap.get(`${id}|${spec.id}`);
    if(!v)return '—';
    if(spec.type==='binary') return v.is_present===true?'spec_available':'spec_not_available';
    if(v.value===null)return '—';
    const numeric=Number(v.value)*(spec.display_multiplier??1);
    const value=Number.isFinite(numeric)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(numeric):String(v.value);
    return [value,spec.display_unit_pt||spec.unit||''].filter(Boolean).join(' ');
  }
  return <section className="min-w-0">
    <CatalogPageHeading title={`${selected.brand} ${selected.model}`} description="Versões atuais ordenadas por preço público, do menor para o maior." />
    <TechnicalSheetActions />
    <TechnicalSpecCategoryTable
      versions={selected.versions.map(v => ({ id: v.id, version: v.version, modelYear: v.model_year, price: money(v.price) }))}
      categories={categoryOrder.map(category => ({
        name: category,
        rows: categoryRows.get(category)!.map(group => ({
          id: group[0]!.id,
          label: label(group),
          values: selected.versions.map(version => cell(group, version.id)),
        })),
      }))}
    />
  </section>;
}
