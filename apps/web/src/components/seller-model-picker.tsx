'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SellerModelOption, SellerScoreRadius } from '@/server/seller-model-score-service';

interface Props { readonly options:readonly SellerModelOption[]; readonly radius:SellerScoreRadius; }
function normalize(value:string){return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');}
export function SellerModelPicker({options,radius}:Props){
 const [search,setSearch]=useState('');
 const query=normalize(search.trim());
 const filtered=useMemo(()=>query?options.filter(o=>normalize(o.label).includes(query)).slice(0,8):[],[options,query]);
 return <div className="relative">
  <label className="ui-label block" htmlFor="seller-model-search">Buscar modelo</label>
  <input id="seller-model-search" className="ui-field mt-1" autoComplete="off" onChange={e=>setSearch(e.target.value)} placeholder="Buscar marca, modelo ou versão..." type="search" value={search}/>
  {query?<div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
   {filtered.length?filtered.map(option=><Link className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary" href={`/ver-modelo?product=${option.id}&radius=${radius}`} key={option.id}>{option.label}</Link>):<p className="px-3 py-2 text-sm text-text-muted">Nenhum modelo encontrado.</p>}
  </div>:null}
 </div>;
}
