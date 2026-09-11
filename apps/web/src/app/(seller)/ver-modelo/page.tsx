import Link from 'next/link';
import { SellerModelPicker } from '@/components/seller-model-picker';
import { SellerModelRadar } from '@/components/seller-model-radar';
import { loadSellerModelScore,type SellerScoreRadius } from '@/server/seller-model-score-service';
interface Props{readonly searchParams:Promise<{readonly product?:string|readonly string[];readonly radius?:string|readonly string[]}>}
function first(v:string|readonly string[]|undefined){return Array.isArray(v)?v[0]:v;}
function parseRadius(v:string|readonly string[]|undefined):SellerScoreRadius{const n=Number(first(v));return n===3||n===10?n:5;}
function money(v:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);}
function score(v:number|null){return v===null?'N/D':v.toFixed(1).replace('.',',');}
export default async function SellerModelPage({searchParams}:Props){const params=await searchParams;const radius=parseRadius(params.radius);const raw=Number(first(params.product));const id=Number.isSafeInteger(raw)&&raw>0?raw:null;const result=await loadSellerModelScore(id,radius);
return <main className="min-h-[calc(100dvh-var(--app-topbar-height))] bg-background px-3 py-3 text-text-primary sm:px-5 lg:px-6"><div className="mx-auto w-full max-w-[100rem]">
 <div className="border-b border-border pb-3">
  <h1 className="text-2xl font-semibold tracking-tight">Ver modelo</h1><p className="mt-0.5 text-sm text-text-muted">Valor percebido contra veículos de preço semelhante.</p>
 </div>
 <div className="mt-3"><SellerModelPicker options={result.options} radius={radius} showLabel={false}/></div>
 {!result.selected?<div className="ui-surface mt-3 flex min-h-64 items-center justify-center text-center"><div><h2 className="text-lg font-semibold">Escolha um modelo</h2><p className="mt-1 text-sm text-text-muted">Use a busca acima para abrir o score e o radar.</p></div></div>:
 <section className="mt-3 min-w-0">
  <div className="ui-surface !px-4 !py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{result.selected.label}</h2><p className="text-sm text-text-muted">MSRP vigente: {money(result.selected.price)}</p></div><div className="flex items-center gap-2"><span className="text-xs font-semibold text-text-muted">Raio</span>{[3,5,10].map(v=><Link className={`ui-button ui-button--compact ${radius===v?'ui-button--primary':'ui-button--secondary'}`} href={`/ver-modelo?product=${result.selected!.id}&radius=${v}`} key={v}>±{v}%</Link>)}</div></div></div>
  <div className="mt-3 grid gap-3 xl:h-[29rem] xl:grid-cols-[10rem_minmax(0,1fr)_28rem] xl:items-stretch">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-2">
    <div className="flex min-h-32 flex-col justify-between rounded-xl border border-border bg-surface-muted p-4 xl:min-h-0"><span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Score</span><strong className="self-center text-4xl font-semibold leading-none xl:text-5xl">{score(result.overallScore)}</strong><span className="text-center text-[0.6875rem] text-text-muted">valor percebido</span></div>
    <div className="flex min-h-32 flex-col justify-between rounded-xl border border-border bg-surface-muted p-4 xl:min-h-0"><span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Modelos</span><strong className="self-center text-4xl font-semibold leading-none xl:text-5xl">{result.peerCount}</strong><span className="text-center text-[0.6875rem] text-text-muted">no raio de ±{radius}%</span></div>
   </div>
   <SellerModelRadar categories={result.categories}/>
   <div className="ui-surface !p-4"><h2 className="text-base font-semibold">Notas por categoria</h2><div className="mt-3 grid grid-cols-2 gap-x-6">{result.categories.map(c=><div className="flex items-center justify-between gap-3 border-b border-border py-2" key={c.key}><span className="text-xs text-text-secondary">{c.label}</span><span className="text-sm font-semibold">{score(c.score)}</span></div>)}</div><p className="mt-3 text-[0.6875rem] leading-4 text-text-muted">10 = maior valor observado na categoria dentro do raio. Espaço + Carga usa dimensões físicas.</p></div>
  </div>
 </section>}
</div></main>}
