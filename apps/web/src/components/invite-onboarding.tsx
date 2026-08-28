'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { PasswordLifecycleState } from '@/application/auth/password-lifecycle';
import { APP_NAME } from '@/config/app-identity';

import { AuthPasswordForm } from './auth-password-form';
import { AuthShell } from './auth-shell';
import { PostInviteInstallStep } from './post-invite-install-step';
import { usePwaInstall } from './use-pwa-install';

interface InviteCompletion {
  readonly destination: string;
  readonly newlyCompleted: boolean;
}

export function InviteOnboarding({
  action,
}: {
  readonly action: (
    state: PasswordLifecycleState,
    data: FormData,
  ) => Promise<PasswordLifecycleState>;
}) {
  const router = useRouter();
  const { availability, requestNativeInstall } = usePwaInstall();
  const [completion, setCompletion] = useState<InviteCompletion | null>(null);

  const continueToApp = useCallback(() => {
    if (completion) router.replace(completion.destination);
  }, [completion, router]);

  useEffect(() => {
    if (
      completion &&
      (!completion.newlyCompleted || availability === 'installed' || availability === 'unavailable')
    ) {
      router.replace(completion.destination);
    }
  }, [availability, completion, router]);

  if (!completion) {
    return (
      <AuthShell
        title="Defina sua senha"
        description={`Crie uma senha para concluir seu acesso ao ${APP_NAME}.`}
      >
        <AuthPasswordForm
          action={action}
          mode="invite"
          onSuccess={({ destination, message }) =>
            setCompletion({
              destination,
              newlyCompleted: message === 'Cadastro concluído.',
            })
          }
        />
      </AuthShell>
    );
  }

  if (
    !completion.newlyCompleted ||
    availability === 'checking' ||
    availability === 'installed' ||
    availability === 'unavailable'
  ) {
    return (
      <AuthShell title="Tudo pronto!">
        <p className="mt-5 text-sm text-text-secondary" role="status">
          Abrindo {APP_NAME}…
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Tudo pronto!">
      <PostInviteInstallStep
        key={availability}
        availability={availability}
        continueToApp={continueToApp}
        requestNativeInstall={requestNativeInstall}
      />
    </AuthShell>
  );
}
