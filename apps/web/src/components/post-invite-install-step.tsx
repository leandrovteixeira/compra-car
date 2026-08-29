'use client';

import { buttonClassName } from '@compra-car/ui';
import { useState } from 'react';

import { APP_NAME } from '@/config/app-identity';

import { PwaInstallInstructions } from './pwa-install-instructions';
import type { PwaInstallAvailability } from './use-pwa-install';

export function PostInviteInstallStep({
  availability,
  continueToApp,
  requestNativeInstall,
}: {
  readonly availability: Extract<
    PwaInstallAvailability,
    'browser-manual' | 'ios-manual' | 'native'
  >;
  readonly continueToApp: () => void;
  readonly requestNativeInstall: () => Promise<'completed' | 'manual'>;
}) {
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const ios = availability === 'ios-manual';

  const install = async () => {
    if (availability !== 'native') {
      setShowManualInstructions(true);
      return;
    }

    setRequesting(true);
    const result = await requestNativeInstall();
    setRequesting(false);
    if (result === 'completed') continueToApp();
    else setShowManualInstructions(true);
  };

  return (
    <div className="mt-5 grid gap-4">
      <p className="text-text-secondary">Sua conta foi criada.</p>
      <p className="text-sm text-text-secondary">
        Quer adicionar {APP_NAME} à tela inicial para acessar mais rapidamente?
      </p>

      {showManualInstructions ? <PwaInstallInstructions ios={ios} /> : null}

      <button
        className={buttonClassName({ fullWidth: true, variant: 'interactive' })}
        disabled={requesting}
        onClick={showManualInstructions ? continueToApp : install}
        type="button"
      >
        {requesting
          ? 'Abrindo instalação…'
          : showManualInstructions
            ? 'Continuar para o aplicativo'
            : 'Adicionar à tela inicial'}
      </button>
      <button
        className="touch-target min-h-8 w-full rounded-md px-3 text-sm font-semibold text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={continueToApp}
        type="button"
      >
        Agora não
      </button>
    </div>
  );
}
