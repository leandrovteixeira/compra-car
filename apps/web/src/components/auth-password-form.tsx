'use client';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PasswordLifecycleState } from '@/application/auth/password-lifecycle';
export function AuthPasswordForm({
  action,
  mode,
}: {
  readonly action: (
    state: PasswordLifecycleState,
    data: FormData,
  ) => Promise<PasswordLifecycleState>;
  readonly mode: 'invite' | 'recovery';
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { status: 'idle' });
  useEffect(() => {
    if (state.status === 'success' && state.destination) router.replace(state.destination);
  }, [router, state]);
  return (
    <form action={formAction} className="mt-5 grid gap-4">
      <label className={labelClassName}>
        Nova senha
        <input
          autoComplete="new-password"
          className={`${fieldClassName} mt-1.5`}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label className={labelClassName}>
        Confirmar senha
        <input
          autoComplete="new-password"
          className={`${fieldClassName} mt-1.5`}
          minLength={8}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {state.status !== 'idle' ? (
        <p
          className={
            state.status === 'error' ? 'text-sm text-rose-300' : 'text-sm text-emerald-300'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      ) : null}
      <button className={buttonClassName()} disabled={pending}>
        {pending ? 'Salvando…' : mode === 'invite' ? 'Concluir cadastro' : 'Salvar nova senha'}
      </button>
    </form>
  );
}
