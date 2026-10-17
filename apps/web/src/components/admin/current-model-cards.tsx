'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CurrentModelCard } from '@/server/public-model-catalog';

interface Props {
  readonly cards: readonly CurrentModelCard[];
}

const imageByModel: Readonly<Record<string, string>> = {
  'byd|atto 2': 'https://shfsjyjxmgwnlexmdkcs.supabase.co/storage/v1/object/public/vehicle-images/byd_atto2.webp',
  'byd|song pro': 'https://shfsjyjxmgwnlexmdkcs.supabase.co/storage/v1/object/public/vehicle-images/bud_song_pro.webp',
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function CurrentModelCards({ cards }: Props) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => {
    const query = normalize(search);
    if (!query) return cards;
    return cards.filter((card) => normalize(card.brand + ' ' + card.model).includes(query));
  }, [cards, search]);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <label className="relative block w-full max-w-[42rem]">\n          <img src="/carboot/search.svg" alt="" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 object-contain"/>
          <span className="sr-only">Buscar marca ou modelo</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar marca ou modelo"
            placeholder="Buscar marca ou modelo..."
            className="h-11 w-full rounded-md border border-[#D6DEE3] bg-white pl-10 pr-4 text-sm text-[#1A1D21] outline-none focus:border-[#9ABCC8] focus:ring-2 focus:ring-[#9ABCC8]/30" />
        </label>
        <span className="shrink-0 text-xs text-[#61747B]" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'modelo' : 'modelos'}
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((card) => {
          const key = normalize(card.brand) + '|' + normalize(card.model);
          const photo = imageByModel[key];
          return (
            <Link key={card.brand + '|' + card.model}
              href={`/admin/ver-ficha-tecnica/modelo?brand=${encodeURIComponent(card.brand)}&model=${encodeURIComponent(card.model)}`}
              className="group relative flex aspect-[1.7] flex-col justify-end overflow-hidden rounded-xl border border-[#D6DEE3] bg-[#1A1D21] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
              {photo && <img src={photo} alt={card.brand + ' ' + card.model}
                className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1D21]/95 via-[#1A1D21]/30 to-transparent" />
              <div className="relative">
                <p className="text-xs uppercase tracking-widest text-[#9ABCC8]">{card.brand}</p>
                <h2 className="mt-2 text-3xl font-semibold text-[#EF7732]">{card.model}</h2>
                <p className="mt-2 text-xs text-white">
                  {card.versions.length} {card.versions.length === 1 ? 'versão atual' : 'versões atuais'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="rounded-lg border border-[#D6DEE3] bg-white p-8 text-center text-sm text-[#61747B]">
          Nenhum modelo corresponde à busca.
        </p>
      )}
    </>
  );
}
