import type { SellerCategoryScore } from '@/server/seller-model-score-service';

export interface RadarVehicle {
  readonly id: number;
  readonly label: string;
  readonly price: number;
  readonly overallScore: number | null;
  readonly categories: readonly SellerCategoryScore[];
}

const COLORS = ['#1A1D21', '#EF7732', '#357B97', '#7E65A6', '#44917B', '#C05268', '#A98725', '#697786'];
const point = (i: number, n: number, value: number, radius = 118) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / n;
  return [170 + Math.cos(a) * radius * value, 170 + Math.sin(a) * radius * value] as const;
};
const formatScore = (value: number | null) => value === null ? 'N/D' : value.toFixed(1).replace('.', ',');
export function MultiModelRadar({ vehicles }: { readonly vehicles: readonly RadarVehicle[] }) {
  const categories = vehicles[0]?.categories ?? [];
  if (!categories.length) return null;
  return <section className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(23rem,1fr)]">
    <div className="ui-surface min-w-0 !p-4">
      <h2 className="text-base font-semibold">Radar de pontuação canônica</h2>
      <p className="mt-1 text-xs text-text-muted">Referência: melhor valor encontrado entre todos os modelos elegíveis do catálogo, independente do preço.</p>
      <svg role="img" aria-label="Comparativo radar das dez categorias" className="mx-auto mt-2 block h-auto w-full max-w-[42rem]" viewBox="0 0 340 340">
        {[.25,.5,.75,1].map(level=><polygon key={level} fill="none" stroke="#D6DEE3" points={categories.map((_,i)=>point(i,categories.length,level).join(',')).join(' ')}/>)}
        {categories.map((c,i)=>{const [x,y]=point(i,categories.length,1);return <line key={c.key} x1={170} y1={170} x2={x} y2={y} stroke="#D6DEE3"/>;})}
        {vehicles.map((v,i)=><polygon key={v.id} points={categories.map((c,j)=>point(j,categories.length,Math.max(0,Math.min(1,(v.categories.find(t=>t.key===c.key)?.score??0)/10))).join(',')).join(' ')} stroke={COLORS[i%COLORS.length]} fill={COLORS[i%COLORS.length]} fillOpacity=".10" strokeWidth="2.5"/>)}
        {categories.map((c,i)=>{const [x,y]=point(i,categories.length,1.15);return <text key={c.key} x={x} y={y} textAnchor={x<160?'end':x>180?'start':'middle'} dominantBaseline="middle" fontSize="7.5" fill="#526670" fontWeight="600">{c.label}</text>;})}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-2">{vehicles.map((v,i)=><div key={v.id} className="flex items-center gap-2 text-xs"><span className="size-3 rounded-sm" style={{backgroundColor:COLORS[i%COLORS.length]}}/>{v.label}</div>)}</div>
    </div>
    <div className="ui-surface min-w-0 !p-4">
      <h2 className="text-base font-semibold">Notas por dimensão</h2>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border"><th className="p-2 text-left">Dimensão</th>{vehicles.map((v,i)=><th key={v.id} className="p-2 text-right" title={v.label}><span className="inline-block size-2 rounded-full" style={{backgroundColor:COLORS[i%COLORS.length]}}/> {i+1}</th>)}</tr></thead><tbody>{categories.map(c=><tr key={c.key} className="border-b border-border"><td className="p-2">{c.label}</td>{vehicles.map(v=><td key={v.id} className="p-2 text-right font-medium">{formatScore(v.categories.find(t=>t.key===c.key)?.score??null)}</td>)}</tr>)}<tr className="font-semibold"><td className="p-2">Média</td>{vehicles.map(v=><td key={v.id} className="p-2 text-right">{formatScore(v.overallScore)}</td>)}</tr></tbody></table></div>
      <p className="mt-3 text-xs text-text-muted">Notas indisponíveis não são consideradas na média. Os dez eixos usam a mesma referência global para todos os veículos.</p>
    </div>
  </section>;
}
