import { redirect } from 'next/navigation';
import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';

export default async function MyPlanPage() {
  const tier = await getAccountTier();
  if (tier === 'visitor') redirect('/login');
  if (tier === 'admin' || tier === 'master') redirect('/conta/perfil');
  const corporate = tier === 'corporate';
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 text-text-primary">
      <h1 className="text-2xl font-semibold">Meu plano</h1>
      <section className="mt-7 rounded-xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#EF7732]">{corporate ? 'Corporate' : 'Public'}</p>
        <h2 className="mt-2 text-xl font-semibold">{corporate ? 'Acesso profissional' : 'Conta gratuita'}</h2>
        <p className="mt-3 text-sm text-text-secondary">Fichas técnicas e comparações de até {comparisonLimit(tier)} veículos.</p>
        <p className="mt-2 text-sm text-text-secondary">Exportar PDF e compartilhar comparações.</p>
        {corporate ? <p className="mt-2 text-sm text-text-secondary">Acesso à Lista de Preços, sujeito à disponibilidade.</p> : <a href="/conta/upgrade" className="mt-6 inline-flex rounded-lg bg-[#EF7732] px-5 py-3 font-semibold text-white">Upgrade de conta</a>}
      </section>
    </main>
  );
}
