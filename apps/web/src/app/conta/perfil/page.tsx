import { requireActiveProfile } from '@/auth/authorization';
import { createReadOnlyServerClient } from '@/auth/server-client';
import { updateContactProfile } from '../actions';

export default async function MyProfilePage() {
  const { user, profile } = await requireActiveProfile();
  const db = await createReadOnlyServerClient();
  const { data, error } = await db.from('profiles').select('phone,company,job_title').eq('id', user.id).single();
  if (error) throw new Error('Não foi possível carregar o perfil.');
  return <main className="mx-auto max-w-2xl px-5 py-8 text-text-primary">
    <h1 className="text-2xl font-semibold">Meu perfil</h1>
    <p className="mt-2 text-sm text-text-secondary">Dados pessoais e profissionais da conta.</p>
    <form action={updateContactProfile} className="mt-7 space-y-5 rounded-xl border border-border bg-surface p-6">
      <p className="text-sm">Nome completo: <strong>{profile.fullName || 'Não informado'}</strong></p>
      <p className="text-sm">Email: <strong>{user.email}</strong></p>
      <label className="block text-sm">Telefone / WhatsApp<input className="ui-field mt-2 w-full" name="phone" type="tel" maxLength={40} defaultValue={data.phone ?? ''} /></label>
      <label className="block text-sm">Empresa<input className="ui-field mt-2 w-full" name="company" maxLength={160} defaultValue={data.company ?? ''} /></label>
      <label className="block text-sm">Cargo / Função<input className="ui-field mt-2 w-full" name="jobTitle" maxLength={120} defaultValue={data.job_title ?? ''} /></label>
      <button type="submit" className="rounded-lg bg-[#EF7732] px-6 py-3 text-white">Salvar alterações</button>
    </form>
  </main>;
}
