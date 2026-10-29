'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReviewStatus, ReviewAction } from '@compra-car/core/agent-platform';
import type { ReviewInboxRow, ReviewSort, ReviewDirection } from '@/application/admin/agent-review-inbox';

type FindingDetail = {
  findingId: string;
  title: string;
  summary: string | null;
  sourceAgent: string;
  subject: Record<string, unknown>;
  proposal: Record<string, unknown> | null;
  reasonCode: string | null;
  evidenceAssessment: unknown;
  technicalPayload: Record<string, unknown>;
  evidence: readonly {
    title: string | null; excerpt: string | null; sourceType: string;
    url: string | null; capturedAt: string | null;
  }[];
  history: readonly { decision: string; note: string | null; at: string }[];
};

const statusLabels: Record<ReviewStatus,string> = {
  WAITING: 'Aguardando',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  POSTPONED: 'Adiado',
};
const actionLabels: Record<ReviewAction,string> = {
  APPROVE:'Aprovar',MERGE:'Canonicalizar',REJECT:'Rejeitar',POSTPONE:'Adiar',
};
const actionPolicy: Record<ReviewInboxRow['caseKind'],readonly ReviewAction[]> = {
  BRAND_NEW:['APPROVE','REJECT','POSTPONE'],
  BRAND_AMBIGUOUS:['APPROVE','MERGE','REJECT','POSTPONE'],
  CONNECTOR_NEW:['APPROVE','REJECT','POSTPONE'],
  CONNECTOR_UPDATE:['APPROVE','REJECT','POSTPONE'],
  MMV_NEW:['APPROVE','REJECT','POSTPONE'],
  MMV_AMBIGUOUS:['APPROVE','MERGE','REJECT','POSTPONE'],
  MMV_MATCHED:[],
  MODEL_YEAR_NEW:['APPROVE','REJECT','POSTPONE'],
  MODEL_YEAR_MATCHED:[],
  PRICE_NEW:['APPROVE','REJECT','POSTPONE'],
  PRICE_CHANGE:['APPROVE','REJECT','POSTPONE'],
  SPEC_NEW:['APPROVE','MERGE','REJECT','POSTPONE'],
  SPEC_AMBIGUOUS:['APPROVE','MERGE','REJECT','POSTPONE'],
  SPEC_MATCHED:[],
  WATCHER_SIGNAL:['APPROVE','REJECT','POSTPONE'],
};
const date = (raw:string|null) => raw && Number.isFinite(Date.parse(raw))
  ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw))
  : '—';
const percent = (v:number|null) =>
  v === null ? '—' : new Intl.NumberFormat('pt-BR',{
    style:'percent',maximumFractionDigits:0,
  }).format(v);
