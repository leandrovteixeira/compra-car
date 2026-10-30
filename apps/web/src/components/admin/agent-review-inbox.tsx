'use client';

import { Fragment, useActionState, useEffect, useState } from 'react';
import { reviewMmvIdentityAction } from '@/app/admin/agents/identity-actions';
import { reviewConnectorAction } from '@/app/admin/agents/connector-decisions';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReviewStatus } from '@compra-car/core/agent-platform';
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
  const router = useRouter();
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewMmvIdentityAction, {status:'idle' as const,message:''});
  const [connectorState, connectorAction, connectorPending]=useActionState(reviewConnectorAction,{status:'idle' as const,message:''});
  useEffect(()=>{if(reviewState.status==='success'||connectorState.status==='success')router.refresh();},[reviewState.status,connectorState.status,router]);
  const subject = detail.subject ?? {};
  const get = (key:string) => {
    const val=subject[key];
    return typeof val==='string'||typeof val==='number'?String(val):null;
  };
  const observed = [
    get('brand')||row.brand,get('model')||row.model,row.version||get('officialVersionLabel'),get('modelYear'),
  ].filter(Boolean).join(' ');
  const proposal=detail.proposal&&Array.isArray(detail.proposal.identities)
    ?detail.proposal.identities as Record<string,unknown>[]:[];
  const selected=row.selectedIdentity;
  const technical=selected
    ?[
      ['Motorização',selected.powertrainLabel],
      ['Propulsão',selected.propulsion],
      ['Carroceria',selected.bodyStyle],
    ].filter(([,v])=>v!==null&&v!==undefined&&String(v).trim())
    :[];
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
          {row.version?<p className="mt-1 text-xs font-medium text-[#526670]">
            Versão selecionada: {row.version}
          </p>:null}
          {technical.length?<p className="mt-1 text-xs text-[#526670]">
            {technical.map(([k,v])=>k+': '+String(v)).join(' · ')}
          </p>:null}
          {!selected && versionLabels.length?<p className="mt-1 text-xs font-medium text-[#526670]">
            Versões observadas: {versionLabels.join(' · ')}
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
          {row.possibleAppearanceVariant?
            <p className="mt-2 text-xs leading-5 text-[#526670]">
              Possível variação de cor/acabamento: MERGE vincula a versão-base, sem apagar
              informações comerciais ou preços próprios. A escolha exigirá confirmação do destino.
            </p>:null}
          <p className="mt-1 text-xs text-[#526670]">Confiança {percent(row.confidence)}{readiness?` · Evidência: ${readiness}`:''}</p>
          <p className="mt-2 text-xs leading-5 text-[#526670]">
            {row.legacyAccepted
              ? 'Existe uma revisão ACCEPT legada. Ela não comprova alteração canônica.'
              : 'As ações gerais desta fila continuam em preparação. Connectors podem ser revisados no fluxo administrativo existente.'}
          </p>
          {(row.caseKind==='CONNECTOR_NEW'||row.caseKind==='CONNECTOR_UPDATE')?(
            <form action={connectorAction} className="mt-3 flex flex-wrap gap-2"
              onClick={event=>event.stopPropagation()}>
              <input type="hidden" name="findingId" value={detail.findingId}/>
              <input type="hidden" name="fingerprint" value={row.snapshotFingerprint}/>
              <button type="submit" name="decision" value="ACCEPT" disabled={connectorPending}
                className="ui-button ui-button--primary ui-button--action">Aprovar</button>
              <button type="submit" name="decision" value="REJECT" disabled={connectorPending}
                className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
              <button type="submit" name="decision" value="DEFER" disabled={connectorPending}
                className="ui-button ui-button--secondary ui-button--action">Adiar</button>
              {connectorState.message?<p className="w-full text-xs" role={connectorState.status==='error'?'alert':'status'}>{connectorState.message}</p>:null}
              <p className="w-full text-xs text-[#526670]">Aprovar ativa o Connector imediatamente, sem segunda confirmação.</p>
            </form>
          ):null}
          {row.caseKind==='MMV_NEW' && typeof row.selectedIdentity?.identityKey==='string' &&
            !row.legacyAccepted ? (
            <form action={reviewAction} className="mt-3 flex flex-wrap gap-2"
              onClick={event=>event.stopPropagation()}>
              <input type="hidden" name="findingId" value={detail.findingId}/>
              <input type="hidden" name="identityKey" value={String(row.selectedIdentity?.identityKey)}/>
              <input type="hidden" name="fingerprint" value={row.snapshotFingerprint}/>
              <button type="submit" name="decision" value="ACCEPT" disabled={reviewPending}
                className="ui-button ui-button--primary ui-button--action">Aprovar</button>
              <button type="submit" name="decision" value="REJECT" disabled={reviewPending}
                className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
              <button type="submit" name="decision" value="DEFER" disabled={reviewPending}
                className="ui-button ui-button--secondary ui-button--action">Adiar</button>
              {reviewState.message?<p className="w-full text-xs" role={reviewState.status==='error'?'alert':'status'}>{reviewState.message}</p>:null}
              <p className="w-full text-xs text-[#526670]">Aprovar aplica a identidade ao catálogo automaticamente; Rejeitar e Adiar não alteram o catálogo.</p>
            </form>
          ):(row.caseKind==='CONNECTOR_NEW'||row.caseKind==='CONNECTOR_UPDATE')?null:(
            <div className="mt-2">
              <p className="text-xs text-[#526670]">Ações por identidade indisponíveis neste caso; o finding de origem pode conter múltiplas versões.</p>
              <a className="mt-2 inline-block text-xs text-[#A9541B] underline"
                href={'/admin/agents/findings/'+encodeURIComponent(detail.findingId)}
                onClick={event=>event.stopPropagation()}>Abrir detalhe e histórico</a>
            </div>
          )}
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
      <div className="mt-3 rounded-md border border-[#D6DEE3] bg-white p-3 text-xs text-[#526670]">
        <p><strong>Run de origem:</strong> <code>{row.runId}</code></p>
        <p><strong>Finding:</strong> <code>{row.findingId}</code></p>
        <p><strong>Observado em:</strong> {date(row.observedAt)} · {row.priorRuns} observação(ões) consolidada(s)</p>
        <a className="mt-2 inline-block underline underline-offset-2" href={'/admin/agents/runs/'+row.runId}
          onClick={event=>event.stopPropagation()}>Abrir execução de origem</a>
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
    const selected=items.find(row=>row.caseId===expanded);
    if(!selected){setExpanded(null);return;}
    const controller=new AbortController();
    setLoading(true);setError(null);setDetail(null);
    fetch('/admin/agents/review-detail/'+encodeURIComponent(selected.findingId),{
      signal:controller.signal,cache:'no-store',
    }).then(async r=>{if(!r.ok)throw new Error('DETAIL_UNAVAILABLE');return r.json() as Promise<FindingDetail>;})
      .then(data=>{if(!controller.signal.aborted)setDetail(data);})
      .catch(()=>{if(!controller.signal.aborted)setError('Não foi possível carregar o detalhe. Tente novamente.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[expanded,items]);
  const toggle=(id:string)=>setExpanded(prev=>prev===id?null:id);
  const onKey=(event:React.KeyboardEvent,caseId:string)=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      toggle(caseId);
    }
  };
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
              {th('brand','Marca','8%')}
              {th('model','Modelo','9%')}
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'12.5%'}}>VERSÃO</th>
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'26%'}}>DESCOBERTA</th>
              {th('agent','Agente','9%')}
              {th('date','Data','8%')}
              {th('confidence','Confiança','7%')}
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'8%'}}>STATUS</th>
              <th scope="col" className="sticky top-0 z-20 border-b border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3" style={{width:'12.5%'}}>RECOMENDAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {items.map(row=>(
              <Fragment key={row.caseId}>
                <tr tabIndex={0}
                  aria-label={`Abrir detalhes de ${row.brand} ${row.model} ${row.version}`}
                  aria-expanded={expanded===row.caseId}
                  onClick={()=>toggle(row.caseId)}
                  onKeyDown={e=>onKey(e,row.caseId)}
                  className={`cursor-pointer border-b border-[#EAF1F4] transition-colors hover:bg-[#EAF1F4] focus-visible:outline-2 focus-visible:outline-[#9ABCC8] ${expanded===row.caseId?'bg-[#EDF4F6]':''}`}>
                  <td className="px-2.5 py-3 font-semibold" title={row.brand}>
                    <p className="truncate">{row.brand||'—'}</p>
                  </td>
                  <td className="px-2.5 py-3 font-medium" title={row.model}>
                    <p className="truncate">{row.model||'—'}</p>
                  </td>
                  <td className="px-2.5 py-3" title={row.version}>
                    <p className="truncate font-medium">{row.version||'—'}</p>
                  </td>
                  <td className="min-w-0 px-2.5 py-3" title={row.title}>
                    <p className="truncate whitespace-nowrap font-medium" title={row.title}>{row.title}</p>
                    {row.priorRuns>1?<p className="mt-1 truncate whitespace-nowrap text-[10px] text-[#61747B]">
                      {row.priorRuns} observações consolidadas
                    </p>:null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-[11px]" title={row.agentLabel}><p className="truncate">{row.agentLabel}</p></td>
                  <td className="whitespace-nowrap px-2 py-3 text-[11px]" title={date(row.observedAt)}>{date(row.observedAt)?.split(',')[0]}</td>
                  <td className="whitespace-nowrap px-2 py-3 font-semibold tabular-nums">{percent(row.confidence)}</td>
                  <td className="px-2.5 py-3"><Status status={row.status}/></td>
                  <td className="px-2.5 py-3">
                    <p className="truncate whitespace-nowrap text-[11px] font-medium" title={row.recommendation}>{row.recommendation}</p>
                    {row.evidencePreview?<p className="mt-1 truncate text-[10px] text-[#61747B]"
                      title={row.evidencePreview}>{row.evidencePreview}</p>:null}
                  </td>
                </tr>
                {expanded===row.caseId?<tr><td colSpan={9} className="p-0">{body(row)}</td></tr>:null}
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
            <article key={row.caseId} tabIndex={0} role="button"
              aria-expanded={expanded===row.caseId}
              aria-label={`Abrir detalhes de ${row.brand} ${row.model} ${row.version}`}
              onClick={e=>{if(!(e.target as HTMLElement).closest('a,summary,details'))toggle(row.caseId);}}
              onKeyDown={e=>onKey(e,row.caseId)}
              className="cursor-pointer px-3 py-3 hover:bg-[#EAF1F4] focus-visible:outline-2 focus-visible:outline-[#9ABCC8]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold">{[row.brand,row.model].filter(Boolean).join(' ')}</h3>
                  {row.version?<p className="mt-1 text-xs font-medium">Versão: {row.version}</p>:null}
                  <p className="mt-1 text-xs">{row.title}</p>
                  <p className="mt-1 text-[11px] text-[#526670]">{row.agentLabel} · {date(row.observedAt)} · {percent(row.confidence)}</p>
                </div>
                <Status status={row.status}/>
              </div>
              <p className="mt-2 text-xs font-medium">{row.recommendation}</p>
              {row.evidencePreview?<p className="mt-1 line-clamp-2 text-[11px] text-[#526670]">{row.evidencePreview}</p>:null}
              {expanded===row.caseId?<div className="mt-3" onClick={e=>e.stopPropagation()}
                onKeyDown={e=>e.stopPropagation()}>{body(row)}</div>:null}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
