import { redirect } from 'next/navigation';
import { getAccountTier } from '@/auth/account-tier-server';

export default async function UpgradeAccountPage() {
  const tier = await getAccountTier();
  if (tier === 'visitor') redirect('/login');
  if (tier !== 'public') redirect('/conta/plano');
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 text-text-primary">
      <h1 className="text-2xl font-semibold">Upgrade de conta</h1>
      <p className="mt-3 text-sm text-text-secondary">O plano Corporate oferece acesso profissional e comparações de até 8 veículos. As solicitações de acesso serão disponibilizadas após a configuração do canal de atendimento.</p>
      <p className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">Nenhuma alteração de plano foi solicitada ou realizada.</p>
    </main>
  );
}
