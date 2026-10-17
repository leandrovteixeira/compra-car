import Link from 'next/link';
import { requireRole } from '@/auth/authorization';
import { loadCurrentModelCards } from '@/server/public-model-catalog';

export default async function ViewModelCardsPage(){
  await requireRole('admin');
  const cards=await loadCurrentModelCards();
  return <section className="min-h-[calc(100dvh-6rem)]">
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-[#1A1D21]">Ver Ficha Técnica</h1>
      <p className="mt-1 text-sm text-[#61747B]">Escolha a marca e o modelo para consultar as versões atuais.</p>
    </header>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(card=><Link key={card.brand+'|'+card.model}
        href={`/admin/ver-ficha-tecnica/modelo?brand=${encodeURIComponent(card.brand)}&model=${encodeURIComponent(card.model)}`}
        className="group relative flex aspect-[1.7] flex-col justify-end overflow-hidden rounded-xl border border-[#D6DEE3] bg-[#1A1D21] p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
          {card.brand.toLocaleLowerCase('pt-BR') === 'byd' && card.model.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'') === 'atto2' && (
            <img src="https://shfsjyjxmgwnlexmdkcs.supabase.co/storage/v1/object/public/vehicle-images/byd_atto2.webp"
              alt="BYD Atto 2" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1D21]/95 via-[#1A1D21]/30 to-transparent"/>
          <div className="relative">
            <p className="text-xs uppercase tracking-widest text-[#9ABCC8]">{card.brand}</p>
            <h2 className="mt-2 text-3xl font-semibold">{card.model}</h2>
            <p className="mt-2 text-xs text-white/75">{card.versions.length} {card.versions.length===1?'versão atual':'versões atuais'}</p>
          </div>
        </Link>)}
    </div>
    {!cards.length&&<p className="mt-8 text-sm text-[#61747B]">Não encontramos versões públicas atuais.</p>}
  </section>;
}
