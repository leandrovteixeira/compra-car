'use client';

import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {reviewSpecValueAction} from '@/app/admin/agents/spec-value-decisions';
import type {ReviewStatus} from '@compra-car/core/agent-platform';

type Choice={id:number;code:string;label:string;type:string;unit:string|null};
type Evidence={scope?:string;sourceUrl?:string;evidenceExcerpt?:string;
 value?:string|null;unit?:string|null;availability?:string};
export function SpecValueReviewControls({findingId,fingerprint,revision,proposal,
 payload,status}:{
 findingId:string;fingerprint:string;revision:number;
 proposal:Record<string,unknown>|null;payload:Record<string,unknown>;
 status:ReviewStatus;
}){
 const router=useRouter();
 const [state,action,pending]=useActionState(reviewSpecValueAction,{
  status:'idle' as const,message:''
 });
 const [mode,setMode]=useState<'MERGE'|'CREATE'>('MERGE');
 const [choices,setChoices]=useState<Choice[]>([]);
 const [loaded,setLoaded]=useState(false);
 const kind=typeof proposal?.kind==='string'?proposal.kind:'';
 const available=typeof proposal?.availability==='string'?proposal.availability:'';
 const inputUnit=typeof proposal?.inputUnit==='string'?proposal.inputUnit:null;
 const rawValue=typeof proposal?.rawValue==='string'?proposal.rawValue:null;
 const evidence=Array.isArray(payload.sourceEvidence)?
  payload.sourceEvidence.filter((x):x is Evidence=>x!==null&&typeof x==='object'):[];
 useEffect(()=>{
  if(state.status==='success')router.refresh();
 },[state.status,router]);
 useEffect(()=>{
  let disposed=false;
  fetch('/admin/agents/spec-catalog-options',{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(new Error('CATALOG_UNAVAILABLE')))
   .then((data:{items?:Choice[]})=>{
    if(!disposed)setChoices(Array.isArray(data.items)?data.items:[]);
   }).catch(()=>{if(!disposed)setChoices([])})
   .finally(()=>{if(!disposed)setLoaded(true)});
  return ()=>{disposed=true};
 },[]);
 const options=choices.filter(c=>c.type===kind&&
  (kind!=='numeric'||!inputUnit||!c.unit||
   c.unit.toLowerCase()===inputUnit.toLowerCase()));
 return <div className="mt-3 space-y-3" onClick={e=>e.stopPropagation()}>
  <div className="rounded-md border border-[#D5DFE3] bg-[#F8FAFB] p-3 text-xs">
   <p className="font-semibold">Valor da evidência corroborada</p>
   <p className="mt-1">{rawValue??available}{inputUnit?' '+inputUnit:''} · {kind}</p>
   <p className="mt-1 text-[#526670]">A canonicalização e a gravação no veículo são uma operação única. Valores de fonte ambígua permanecem bloqueados.</p>
  </div>
  {evidence.length?<details className="rounded border p-2 text-xs">
   <summary className="cursor-pointer font-semibold">Conferir PDF e HTML ({evidence.length} fontes)</summary>
   {evidence.map((e,i)=><div key={i} className="mt-2 border-t pt-2">
    <p className="font-semibold">{e.scope==='XLS_MATRIX_CELL'?'Ficha PDF':'Página HTML MY2027'}</p>
    <p className="whitespace-pre-wrap break-words text-[#526670]">{e.evidenceExcerpt??'Sem transcrição.'}</p>
    {e.sourceUrl?.startsWith('https://www.ford.com.br/')?
      <a className="underline" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir fonte oficial</a>:null}
   </div>)}
  </details>:null}
  {status==='WAITING'||status==='POSTPONED'?<form action={action} className="space-y-3">
   <input type="hidden" name="findingId" value={findingId}/>
   <input type="hidden" name="fingerprint" value={fingerprint}/>
   <input type="hidden" name="caseRevision" value={revision}/>
   <div className="flex gap-2">
    <button type="button" onClick={()=>setMode('MERGE')} aria-pressed={mode==='MERGE'}
     className="ui-button ui-button--secondary ui-button--action">Merge existente</button>
    <button type="button" onClick={()=>setMode('CREATE')} aria-pressed={mode==='CREATE'}
     className="ui-button ui-button--secondary ui-button--action">CREATE novo spec</button>
   </div>
   {mode==='MERGE'?<label className="block text-xs font-semibold">
    Spec canônico de destino
    <select name="targetSpecId" required defaultValue="" className="mt-1 w-full rounded border border-[#CDD9DF] bg-white p-2">
     <option value="" disabled>{loaded?'Selecione um spec compatível':'Carregando catálogo...'}</option>
     {options.map(o=><option key={o.id} value={o.id}>
      {o.label} · {o.code}{o.unit?' ('+o.unit+')':''}
     </option>)}
    </select>
   </label>:<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {[
     ['code','Código único'],['detail','Nome técnico'],['display_pt','Nome PT'],
     ['detail_pt','Detalhe PT'],['group_name','Grupo'],['equipment_group','Subgrupo'],
     ['spec_set','Categoria / spec set'],['group_name_pt','Grupo PT'],
     ['equipment_group_pt','Subgrupo PT'],['spec_set_pt','Categoria PT'],
     ['unit','Unidade'],['display_order','Ordem'],
     ['relative_value','Preço relativo'],['unit_perceived_value','Valor unitário percebido']
    ].map(([name,label])=><label key={name} className="text-xs font-semibold">
     {label}
     <input name={name} type="text" required={['code','detail','group_name','equipment_group','spec_set'].includes(name)}
      defaultValue={name==='unit'?inputUnit??'':name==='relative_value'||name==='unit_perceived_value'?'0':''}
      className="mt-1 w-full rounded border border-[#CDD9DF] bg-white p-2"/>
    </label>)}
    <input type="hidden" name="type" value={kind}/>
   </div>}
   <div className="flex flex-wrap gap-2">
    <button type="submit" name="decision" value={mode} disabled={pending||mode==='MERGE'&&!options.length}
     className="ui-button ui-button--primary ui-button--action">
     {mode==='MERGE'?'Confirmar Merge + salvar valor':'CREATE + salvar valor'}
    </button>
    <button type="submit" name="decision" value="REJECT" formNoValidate disabled={pending}
     className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
    <button type="submit" name="decision" value="POSTPONE" formNoValidate disabled={pending}
     className="ui-button ui-button--secondary ui-button--action">Adiar</button>
   </div>
   {state.message?<p role={state.status==='error'?'alert':'status'} className="text-xs">{state.message}</p>:null}
  </form>:<p className="text-xs font-medium text-[#526670]">Decisão finalizada; alterações exigem novo ciclo de revisão.</p>}
 </div>;
}
