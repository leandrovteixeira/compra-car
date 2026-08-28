'use client';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PasswordLifecycleState } from '@/application/auth/password-lifecycle';
export function AuthPasswordForm({
  action,
  mode,
  onSuccess,
}: {
  readonly action: (
    state: PasswordLifecycleState,
    data: FormData,
  ) => Promise<PasswordLifecycleState>;
  readonly mode: 'invite' | 'recovery';
  readonly onSuccess?: (completion: {
    readonly destination: string;
    readonly message: string;
  }) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { status: 'idle' });
  useEffect(() => {
    if (state.status !== 'success' || !state.destination) return;
    if (onSuccess) onSuccess({ destination: state.destination, message: state.message });
    else router.replace(state.destination);
  }, [onSuccess, router, state]);
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
            state.status === 'error'
              ? 'rounded-md border border-status-error/30 bg-rose-950/10 p-2.5 text-sm text-status-error'
              : 'rounded-md border border-status-success/30 bg-emerald-950/10 p-2.5 text-sm text-status-success'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className={buttonClassName({ fullWidth: true, variant: 'interactive' })}
        disabled={pending}
      >
        {pending ? 'Salvando…' : mode === 'invite' ? 'Concluir cadastro' : 'Salvar nova senha'}
      </button>
    </form>
  );
}
