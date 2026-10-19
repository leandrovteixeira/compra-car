'use client';
import { useMemo, useState } from 'react';
import { MANUAL_POLICY_DISPLAY_LABELS } from '@compra-car/core';
type Policy={id:string;productId:string;policyType:string;title:string;startsOn:string;endsOn:string|null;status:string;customerBenefitAmount:string|null};
type Offer={id:string;productId:string;validFrom:string;validTo:string|null;status:string;policyIds:readonly string[];benefitAmount:string|null;transactionalPrice:string|null};
type Product={id:string;displayName:string};
const date=(v:string|null)=>v? v.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$3/$2/$1'):'—';
const amount=(v:string|null)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v??0));
export function ReadOnlyCommercialPolicies({products,policies,offers}:{products:readonly Product[];policies:readonly Policy[];offers:readonly Offer[]}) {
 const [query,setQuery]=useState('');
 const [competence,setCompetence]=useState('');
 const [type,setType]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 const productMap=useMemo(()=>new Map(products.map(p=>[p.id,p.displayName.replace(/\b(\d{4})\/(\d{4})\b/g,'$2')])),[products]);
 const months=useMemo(()=>[...new Set(policies.flatMap(p=>{
  const a=p.startsOn.slice(0,7),end=p.endsOn?.slice(0,7);
  return end&&end!==a?[a,end]:[a];
 }))].sort().reverse(),[policies]);
 const chosenMonth=competence||months[0]||'';
 const types=useMemo(()=>[...new Set(policies.map(p=>p.policyType))].sort(),[policies]);
 const rows=useMemo(()=>policies.filter(p=>{
  if(p.status!=='published')return false;
  const mmvy=productMap.get(p.productId)||'';
  const term=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const begin=chosenMonth?chosenMonth+'-01':'';
  const end=chosenMonth?chosenMonth+'-31':'';
  return (!term||mmvy.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term))
   &&(!type||type===p.policyType)&&(!chosenMonth||(p.startsOn<=end&&(!p.endsOn||p.endsOn>=begin)));
 }).sort((a,b)=>(productMap.get(a.productId)||'').localeCompare(productMap.get(b.productId)||'','pt-BR',{numeric:true})),[policies,query,chosenMonth,type,productMap]);
 const related=(p:Policy)=>offers.filter(o=>o.productId===p.productId&&o.policyIds.includes(p.id)&&o.status!=='archived');
 return <section className="flex min-h-0 flex-1 flex-col gap-3">
  <div className="flex min-w-0 flex-wrap items-end gap-2 py-3">
   <label className="relative min-w-[260px] flex-1"><img src="/carboot/search.svg" alt="" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4"/><input autoComplete="off" className="ui-field !h-10 w-full !pl-10" aria-label="Buscar veículo" placeholder="Buscar marca, modelo ou versão..." value={query} onChange={e=>setQuery(e.target.value)} /></label>
   <label className="text-xs font-semibold text-[#61747B]">Competência<select className="ui-field mt-1 !h-10 w-40" value={chosenMonth} onChange={e=>setCompetence(e.target.value)}>{months.map(m=><option key={m} value={m}>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T12:00:00Z'))}</option>)}</select></label>
   <label className="text-xs font-semibold text-[#61747B]">Política<select className="ui-field mt-1 !h-10 w-44" value={type} onChange={e=>setType(e.target.value)}><option value="">Todas</option>{types.map(t=><option key={t} value={t}>{(MANUAL_POLICY_DISPLAY_LABELS as Record<string,string>)[t]||t}</option>)}</select></label>
   <button aria-label="Limpar filtros" type="button" className="grid size-10 shrink-0 place-items-center" onClick={()=>{setQuery('');setCompetence('');setType('')}}><img src="/carboot/close.svg" alt="" className="size-4"/></button>
  </div>
  <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#D6DEE3] bg-white">
   <table className="w-full min-w-[900px] text-[13px]">
    <thead className="sticky top-0 z-10 bg-[#DCE8ED] text-[#61747B]"><tr>{['VEÍCULO','COMPETÊNCIA','POLÍTICA','VALOR','STATUS',''].map((h,i)=><th className={`p-3 ${i===0?'text-left':'text-center'}`} key={i}>{h}</th>)}</tr></thead>
    <tbody>{rows.length===0&&<tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[#61747B]">{policies.some(p=>p.status==='draft') ? 'Não há políticas publicadas para esta consulta. Existem políticas em rascunho, que não aparecem como vigentes.' : 'Nenhuma política vigente encontrada para os filtros selecionados.'}</td></tr>}{rows.map(p=>{const linked=related(p),opened=expanded===p.id;return <tr key={p.id} className="border-t border-[#D6DEE3]"><td colSpan={6} className="p-0"><div className={`grid grid-cols-[2.3fr_1fr_1.6fr_1fr_1fr_68px] items-center gap-2 px-3 py-3 hover:bg-[#EAF1F4] ${opened?'bg-[#F6F7F8]':''}`}><span className="font-semibold">{productMap.get(p.productId)||p.productId}</span><span className="text-center">{chosenMonth?chosenMonth.slice(5)+'/'+chosenMonth.slice(0,4):date(p.startsOn)}</span><span className="text-center">{(MANUAL_POLICY_DISPLAY_LABELS as Record<string,string>)[p.policyType]||p.title}</span><span className="text-center font-semibold">{amount(p.customerBenefitAmount)}</span><span className="text-center"><span className="inline-flex h-6 items-center rounded-full border border-[#AFE3C3] bg-[#F1FAF5] px-3 text-[#16854A]">Vigente</span></span><span className="text-center">{linked.length>0?<button type="button" aria-expanded={opened} aria-label={`Mostrar ${linked.length} ofertas relacionadas`} className="inline-flex items-center gap-1 text-[#EF7732]" onClick={()=>setExpanded(opened?null:p.id)}><img src="/carboot/layers.svg" alt="" className="size-5"/><span className="text-xs font-semibold">{linked.length}</span></button>:<span className="text-[#9CA8AE]">—</span>}</span></div>{opened&&<div className="border-t border-[#D6DEE3] bg-[#F6F7F8] px-6 py-3"><p className="mb-2 text-xs font-semibold text-[#526670]">Ofertas relacionadas</p>{linked.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D6DEE3] py-2 text-xs"><span>Oferta #{o.id} · {date(o.validFrom)} – {date(o.validTo)}</span><span>{o.status==='published'?'Publicada':'Rascunho'}</span><span>Benefícios: {amount(o.benefitAmount)}</span></div>)}</div>}</td></tr>})}</tbody>
   </table>
  </div><p className="text-xs text-[#61747B]">{rows.length} políticas vigentes</p>
 </section>;
}
