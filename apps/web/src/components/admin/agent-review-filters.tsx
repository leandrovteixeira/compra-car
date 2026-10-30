'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReviewDirection, ReviewSort } from '@/application/admin/agent-review-inbox';
import type { ReviewStatus } from '@compra-car/core/agent-platform';

export type AgentFilter = ''|'BRAND_CONNECTOR'|'MMV_DISCOVERY'|'YEAR'|
  'PRICE_INTELLIGENCE'|'SPEC_INTELLIGENCE'|'FIPE_DISCOVERY';

export function AgentReviewFilters(props:{
  readonly initialSearch:string;
  readonly agent:AgentFilter;
  readonly status:ReviewStatus|'ALL';
  readonly sort:ReviewSort;
  readonly direction:ReviewDirection;
}){
  const router=useRouter();
  const pathname=usePathname();
  const params=useSearchParams();
  const [term,setTerm]=useState(props.initialSearch);
  const [pending,startTransition]=useTransition();

  const navigate=(changes:Record<string,string>)=>{
    const next=new URLSearchParams(params.toString());
    next.delete('tab');
    next.delete('review');
    next.delete('page');
    for(const [k,v] of Object.entries(changes)){
      if(!v || (k==='sort'&&v==='date') || (k==='direction'&&v==='desc'))next.delete(k);
      else next.set(k,v);
    }
    startTransition(()=>router.replace(pathname+(next.size?'?'+next.toString():''),{scroll:false}));
  };
  useEffect(()=>{
    const current=params.get('q')??'';
    if(term===current)return;
    const timer=setTimeout(()=>{
      const next=new URLSearchParams(params.toString());
      next.delete('page');
      next.delete('tab');
      next.delete('review');
      if(term.trim())next.set('q',term.trim());
      else next.delete('q');
      startTransition(()=>router.replace(pathname+(next.size?'?'+next.toString():''),{scroll:false}));
    },350);
    return ()=>clearTimeout(timer);
  },[term,params,pathname,router]);

  const sortValue=props.sort+':'+props.direction;
  return <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Buscar e filtrar revisões">
    <label className="relative min-w-[200px] flex-1">
      <span className="sr-only">Buscar marca, modelo, versão ou descoberta</span>
      <input type="search" value={term} onChange={e=>setTerm(e.target.value)}
        maxLength={120} placeholder="Buscar marca, modelo, versão ou descoberta"
        className="ui-field h-10 w-full pr-10" autoComplete="off"/>
      {pending?<span className="absolute right-3 top-3 size-4 animate-spin rounded-full border-2 border-[#9ABCC8] border-t-[#EF7732]" aria-label="Filtrando"/>:null}
    </label>
    <label>
      <span className="sr-only">Agente</span>
      <select className="ui-field h-10 min-w-[148px]" value={props.agent}
        onChange={e=>navigate({agent:e.target.value})} aria-label="Filtrar por agente">
        <option value="">Todos os agentes</option>
        <option value="BRAND_CONNECTOR">Brand Connector</option>
        <option value="MMV_DISCOVERY">MMV Discovery</option>
        <option value="FIPE_DISCOVERY">FIPE Agent</option>
        <option value="YEAR">Ano-modelo</option>
        <option value="SPEC_INTELLIGENCE">Specs</option>
        <option value="PRICE_INTELLIGENCE">Preço</option>
      </select>
    </label>
    <label>
      <span className="sr-only">Status</span>
      <select className="ui-field h-10 min-w-[128px]" value={props.status}
        onChange={e=>navigate({status:e.target.value})} aria-label="Filtrar por status">
        <option value="WAITING">Aguardando</option>
        <option value="POSTPONED">Adiado</option>
        <option value="REJECTED">Rejeitado</option>
        <option value="APPROVED">Aprovado</option>
        <option value="ALL">Todos</option>
      </select>
    </label>
    <label>
      <span className="sr-only">Ordenação</span>
      <select className="ui-field h-10 min-w-[147px]" value={sortValue}
        onChange={e=>{
          const [sort,direction]=e.target.value.split(':');
          navigate({sort,direction});
        }} aria-label="Ordenar descobertas">
        <option value="date:desc">Mais recentes</option>
        <option value="date:asc">Mais antigos</option>
        <option value="confidence:desc">Maior confiança</option>
        <option value="confidence:asc">Menor confiança</option>
        <option value="brand:asc">Marca A–Z</option>
        <option value="brand:desc">Marca Z–A</option>
        <option value="model:asc">Modelo A–Z</option>
        <option value="model:desc">Modelo Z–A</option>
        <option value="agent:asc">Agente A–Z</option>
        <option value="agent:desc">Agente Z–A</option>
      </select>
    </label>
    <Link href="/admin/agents" className="ui-button ui-button--secondary ui-button--action h-10">
      Limpar
    </Link>
  </div>;
}
