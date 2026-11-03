import Link from 'next/link';
import { requireAuthenticatedUser } from '@/auth/authorization';

export default async function ChangePasswordPage() {
  await requireAuthenticatedUser();
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 text-text-primary">
      <h1 className="text-2xl font-semibold">Trocar senha</h1>
      <p className="mt-3 text-sm text-text-secondary">A alteração de senha será habilitada após a validação do fluxo seguro de reautenticação.</p>
      <Link className="mt-6 inline-flex text-sm font-semibold text-[#EF7732]" href="/forgot-password">Esqueci minha senha</Link>
    </main>
  );
}
