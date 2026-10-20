import { redirect } from 'next/navigation';
import { getAccountTier } from '@/auth/account-tier-server';
import { requireActiveProfile } from '@/auth/authorization';
import { createReadOnlyServerClient } from '@/auth/server-client';
import { requestCorporateUpgrade } from '../actions';

export default async function UpgradeAccountPage() {
  const tier = await getAccountTier();
  if (tier === 'visitor') redirect('/login');
  if (tier !== 'public') redirect('/conta/plano');
  const { user } = await requireActiveProfile();
  const db = await createReadOnlyServerClient();
  const { data: profile } = await db.from('profiles').select('phone,company,job_title').eq('id', user.id).single();
  const { data: pending, error } = await db.from('account_upgrade_requests').select('id').eq('user_id', user.id).eq('status','pending').maybeSingle();
  if (error) throw new Error('Não foi possível carregar sua solicitação.');
  return <main className="mx-auto max-w-2xl px-5 py-8 text-text-primary">
    <h1 className="text-2xl font-semibold">Upgrade de conta</h1>
    <p className="mt-3 text-sm text-text-secondary">Solicite acesso Corporate para utilizar os recursos profissionais. O pedido não altera seu plano automaticamente.</p>
    {pending ? <p role="status" className="mt-7 rounded-xl border border-border bg-surface p-6">Sua solicitação está pendente de análise.</p> :
    <form action={requestCorporateUpgrade} className="mt-7 space-y-5 rounded-xl border border-border bg-surface p-6">
      <label className="block text-sm">Empresa *<input required minLength={2} maxLength={160} className="ui-field mt-2 w-full" name="company" defaultValue={profile?.company ?? ''} /></label>
      <label className="block text-sm">Cargo / Função *<input required minLength={2} maxLength={120} className="ui-field mt-2 w-full" name="jobTitle" defaultValue={profile?.job_title ?? ''} /></label>
      <label className="block text-sm">Telefone / WhatsApp *<input required minLength={6} maxLength={40} className="ui-field mt-2 w-full" name="phone" type="tel" defaultValue={profile?.phone ?? ''} /></label>
      <label className="block text-sm">Como pretende utilizar a plataforma?<textarea maxLength={1500} rows={3} className="ui-field mt-2 w-full" name="message" /></label>
      <button type="submit" className="rounded-lg bg-[#EF7732] px-6 py-3 text-white">Solicitar acesso Corporate</button>
    </form>}
  </main>;
}
