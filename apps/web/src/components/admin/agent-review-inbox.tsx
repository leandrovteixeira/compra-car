'use client';

import { Fragment, useActionState, useEffect, useRef, useState } from 'react';
import { reviewMmvIdentityAction } from '@/app/admin/agents/identity-actions';
import { reviewConnectorAction } from '@/app/admin/agents/connector-decisions';
import { reviewModelYearAction } from '@/app/admin/agents/model-year-decisions';
import { reviewSpecFindingAction } from '@/app/admin/agents/spec-decisions';
import { reviewFipeCandidateAction } from '@/app/admin/agents/fipe-decisions';
import { reviewGenerationDecisionAction } from '@/app/admin/agents/generation-decisions';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReviewStatus } from '@compra-car/core/agent-platform';
import type { ReviewInboxRow, ReviewSort, ReviewDirection } from '@/application/admin/agent-review-inbox';

type FindingDetail = {
  findingId: string;
  title: string;
  canonicalOptions?: readonly {id:number;code:string;label:string;group:string;type:string}[];
  specReviewHints?: readonly {code:string;label:string;score:number;reasons:readonly string[]}[];
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
type CanonicalSpecOption={id:number;code:string;label:string;group:string;type:string};
function CanonicalSpecCombobox({
  options,value,onChange,disabled,id,suggestedCodes=[],
}:{
  options:readonly CanonicalSpecOption[];
  suggestedCodes?:readonly string[];
  value:string;
  onChange:(next:string)=>void;
  disabled:boolean;
  id:string;
}){
  const root=useRef<HTMLDivElement>(null);
  const input=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [showAll,setShowAll]=useState(false);
  const normalize=(raw:string)=>raw.normalize('NFD').replace(/\p{M}/gu,'')
    .toLocaleLowerCase('pt-BR').trim();
  const selected=options.find(option=>String(option.id)===value);
  const words=normalize(query).split(/\s+/u).filter(Boolean);
  const ranked=[...options].sort((a,b)=>{
    const ai=suggestedCodes.indexOf(a.code),bi=suggestedCodes.indexOf(b.code);
    if(ai>=0&&bi<0)return -1;
    if(ai<0&&bi>=0)return 1;
    if(ai>=0&&bi>=0)return ai-bi;
    return a.code.localeCompare(b.code);
  });
  // Start with only the relevant review hints; searching always searches the
  // entire compatible catalog. Showing all is an explicit operator choice.
  const scoped=words.length?ranked.filter(option=>{
    const haystack=normalize([option.code,option.label,option.group].join(' '));
    return words.every(word=>haystack.includes(word));
  }):showAll?ranked:ranked.filter(option=>suggestedCodes.includes(option.code));
  const matches=scoped.slice(0,50);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{
      if(root.current&&!root.current.contains(event.target as Node))setOpen(false);
    };
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[]);
  const choose=(option:CanonicalSpecOption)=>{
    onChange(String(option.id));
    setQuery('');
    setOpen(false);
    setActive(0);
    setShowAll(false);
  };
  const listId=id+'-options';
  return <div ref={root} className="relative w-full">
    <input type="hidden" name="targetSpecId" value={value}/>
    <div className="relative">
      <input
        ref={input}
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open&&matches.length?listId+'-'+active:undefined}
        autoComplete="off"
        disabled={disabled}
        value={open?query:(selected?selected.code+' · '+selected.label:query)}
        placeholder="Buscar spec por código ou descrição..."
        className="w-full rounded-md border border-[#BCCAD0] bg-white py-2 pl-3 pr-9 text-xs outline-none focus:border-[#EF7732] focus:ring-1 focus:ring-[#EF7732]"
        onFocus={()=>{setQuery('');setOpen(true);setActive(0);setShowAll(false);}}
        onChange={event=>{
          setQuery(event.target.value);
          onChange('');
          setOpen(true);
          setActive(0);
          setShowAll(false);
        }}
        onKeyDown={event=>{
          if(event.key==='Escape'){setOpen(false);event.stopPropagation();return;}
          if(event.key==='ArrowDown'){
            event.preventDefault();setOpen(true);
            setActive(i=>Math.min(matches.length-1,Math.max(0,i+1)));return;
          }
          if(event.key==='ArrowUp'){
            event.preventDefault();setActive(i=>Math.max(0,i-1));return;
          }
          if(event.key==='Enter'&&open){
            event.preventDefault();
            if(matches[active])choose(matches[active]);
          }
        }}
      />
      <button type="button" tabIndex={-1} aria-label="Mostrar especificações"
        disabled={disabled}
        onClick={()=>{setOpen(prev=>!prev);input.current?.focus();}}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-[#526670]"
      ><span aria-hidden="true">⌄</span></button>
    </div>
    {open&&!disabled?<div id={listId} role="listbox"
      aria-label="Especificações canônicas compatíveis"
      className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto rounded-md border border-[#BCCAD0] bg-white p-1 shadow-lg">
      {matches.length?matches.map((option,i)=>
        <button type="button" key={option.id} role="option"
          id={listId+'-'+i}
          aria-selected={String(option.id)===value}
          onMouseEnter={()=>setActive(i)}
          onMouseDown={event=>event.preventDefault()}
          onClick={()=>choose(option)}
          className={'block w-full rounded px-3 py-2 text-left text-xs '+
            (i===active?'bg-[#EDF4F6] text-[#293D47]':'hover:bg-[#EDF4F6]')}
        >
          <span className="font-semibold">{option.code}</span> · {option.label}
          {suggestedCodes.includes(option.code)?<span className="ml-1 text-[10px] text-[#A9541B]">· Sugestão para revisão</span>:null}
          {option.group?<span className="ml-1 text-[#526670]">— {option.group}</span>:null}
        </button>
      ):<p className="px-3 py-2 text-xs text-[#526670]">{words.length?'Nenhum spec encontrado.':'Nenhuma sugestão segura para este item.'}</p>}
      {!words.length&&!showAll?(
        <button type="button" onMouseDown={event=>event.preventDefault()}
          onClick={()=>{setShowAll(true);setActive(0);}}
          className="mt-1 w-full border-t border-[#EAF1F4] px-3 py-2 text-left text-xs font-medium text-[#A9541B] hover:bg-[#EDF4F6]">
          {suggestedCodes.length?'Pesquisar também nos demais specs':'Ver catálogo completo'}
        </button>
      ):null}
      {words.length&&matches.length===50?
        <p className="px-3 py-2 text-[11px] text-[#526670]">Refine sua busca para ver mais resultados.</p>:null}
    </div>:null}
  </div>;
}

function DetailContent({detail,row}:{readonly detail:FindingDetail;readonly row:ReviewInboxRow}){
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = '/admin/agents' + (searchParams.toString() ? '?' + searchParams.toString() : '');
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewMmvIdentityAction, {status:'idle' as const,message:''});
  const [connectorState, connectorAction, connectorPending]=useActionState(reviewConnectorAction,{status:'idle' as const,message:''});
  const [yearState,yearAction,yearPending]=useActionState(reviewModelYearAction,{status:'idle' as const,message:''});
  const [generationState,generationAction,generationPending]=useActionState(reviewGenerationDecisionAction,{status:'idle' as const,message:''});
  const [specState,specAction,specPending]=useActionState(reviewSpecFindingAction,{status:'idle' as const,message:''});
  const [specTargetId,setSpecTargetId]=useState('');
  useEffect(()=>{if(reviewState.status==='success'||connectorState.status==='success'||yearState.status==='success'||generationState.status==='success'||specState.status==='success')router.refresh();},[reviewState.status,connectorState.status,yearState.status,generationState.status,specState.status,router]);
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
  const generation=detail.technicalPayload.generationAssessment;
  const generationData = generation && typeof generation==='object' && !Array.isArray(generation)
    ? generation as Record<string,unknown> : null;
  const signals=Array.isArray(generationData?.signals)
    ? generationData.signals.filter((x):x is Record<string,unknown>=>
        x!==null&&typeof x==='object'&&!Array.isArray(x)):[];
  const generationLabels:Record<string,string>={
    design:'Design',powertrain:'Motorização',dimensions:'Dimensões',
  };
  const generationWeights:Record<string,string>={
    design:'35%',powertrain:'35%',dimensions:'30%',
  };
  const currentGenerationMY=get('currentModelYear');
  const previousGenerationMY=get('previousModelYear');
  const isQaGenerationFixture=detail.technicalPayload.qaFixture===true;
  const isSpecCase=row.caseKind==='SPEC_NEW'||row.caseKind==='SPEC_AMBIGUOUS';
  const specName=typeof detail.proposal?.sourceLabel==='string'?
    detail.proposal.sourceLabel:detail.title.split(' · ').slice(-1)[0]??detail.title;
  const specValue=typeof detail.proposal?.observedValue==='string'
    ?detail.proposal.observedValue:null;
  const specUnit=typeof detail.proposal?.observedUnit==='string'
    ?detail.proposal.observedUnit:null;
  const specRawLabel=typeof detail.proposal?.rawLabel==='string'
    ?detail.proposal.rawLabel:null;
  const specKind=typeof detail.proposal?.kind==='string'?detail.proposal.kind:null;
  const specPage=typeof detail.proposal?.page==='number'?detail.proposal.page:null;
  const specVersions=Array.isArray(detail.proposal?.versionColumns)
    ?detail.proposal.versionColumns.filter((x):x is string=>typeof x==='string'):[];
  const specCandidates=Array.isArray(detail.proposal?.candidateCodes)
    ?detail.proposal.candidateCodes.filter((x):x is string=>typeof x==='string'):[];
  const applicableCatalog=detail.canonicalOptions??[];
  const specIsScale=specKind==='scale';
  const scopeOnly=detail.technicalPayload.noProductAssignment===true;
  return (
    <div className="rounded-b-lg border border-t-0 border-[#D6DEE3] bg-[#F6F7F8] p-3 sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
        <section className="rounded-md bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#526670]">Observado</h3>
          <p className="text-[13px] font-semibold">{observed || detail.title}</p>
          {isSpecCase?(
            <div className="mt-2 space-y-2 rounded-md border border-[#F2C0A0] bg-[#FFF3EA] p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A9541B]">Especificação identificada na fonte</p>
              <p className="break-words text-base font-bold leading-6 text-[#293D47]">{specName}</p>
              {specValue!==null?<p className="text-sm font-semibold text-[#293D47]">
                Valor observado: {specValue}{specUnit?' '+specUnit:''}
              </p>:null}
              {specRawLabel&&specRawLabel!==specName?
                <p className="text-xs text-[#526670]">Texto original: {specRawLabel}</p>:null}
              <p className="text-xs text-[#526670]">Tipo: {specKind??'não informado'}{specPage?' · Página '+specPage:''}</p>
              {specVersions.length?<p className="text-xs text-[#526670]">Colunas da ficha: {specVersions.join(' · ')}</p>:null}
              {scopeOnly?<p className="text-xs font-medium text-[#A9541B]">
                Descoberta de vocabulário: ainda não vinculada a uma versão ou MY.
              </p>:null}
            </div>
          ):null}
          {row.version?<p className="mt-1 text-xs font-medium text-[#526670]">
            Versão selecionada: {row.version}
          </p>:null}
          {row.caseKind==='MMV_GENERATION' && previousGenerationMY && currentGenerationMY?
            <p className="mt-1 text-xs font-medium text-[#526670]">
              Comparação: MY {previousGenerationMY} → MY {currentGenerationMY}
            </p>:null}
          {isQaGenerationFixture?
            <p className="mt-2 text-xs font-semibold text-[#A9541B]">
              QA: teste de aprovação, não é confirmação técnica do veículo.
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
          {isSpecCase?(
            <form action={specAction} onClick={event=>event.stopPropagation()}
              className="mt-3 space-y-3">
              <input type="hidden" name="findingId" value={detail.findingId}/>
              <input type="hidden" name="fingerprint" value={row.snapshotFingerprint}/>
              <div className="space-y-1">
                <label htmlFor={'spec-canonical-'+detail.findingId} className="block text-xs font-semibold">
                  Especificação canônica existente
                </label>
                <CanonicalSpecCombobox
                  id={'spec-canonical-'+detail.findingId}
                  options={applicableCatalog}
                  suggestedCodes={(detail.specReviewHints??[]).map(h=>h.code)}
                  value={specTargetId}
                  onChange={setSpecTargetId}
                  disabled={specPending||specIsScale}
                />
                {(detail.specReviewHints??[]).length?<p className="text-[11px] text-[#526670]">
                  Correspondências sugeridas para análise: {(detail.specReviewHints??[])
                    .map(h=>h.code).join(' · ')}. Nenhuma será selecionada automaticamente.
                </p>:null}
                {specCandidates.length?<p className="text-[11px] text-[#526670]">
                  Sugestões do agente: {specCandidates.join(', ')}
                </p>:null}
                {specIsScale?<p className="text-xs text-[#A9541B]">
                  Specs de escala exigem vínculo com família de opções; canonicalização desabilitada nesta etapa.
                </p>:null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="decision" value="CANONICALIZE"
                  disabled={specPending||!specTargetId||specIsScale}
                  className="ui-button ui-button--primary ui-button--action">Canonicalizar</button>
                <button type="button" disabled title="Criação de specs na próxima etapa de manutenção do catálogo"
                  className="ui-button ui-button--secondary ui-button--action opacity-50 cursor-not-allowed">
                  Criar (em breve)
                </button>
                <button type="submit" name="decision" value="REJECT" disabled={specPending}
                  className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
                <button type="submit" name="decision" value="DEFER" disabled={specPending}
                  className="ui-button ui-button--secondary ui-button--action">Adiar</button>
              </div>
              {specPending?<p role="status" className="flex items-center gap-2 text-xs font-medium text-[#A9541B]">
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-[#EF7732] border-t-transparent" aria-hidden="true"/>
                Registrando a decisão do spec...
              </p>:null}
              {specState.message?<p role={specState.status==='error'?'alert':'status'}
                className="text-xs">{specState.message}</p>:null}
              <p className="text-xs text-[#526670]">
                Canonicalizar registra um alias aprovado. Não altera valores das fichas técnicas.
                Rejeitar se aplica somente a este finding de origem: não bloqueia nomes iguais
                encontrados em outros documentos, veículos ou tipos de bateria.
              </p>
            </form>
          ):null}
          {row.caseKind==='MMV_GENERATION' && signals.length?
            <div className="mt-3 space-y-1.5 rounded-md border border-[#D6DEE3] p-2 text-xs">
              <p className="font-semibold">Classificação: {String(detail.proposal?.changeType??'—')}</p>
              {signals.map((signal,i)=>(
                <p key={i} className="flex justify-between gap-3">
                  <span>{generationLabels[String(signal.dimension)]??String(signal.dimension)} ({generationWeights[String(signal.dimension)]??'—'})</span>
                  <strong>{typeof signal.severity==='number'?`${signal.severity}/3`:'Sem evidência'}</strong>
                </p>
              ))}
              <p className="border-t border-[#EAF1F4] pt-1 text-[#526670]">
                Índice ponderado: {typeof detail.proposal?.weightedScore==='number'
                  ?Number(detail.proposal.weightedScore).toLocaleString('pt-BR',{maximumFractionDigits:2})
                  :'não calculado'}
              </p>
            </div>:null}
          {!isSpecCase?<p className="mt-2 text-xs leading-5 text-[#526670]">
            {row.legacyAccepted
              ? 'Existe uma revisão ACCEPT legada. Ela não comprova alteração canônica.'
              : 'As ações gerais desta fila continuam em preparação. Connectors podem ser revisados no fluxo administrativo existente.'}
          </p>:null}
          {row.caseKind==='MMV_GENERATION'?(
            <form action={generationAction} className="mt-3 flex flex-wrap gap-2"
              onClick={event=>event.stopPropagation()}>
              <input type="hidden" name="findingId" value={detail.findingId}/>
              <input type="hidden" name="fingerprint" value={row.snapshotFingerprint}/>
              <button type="submit" name="decision" value="ACCEPT" disabled={generationPending||detail.proposal?.changeType==='UNKNOWN'}
                className="ui-button ui-button--primary ui-button--action">Aprovar</button>
              <button type="submit" name="decision" value="REJECT" disabled={generationPending}
                className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
              <button type="submit" name="decision" value="DEFER" disabled={generationPending}
                className="ui-button ui-button--secondary ui-button--action">Adiar</button>
              {generationState.message?<p className="w-full text-xs"
                role={generationState.status==='error'?'alert':'status'}>{generationState.message}</p>:null}
              <p className="w-full text-xs text-[#526670]">
                Aprovar registra a classificação para uso futuro; não modifica MMVs,
                specs ou carry-over. Sem evidência suficiente, a aprovação fica indisponível.
              </p>
            </form>
          ):null}
          {row.caseKind==='MODEL_YEAR_NEW'?(
            <form action={yearAction} className="mt-3 flex flex-wrap gap-2"
              onClick={event=>event.stopPropagation()}>
              <input type="hidden" name="findingId" value={detail.findingId}/>
              <input type="hidden" name="fingerprint" value={row.snapshotFingerprint}/>
              <button type="submit" name="decision" value="ACCEPT" disabled={yearPending}
                className="ui-button ui-button--primary ui-button--action">Aprovar</button>
              <button type="submit" name="decision" value="REJECT" disabled={yearPending}
                className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
              <button type="submit" name="decision" value="DEFER" disabled={yearPending}
                className="ui-button ui-button--secondary ui-button--action">Adiar</button>
              {yearPending?<p className="flex w-full items-center gap-2 text-xs font-medium text-[#A9541B]" role="status" aria-live="polite">
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-[#EF7732] border-t-transparent" aria-hidden="true"/>
                Aplicando decisão de ano-modelo...
              </p>:null}
              {yearState.message?<p className="w-full text-xs" role={yearState.status==='error'?'alert':'status'}>{yearState.message}</p>:null}
              <p className="w-full text-xs text-[#526670]">Aprovar aplica imediatamente o ano-modelo ao catálogo.</p>
            </form>
          ):null}
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
          {row.caseKind==='MMV_NEW' && typeof row.selectedIdentity?.identityKey==='string' ? (
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
          ):(row.caseKind==='CONNECTOR_NEW'||row.caseKind==='CONNECTOR_UPDATE'||row.caseKind==='MODEL_YEAR_NEW'||row.caseKind==='MMV_GENERATION'||isSpecCase)?null:(
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
                  {e.url&&(e.sourceType==='FIPE'||e.url.startsWith('https://fipe.parallelum.com.br/api/'))?
                    <div className="mt-1 space-y-1">
                      <a className="inline-block text-[#A9541B] underline underline-offset-2"
                        href="https://veiculos.fipe.org.br/" target="_blank" rel="noopener noreferrer">
                        Consultar no site da Tabela FIPE
                      </a>
                      {typeof detail.proposal?.fipeCode==='string'?
                        <p className="text-[#526670]">Código FIPE: {detail.proposal.fipeCode} (pesquisar no site)</p>:null}
                      <div><a className="text-[#526670] underline underline-offset-2"
                        href={e.url} target="_blank" rel="noopener noreferrer">
                        Ver dados da API (JSON)
                      </a></div>
                    </div>
                    :e.url?<a className="mt-1 inline-block text-[#A9541B] underline underline-offset-2"
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
        <a className="mt-2 inline-block underline underline-offset-2" href={'/admin/agents/runs/'+row.runId+'?returnTo='+encodeURIComponent(returnTo)}
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

function FipeReviewDetail({row}:{row:ReviewInboxRow}){
  const router=useRouter();
  const [state,action,pending]=useActionState(reviewFipeCandidateAction,{status:'idle' as const,message:''});
  useEffect(()=>{if(state.status==='success')router.refresh();},[state.status,router]);
  const candidate=row.fipeCandidate;
  if(!candidate)return null;
  return <div className="grid gap-3 border-t border-[#D6DEE3] bg-[#F6F7F8] p-4 lg:grid-cols-3">
    <section className="rounded-md bg-white p-3">
      <h3 className="text-xs font-semibold uppercase text-[#526670]">Observado</h3>
      <p className="mt-2 text-sm font-semibold">{row.brand} {row.model} {row.version}</p>
      <p className="mt-2 text-xs text-[#526670]">Código FIPE: {candidate.code}</p>
      <p className="mt-1 text-xs text-[#526670]">{candidate.label}</p>
    </section>
    <section className="rounded-md bg-white p-3">
      <h3 className="text-xs font-semibold uppercase text-[#526670]">Proposta e decisão</h3>
      <p className="mt-2 text-xs text-[#526670]">Correspondência sugerida · Confiança {percent(row.confidence)}</p>
      <p className="mt-1 text-xs text-[#526670]">
        {candidate.dependencyState==='READY'||candidate.dependencyState==='APPLIED'
          ?'Pronto para decisão'
          :'Dependência não liberada: não há nó READY para este candidato FIPE. Use um candidato READY correspondente ou resolva a dependência.'}
      </p>
      <form action={action} onClick={e=>e.stopPropagation()} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="candidateId" value={candidate.id}/>
        <button type="submit" name="decision" value="ACCEPT" disabled={pending||!['READY','APPLIED'].includes(candidate.dependencyState)} className="ui-button ui-button--primary ui-button--action">Aprovar</button>
        <button type="submit" name="decision" value="REJECT" disabled={pending} className="ui-button ui-button--destructive ui-button--action">Rejeitar</button>
        <button type="submit" name="decision" value="DEFER" disabled={pending} className="ui-button ui-button--secondary ui-button--action">Adiar</button>
        {state.message?<p role={state.status==='error'?'alert':'status'} className="w-full text-xs">{state.message}</p>:null}
      </form>
      <p className="mt-2 text-xs text-[#526670]">Aprovar vincula a FIPE ao MMV e libera o MY sem outro clique.</p>
    </section>
    <section className="rounded-md bg-white p-3">
      <h3 className="text-xs font-semibold uppercase text-[#526670]">Evidências</h3>
      <a className="mt-2 inline-block text-xs text-[#A9541B] underline" href={candidate.url} target="_blank" rel="noopener noreferrer">Consultar código FIPE na fonte</a>
      <p className="mt-2 text-xs text-[#526670]">Coleta via Parallelum · vínculo sujeito à aprovação humana</p>
    </section>
  </div>;
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
  const selectedRow=items.find(row=>row.caseId===expanded);
  const selectedFindingId=selectedRow?.findingId??null;
  const selectedIsFipe=Boolean(selectedRow?.fipeCandidate);
  useEffect(()=>{
    if(!expanded){setDetail(null);setError(null);setLoading(false);return;}
    if(!selectedFindingId){setExpanded(null);return;}
    if(selectedIsFipe){setDetail(null);setError(null);setLoading(false);return;}
    const controller=new AbortController();
    setLoading(true);setError(null);setDetail(null);
    fetch('/admin/agents/review-detail/'+encodeURIComponent(selectedFindingId),{
      signal:controller.signal,cache:'no-store',
    }).then(async r=>{if(!r.ok)throw new Error('DETAIL_UNAVAILABLE');return r.json() as Promise<FindingDetail>;})
      .then(data=>{if(!controller.signal.aborted)setDetail(data);})
      .catch(()=>{if(!controller.signal.aborted)setError('Não foi possível carregar o detalhe. Tente novamente.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[expanded,selectedFindingId,selectedIsFipe]);
  const toggle=(id:string)=>setExpanded(prev=>prev===id?null:id);
  const onKey=(event:React.KeyboardEvent,caseId:string)=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      toggle(caseId);
    }
  };
  const body=(row:ReviewInboxRow)=>(
    row.fipeCandidate?<FipeReviewDetail row={row}/>:
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
