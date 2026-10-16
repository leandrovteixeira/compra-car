import Link from 'next/link';
import { requireRole } from '@/auth/authorization';
import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';
import { loadCurrentModelCards } from '@/server/public-model-catalog';

interface Props { readonly searchParams:Promise<{brand?:string;model?:string}> }
type Spec={id:number;type:string;spec_set:string;detail:string;display_pt:string|null;detail_pt:string|null;display_order:number|null;display_unit_pt:string|null;unit:string|null;display_multiplier:number|null};
type Value={product_id:number;equipment_id:number;value:number|string|null;is_present:boolean|null};
const money=(value:number|null)=>value===null?'Preço não disponível':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);

export default async function CurrentModelSpecsPage({searchParams}:Props){
  await requireRole('admin');
  const {brand,model}=await searchParams;
  const all=await loadCurrentModelCards();
  const selected=all.find(x=>x.brand===brand && x.model===model);
  if(!selected) return <section><Link href="/admin/ver-ficha-tecnica" className="text-sm text-[#526670]">← Voltar aos modelos</Link><h1 className="mt-5 text-xl">Modelo não encontrado</h1></section>;
  const ids=selected.versions.map(x=>x.id);
  const client=createLegacySupabaseClientFromEnv();
  const [{data:specs,error:specError},{data:values,error:valuesError}]=await Promise.all([
    client.from('specs').select('id,type,spec_set,detail,display_pt,detail_pt,display_order,display_unit_pt,unit,display_multiplier').eq('is_active',true).order('display_order').order('id'),
    client.from('product_specs').select('product_id,equipment_id,value,is_present').in('product_id',ids),
  ]);
  if(specError||valuesError) throw new Error('Não foi possível carregar as especificações atuais.');
  const valueMap=new Map(((values??[]) as Value[]).map(v=>[`${v.product_id}|${v.equipment_id}`,v]));
  const groups=new Map<string,Spec[]>();
  for(const spec of (specs??[]) as Spec[]){
    const key=spec.type==='scale' ? spec.spec_set : String(spec.id);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key)!.push(spec);
  }
  const rows=[...groups.values()];
  const label=(group:Spec[])=>group[0]?.display_pt||group[0]?.detail_pt||group[0]?.detail||'Especificação';
  function cell(group:Spec[],id:number){
    if(group[0]?.type==='scale'){
      const selectedOption=group.find(s=>valueMap.get(`${id}|${s.id}`)?.is_present===true);
      return selectedOption?.detail_pt||selectedOption?.detail||'—';
    }
    const spec=group[0];if(!spec)return '—';
    const v=valueMap.get(`${id}|${spec.id}`);
    if(!v)return '—';
    if(spec.type==='binary') return v.is_present===true?'Presente':v.is_present===false?'Ausente':'—';
    if(v.value===null)return '—';
    const numeric=Number(v.value)*(spec.display_multiplier??1);
    const value=Number.isFinite(numeric)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(numeric):String(v.value);
    return [value,spec.display_unit_pt||spec.unit||''].filter(Boolean).join(' ');
  }
  return <section className="min-w-0">
    <Link href="/admin/ver-ficha-tecnica" className="text-sm text-[#526670] hover:underline">← Voltar aos modelos</Link>
    <h1 className="mt-4 text-2xl font-semibold">{selected.brand} {selected.model}</h1>
    <p className="mt-1 text-sm text-[#61747B]">Versões atuais ordenadas por preço público, do menor para o maior.</p>
    <div className="mt-5 overflow-auto rounded-lg border border-[#D6DEE3] bg-white">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#DCE8ED] text-[#1A1D21]">
          <tr><th className="sticky left-0 w-64 bg-[#DCE8ED] px-4 py-4 text-left">Especificação</th>
            {selected.versions.map(version=><th key={version.id} className="min-w-44 px-3 py-4 text-center">
              <div className="font-semibold">{version.version}</div>
              <div className="mt-1 text-xs font-normal">{version.model_year}</div>
              <div className="mt-2 text-sm">{money(version.price)}</div>
            </th>)}
          </tr>
        </thead>
        <tbody>{rows.map((group,index)=><tr key={group[0]!.id} className={index%2?'bg-[#F8FAFB]':'bg-white'}>
          <th scope="row" className={`sticky left-0 border-b border-[#E5EBEE] px-4 py-3 text-left text-xs font-medium ${index%2?'bg-[#F8FAFB]':'bg-white'}`}>{label(group)}</th>
          {selected.versions.map(v=><td key={v.id} className="border-b border-[#E5EBEE] px-3 py-3 text-center text-xs">{cell(group,v.id)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
