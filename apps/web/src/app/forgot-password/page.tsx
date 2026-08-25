import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Compra Car</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Esqueci minha senha</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Informe seu e-mail para receber as instruções de redefinição.
        </p>
        <ForgotPasswordForm />
        <Link className="mt-6 inline-flex text-sm font-semibold text-cyan-300" href="/login">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