const labelClasses:Record<ReviewStatus,string> = {
  WAITING:'bg-[#FFF1E7] text-[#B85C1B]',
  APPROVED:'bg-[#E8F6EF] text-[#246946]',
  REJECTED:'bg-[#FDEDEE] text-[#A33737]',
  POSTPONED:'bg-[#F3F4F5] text-[#526670]',
};
function Status({status}:{readonly status:ReviewStatus}){
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${labelClasses[status]}`}>{statusLabels[status]}</span>;
}
function DetailContent({detail,row}:{readonly detail:FindingDetail;readonly row:ReviewInboxRow}){
  const subject = detail.subject ?? {};
  const get = (key:string) => {
    const val=subject[key];
    return typeof val==='string'||typeof val==='number'?String(val):null;
  };
  const observed = [
    get('brand'),get('model'),get('officialVersionLabel'),get('modelYear'),
  ].filter(Boolean).join(' ');
  const proposal=detail.proposal&&Array.isArray(detail.proposal.identities)
    ?detail.proposal.identities as Record<string,unknown>[]:[];
  const versionLabels=proposal.map(v=>String(v.officialVersionLabel??'').trim()).filter(Boolean);
  const data = detail.evidenceAssessment as Record<string,unknown>|null;
  const readiness = data && typeof data==='object' && typeof data.readiness==='string'
    ? data.readiness : null;
  return (
    <div className="rounded-b-lg border border-t-0 border-[#D6DEE3] bg-[#F6F7F8] p-3 sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
        <section className="rounded-md bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#526670]">Observado</h3>
          <p className="text-[13px] font-semibold">{observed || detail.title}</p>
          {versionLabels.length?<p className="mt-1 text-xs font-medium text-[#526670]">
            Versões propostas: {versionLabels.join(' · ')}
          </p>:null}
          {detail.summary?<details className="mt-2 text-xs leading-5 text-[#526670]">
            <summary className="cursor-pointer line-clamp-2">{detail.summary}</summary>
            <p className="mt-2 whitespace-pre-wrap">{detail.summary}</p>
          </details>:null}
          {detail.reasonCode ? <p className="mt-2 text-xs text-[#526670]">Motivo: <strong>{detail.reasonCode}</strong></p>:null}
        </section>
        <section className="rounded-md bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#526670]">Proposta e decisão</h3>
          <p className="text-[13px] font-semibold">{row.recommendation}</p>
          <p className="mt-1 text-xs text-[#526670]">Confiança {percent(row.confidence)}{readiness?` · Evidência: ${readiness}`:''}</p>
          <p className="mt-2 text-xs leading-5 text-[#526670]">
            {row.legacyAccepted
              ? 'Existe uma revisão ACCEPT legada. Ela não comprova alteração canônica.'
              : 'Os comandos definitivos só serão ativados após validar a transação de decisão e persistência.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(actionPolicy[row.caseKind]??[]).map(a=><span key={a} className="rounded border border-[#D6DEE3] bg-[#F6F7F8] px-2 py-1 text-[11px] text-[#526670]">{actionLabels[a]}</span>)}
          </div>
        </section>
        <section className="rounded-md bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#526670]">Evidências</h3>
          {!detail.evidence.length?<p className="text-xs text-[#526670]">Nenhuma evidência vinculada.</p>:
            <ul className="max-h-44 space-y-2 overflow-y-auto">
              {detail.evidence.slice(0,6).map((e,i)=>(
                <li key={i} className="border-b border-[#EAF1F4] pb-2 text-xs">
                  <span className="text-[#526670]">{e.sourceType} · {date(e.capturedAt)}</span>
                  <p className="mt-1 font-medium">{e.title||'Fonte sem título'}</p>
                  {e.excerpt?<p className="mt-1 line-clamp-2 text-[#526670]">{e.excerpt}</p>:null}
                  {e.url?<a className="mt-1 inline-block text-[#A9541B] underline underline-offset-2"
                    href={e.url} target="_blank" rel="noopener noreferrer">Abrir fonte</a>:null}
                </li>
              ))}
            </ul>}
        </section>
      </div>
      <details className="mt-3 rounded-md border border-[#D6DEE3] bg-white p-3 text-xs">
        <summary className="cursor-pointer font-medium">Histórico e dados técnicos (sob demanda)</summary>
        <p className="mt-3 font-semibold">Histórico</p>
        {!detail.history.length?<p className="mt-1 text-[#526670]">Sem decisões anteriores.</p>:
          <ul className="mt-2 space-y-1">{detail.history.map((item,i)=><li key={i}>{item.decision} · {date(item.at)} {item.note?`— ${item.note}`:''}</li>)}</ul>}
        <p className="mt-3 font-semibold">JSON técnico</p>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-[#F6F7F8] p-2 text-[11px]">{JSON.stringify({subject:detail.subject,proposal:detail.proposal,payload:detail.technicalPayload},null,2)}</pre>
      </details>
    </div>
  );
}

export function AgentReviewInbox({items,sort,direction}:{readonly items:readonly ReviewInboxRow[];readonly sort:ReviewSort;readonly direction:ReviewDirection}){
  const router=useRouter();
  const params=useSearchParams();
  const order=(field:ReviewSort)=>{
    const next=new URLSearchParams(params.toString());
    next.set('sort',field);
    next.set('direction',field===sort
      ?(direction==='asc'?'desc':'asc')
      :(field==='date'||field==='confidence'?'desc':'asc'));
    next.delete('page');
    router.replace('/admin/agents?'+next.toString(),{scroll:false});
  };
  const th=(field:ReviewSort,label:string,width:string)=>(
    <th scope="col" aria-sort={sort===field?(direction==='asc'?'ascending':'descending'):undefined}
      className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3 text-left"
      style={{width}}>
      <button type="button" onClick={()=>order(field)}
        className="flex w-full items-center gap-1 whitespace-nowrap text-left hover:text-[#EF7732]"
        aria-label={`Ordenar por ${label}`}>
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {sort===field?(direction==='asc'?'↑':'↓'):'↕'}
        </span>
      </button>
    </th>
  );
  const [expanded,setExpanded]=useState<string|null>(null);
  const [detail,setDetail]=useState<FindingDetail|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    if(!expanded){setDetail(null);setError(null);setLoading(false);return;}
    const controller=new AbortController();
    setLoading(true);setError(null);setDetail(null);
    fetch('/admin/agents/review-detail/'+encodeURIComponent(expanded),{
      signal:controller.signal,cache:'no-store',
    }).then(async r=>{if(!r.ok)throw new Error('DETAIL_UNAVAILABLE');return r.json() as Promise<FindingDetail>;})
      .then(data=>{if(!controller.signal.aborted)setDetail(data);})
      .catch(()=>{if(!controller.signal.aborted)setError('Não foi possível carregar o detalhe. Tente novamente.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[expanded]);
  const toggle=(id:string)=>setExpanded(prev=>prev===id?null:id);
  const body=(row:ReviewInboxRow)=>(
    loading?<div className="p-4 text-sm text-[#526670]" role="status">Carregando detalhes…</div>:
    error?<p role="alert" className="p-4 text-sm text-[#A33737]">{error}</p>:
    detail&&detail.findingId===row.findingId?<DetailContent detail={detail} row={row}/>:null
  );
  if(!items.length)return (
    <div className="rounded-lg border border-[#D6DEE3] bg-white px-4 py-12 text-center">
      <p className="font-semibold">Nenhuma descoberta neste filtro.</p>
      <p className="mt-1 text-sm text-[#526670]">Altere os filtros para visualizar outras revisões.</p>
    </div>
  );
  return (
    <>
      <div className="hidden rounded-lg border border-[#D6DEE3] lg:block">
        <table className="w-full table-fixed border-separate border-spacing-0 bg-white text-left text-[12px]">
          <thead className="text-[10px] font-semibold uppercase text-[#526670]">
            <tr>
              {th('brand','Marca','11%')}
              {th('model','Modelo','12%')}
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'20%'}}>DESCOBERTA</th>
              {th('agent','Agente','10%')}
              {th('date','Data','11%')}
              {th('confidence','Confiança','9%')}
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'9%'}}>STATUS</th>
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'12%'}}>RECOMENDAÇÃO</th>
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'6%'}}>AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {items.map(row=>(
              <Fragment key={row.findingId}>
                <tr className={`border-b border-[#EAF1F4] ${expanded===row.findingId?'bg-[#EDF4F6]':''}`}>
                  <td className="px-2.5 py-3 font-semibold" title={row.brand}>
                    <p className="truncate">{row.brand||'—'}</p>
                  </td>
                  <td className="px-2.5 py-3 font-medium" title={row.model}>
                    <p className="truncate">{row.model||'—'}</p>
                  </td>
                  <td className="px-2.5 py-3" title={row.title}>
                    <p className="line-clamp-2 font-medium">{row.title}</p>
                    {row.priorRuns>1?<p className="mt-1 text-[10px] text-[#61747B]">
                      {row.priorRuns} observações consolidadas
                    </p>:null}
                  </td>
                  <td className="px-2.5 py-3 text-[11px]">{row.agentLabel}</td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-[11px]">{date(row.observedAt)}</td>
                  <td className="px-2.5 py-3 font-semibold tabular-nums">{percent(row.confidence)}</td>
                  <td className="px-2.5 py-3"><Status status={row.status}/></td>
                  <td className="px-2.5 py-3">
                    <p className="line-clamp-2 text-[11px] font-medium">{row.recommendation}</p>
                    {row.evidencePreview?<p className="mt-1 truncate text-[10px] text-[#61747B]"
                      title={row.evidencePreview}>{row.evidencePreview}</p>:null}
                  </td>
                  <td className="px-2.5 py-3">
                    <button type="button" aria-expanded={expanded===row.findingId}
                      onClick={()=>toggle(row.findingId)}
                      className="rounded-md border border-[#D6DEE3] bg-white px-2.5 py-2 text-xs font-semibold hover:bg-[#EAF1F4] focus-visible:outline-2 focus-visible:outline-[#9ABCC8]">
                      {expanded===row.findingId?'Fechar':'Revisar'}
                    </button>
                  </td>
                </tr>
                {expanded===row.findingId?<tr><td colSpan={9} className="p-0">{body(row)}</td></tr>:null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <section className="lg:hidden" aria-label="Revisões para celular">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-md border border-[#D6DEE3] bg-[#DCE8ED] px-3 py-3 text-[11px] font-semibold uppercase text-[#526670]">
          <span>Descoberta</span><span>Status / ação</span>
        </div>
        <div className="divide-y divide-[#EAF1F4] border-x border-b border-[#D6DEE3] bg-white">
          {items.map(row=>(
            <article key={row.findingId} className="px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold">{[row.brand,row.model].filter(Boolean).join(' ')}</h3>
                  <p className="mt-1 text-xs">{row.title}</p>
                  <p className="mt-1 text-[11px] text-[#526670]">{row.agentLabel} · {date(row.observedAt)} · {percent(row.confidence)}</p>
                </div>
                <Status status={row.status}/>
              </div>
              <p className="mt-2 text-xs font-medium">{row.recommendation}</p>
              {row.evidencePreview?<p className="mt-1 line-clamp-2 text-[11px] text-[#526670]">{row.evidencePreview}</p>:null}
              <button type="button" aria-expanded={expanded===row.findingId}
                className="mt-2 rounded-md border border-[#D6DEE3] px-3 py-2 text-xs font-semibold"
                onClick={()=>toggle(row.findingId)}>
                {expanded===row.findingId?'Fechar detalhe':'Revisar descoberta'}
              </button>
              {expanded===row.findingId?<div className="mt-3">{body(row)}</div>:null}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
