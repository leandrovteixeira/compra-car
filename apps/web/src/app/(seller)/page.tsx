import Link from 'next/link';

import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';
import { VehicleSelection } from '@/components/vehicle-selection';

export default async function HomePage() {
  const tier = await getAccountTier();
  return (
    <>
      <section className="border-b border-border bg-surface px-5 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#EF7732]">Inteligência automotiva para todos</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Conheça, explore e compare carros com clareza.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Consulte fichas técnicas e compare equipamentos lado a lado. Comece gratuitamente, sem criar uma conta.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#comparador" className="rounded-lg bg-[#EF7732] px-5 py-3 text-sm font-semibold text-white">Comparar veículos</a>
            <Link href="/ver-modelo" className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-text-primary">Explorar fichas técnicas</Link>
          </div>
          <p className="mt-5 text-xs text-text-muted">Compare até {comparisonLimit(tier)} veículos com seu acesso atual.</p>
        </div>
      </section>
      <div id="comparador"><VehicleSelection limit={comparisonLimit(tier)} /></div>
    </>
  );
}
