'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { updateAdminProductStatusAction } from '@/app/admin/products/actions';

interface AdminProductStatusToggleProps {
  readonly productId: string;
  readonly productName: string;
  readonly field: 'isActive' | 'isPublic';
  readonly value: boolean;
  readonly isActive: boolean;
}

export function AdminProductStatusToggle({
  productId,
  productName,
  field,
  value,
  isActive,
}: AdminProductStatusToggleProps) {
  const router = useRouter();
  const errorId = useId();
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const publicationBlocked = field === 'isPublic' && !isActive;
  const publicationHelp = 'Ative o veículo antes de publicá-lo.';
  const label =
    field === 'isActive' ? (value ? 'Ativo' : 'Inativo') : value ? 'Público' : 'Privado';
  const target =
    field === 'isActive' ? (value ? 'inativo' : 'ativo') : value ? 'privado' : 'público';

  function toggle() {
    if (submitting.current || pending || publicationBlocked) return;
    submitting.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const patch = field === 'isActive' ? { isActive: !value } : { isPublic: !value };
        const result = await updateAdminProductStatusAction(productId, patch);
        if (result.status === 'error') {
          setError(result.message);
          return;
        }
        router.refresh();
      } catch {
        setError('Não foi possível salvar o status. Tente novamente.');
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={`ui-badge cursor-pointer transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60 ${
          value
            ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
            : 'border-border bg-surface-muted text-text-muted'
        }`}
        onClick={toggle}
        disabled={pending || publicationBlocked}
        title={publicationBlocked ? publicationHelp : undefined}
        aria-busy={pending}
        aria-pressed={value}
        aria-label={
          publicationBlocked
            ? `${productName}: ${publicationHelp}`
            : `Marcar ${productName} como ${target}`
        }
        aria-describedby={error ? errorId : undefined}
      >
        {label}
      </button>
      {error ? (
        <span id={errorId} role="alert" className="block text-xs text-red-400">
          {error}
        </span>
      ) : null}
    </>
  );
}
