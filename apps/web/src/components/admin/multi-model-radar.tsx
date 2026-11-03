'use client';

import { useState } from 'react';
import type { SellerCategoryScore } from '@/server/seller-model-score-service';

export interface RadarVehicle {
  readonly id: number;
  readonly label: string;
  readonly overallScore: number | null;
  readonly categories: readonly SellerCategoryScore[];
}
const COLORS = ['#1A1D21','#EF7732','#357B97','#7E65A6','#44917B','#C05268','#A98725','#697786'];
const formatScore = (n: number | null) => n === null ? 'N/D' : n.toFixed(1).replace('.', ',');
function point(i:number,n:number,val:number) {
  const angle = -Math.PI/2 + (i*2*Math.PI)/n;
  return [170+Math.cos(angle)*112*val,170+Math.sin(angle)*112*val] as const;
}
function Eye({hidden}: {readonly hidden:boolean}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <path d="M2.2 12s3.5-7 9.8-7 9.8 7 9.8 7-3.5 7-9.8 7-9.8-7-9.8-7Z"/>
    <circle cx="12" cy="12" r="3"/>
    {hidden && <path d="M3 21 21 3" strokeWidth="2.5"/>}
  </svg>;
}
export function MultiModelRadar({vehicles}: {readonly vehicles:readonly RadarVehicle[]}) {
  const [hidden,setHidden]=useState<readonly number[]>([]);
  const [focused,setFocused]=useState<number|null>(null);
  const categories=vehicles[0]?.categories??[];
  if(!categories.length)return null;
  const show=(id:number)=>!hidden.includes(id);
  const focus=(id:number)=>setFocused(current=>current===id?null:id);
  return <section className="mt-2 grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(21rem,1fr)]">
    <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-[#D6DEE3] bg-white p-3">
      <h2 className="text-base font-semibold">Radar de avaliação</h2>
      <p className="mt-0.5 text-xs text-text-muted">Avaliação de modelos por categorias de especificações.</p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <svg role="img" aria-label="Avaliação de modelos por categorias de especificações" className="block h-full max-h-[min(62vh,620px)] min-h-0 w-full max-w-[760px]" preserveAspectRatio="xMidYMid meet" viewBox="0 0 340 340">
          {[.25,.5,.75,1].map(level=><polygon key={level} points={categories.map((_,i)=>point(i,categories.length,level).join(',')).join(' ')} fill="none" stroke="#EAF1F4" strokeWidth="1"/>)}
          {categories.map((c,i)=>{const [x,y]=point(i,categories.length,1);return <line key={c.key} x1="170" y1="170" x2={x} y2={y} stroke="#EAF1F4" strokeWidth=".8"/>;})}
          {vehicles.map((v,i)=>{if(!show(v.id))return null;const dim=focused!==null&&focused!==v.id;return <polygon key={v.id} points={categories.map((c,j)=>point(j,categories.length,Math.max(0,Math.min(1,(v.categories.find(t=>t.key===c.key)?.score??0)/10))).join(',')).join(' ')} fill={COLORS[i%COLORS.length]} fillOpacity={dim?.015:.075} stroke={COLORS[i%COLORS.length]} strokeOpacity={dim?.18:1} strokeWidth={focused===v.id?2:1.5}/>;})}
          {categories.map((c,i)=>{const [x,y]=point(i,categories.length,1.19);return <text key={c.key} x={x} y={y} textAnchor={x<160?'end':x>180?'start':'middle'} dominantBaseline="middle" fontSize="10" fontWeight="400" fill="#526670">{c.label}</text>;})}
        </svg>
      </div>
      <div className={`grid w-full gap-2 pt-2 grid-cols-1 sm:grid-cols-2 ${vehicles.length <= 2 ? 'lg:grid-cols-2' : vehicles.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        {vehicles.map((v,i)=><div key={v.id} className={`flex min-w-0 items-center gap-1 rounded-md border border-[#D6DEE3] px-2 py-1 ${focused===v.id?'bg-[#EAF1F4]':'bg-white'}`}>
          <button type="button" onClick={()=>focus(v.id)} aria-pressed={focused===v.id} title={v.label} className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 text-left text-[12px] hover:text-[#1A1D21]" style={{opacity:show(v.id)?1:.42}}>
            <span className="size-2.5 shrink-0 rounded-sm" style={{backgroundColor:COLORS[i%COLORS.length]}}/>
            <span className="min-w-0 truncate font-medium">{i+1}. {v.label}</span>
          </button>
          <button type="button" onClick={()=>setHidden(current=>current.includes(v.id)?current.filter(id=>id!==v.id):[...current,v.id])} aria-label={`${show(v.id)?'Ocultar':'Mostrar'} ${v.label} no radar`} aria-pressed={show(v.id)} title={show(v.id)?'Ocultar no radar':'Mostrar no radar'} className="grid size-7 shrink-0 place-items-center rounded text-[#526670] hover:bg-[#DCE8ED]"><Eye hidden={!show(v.id)}/></button>
        </div>)}
      </div>
    </div>
    <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-[#D6DEE3] bg-white p-3">
      <h2 className="text-base font-semibold">Notas por dimensão</h2>
      <div className="mt-2 min-h-0 flex-1 overflow-x-auto">
        <table className="h-full w-full table-fixed text-xs">
          <thead><tr className="border-b border-border"><th className="w-[44%] px-2 py-1 text-left">Dimensão</th>{vehicles.map((v,i)=><th key={v.id} className="px-1 py-1 text-right"><button type="button" onClick={()=>focus(v.id)} aria-pressed={focused===v.id} title={v.label} className="rounded px-1 py-1 hover:bg-[#EAF1F4]"><span className="inline-block size-2 rounded-full" style={{backgroundColor:COLORS[i%COLORS.length]}}/> {i+1}</button></th>)}</tr></thead>
          <tbody>{categories.map(c=><tr key={c.key} className="border-b border-[#EAF1F4]"><td className="px-2 py-1">{c.label}</td>{vehicles.map(v=><td key={v.id} className="px-1 py-1 text-right font-medium" style={{opacity:hidden.includes(v.id)?.45:focused!==null&&focused!==v.id?.4:1,backgroundColor:focused===v.id?'#EAF1F4':undefined}}>{formatScore(v.categories.find(t=>t.key===c.key)?.score??null)}</td>)}</tr>)}<tr className="font-semibold"><td className="px-2 py-1">Média</td>{vehicles.map(v=><td key={v.id} className="px-1 py-1 text-right" style={{backgroundColor:focused===v.id?'#EAF1F4':undefined}}>{formatScore(v.overallScore)}</td>)}</tr></tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-text-muted">Clique no número para destacar; use o olho para ocultar ou mostrar a série. N/D não entra na média.</p>
    </div>
  </section>;
}
