import { requireActiveProfile } from '@/auth/authorization';

export default async function MyProfilePage() {
  const { user, profile } = await requireActiveProfile();
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 text-text-primary">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>
      <p className="mt-2 text-sm text-text-secondary">Seus dados cadastrais no Compra Car.</p>
      <dl className="mt-7 space-y-5 rounded-xl border border-border bg-surface p-6">
        <div><dt className="text-xs text-text-muted">Nome completo</dt><dd className="mt-1 font-medium">{profile.fullName || 'Não informado'}</dd></div>
        <div><dt className="text-xs text-text-muted">Email</dt><dd className="mt-1 font-medium">{user.email || 'Não informado'}</dd></div>
        <div><dt className="text-xs text-text-muted">Telefone / WhatsApp</dt><dd className="mt-1 text-text-secondary">Ainda não cadastrado</dd></div>
        <div><dt className="text-xs text-text-muted">Empresa</dt><dd className="mt-1 text-text-secondary">Ainda não cadastrada</dd></div>
        <div><dt className="text-xs text-text-muted">Cargo</dt><dd className="mt-1 text-text-secondary">Ainda não cadastrado</dd></div>
      </dl>
      <p className="mt-4 text-sm text-text-muted">A edição de telefone, empresa e cargo será ativada após a migração dos campos cadastrais.</p>
    </main>
  );
}
