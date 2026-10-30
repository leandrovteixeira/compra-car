'use client';
import {useActionState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {reviewFipeCandidateAction} from '@/app/admin/agents/fipe-decisions';
import type {FipeReviewItem} from '@/application/admin/fipe-review-inbox';
function FipeDecision({item}:{item:FipeReviewItem}){
 const router=useRouter();
 const [state,action,pending]=useActionState(reviewFipeCandidateAction,{status:'idle' as const,message:''});
 useEffect(()=>{if(state.status==='success')router.refresh();},[router,state.status]);
 return <form action={action} className="flex flex-wrap items-center gap-2">
  <input type="hidden" name="candidateId" value={item.id}/>
  <button type="submit" name="decision" value="ACCEPT" disabled={pending||item.dependencyState!=='READY'}
   className="ui-button ui-button--primary ui-button--action">Aprovar</button>
  <button type="submit" name="decision" value="REJECT" disabled={pending}
   className="ui-button ui-button--secondary ui-button--action">Rejeitar</button>
  <button type="submit" name="decision" value="DEFER" disabled={pending}
   className="ui-button ui-button--secondary ui-button--action">Adiar</button>
  {state.message?<p role={state.status==='error'?'alert':'status'}
    className="w-full text-xs text-[#526670]">{state.message}</p>:null}
 </form>;
}
export function FipeReviewQueue({items}:{items:readonly FipeReviewItem[]}){
 if(!items.length)return null;
 return <section className="ui-surface overflow-hidden rounded-lg border border-[#D6DEE3]" aria-label="Revisões FIPE">
  <div className="bg-[#DCE8ED] px-4 py-3">
   <h2 className="text-sm font-semibold text-[#1A1D21]">FIPE · Correspondências pendentes ({items.length})</h2>
   <p className="mt-1 text-xs text-[#526670]">Aprovar confirma o código FIPE e libera dependências. Nenhum segundo clique é necessário.</p>
  </div>
  <div className="divide-y divide-[#EAF1F4]">
   {items.map(item=><article className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center" key={item.id}>
    <div className="min-w-0">
     <p className="text-sm font-semibold">{item.brand} {item.model}{item.version?' '+item.version:''}</p>
     <p className="mt-1 text-xs text-[#526670]">Código FIPE <strong>{item.fipeCode}</strong> · {item.fipeLabel}</p>
     <p className="mt-1 text-xs text-[#526670]">Confiança {Math.round(item.confidence*100)}% · {item.dependencyState==='READY'?'Pronto para decisão':'Dependência pendente'} · <a className="underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte</a></p>
    </div>
    <FipeDecision item={item}/>
   </article>)}
  </div>
 </section>;
}
