import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/forgot-password-form';
import { AuthShell } from '@/components/auth-shell';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="Informe seu e-mail para receber as instruções de redefinição."
      title="Esqueci minha senha"
    >
      <ForgotPasswordForm />
      <Link className="mt-5 inline-flex text-sm font-semibold text-interactive" href="/login">
        Voltar para o login
      </Link>
    </AuthShell>
  );
}
