'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TechnicalSheetActions({
  backHref = '/admin/ver-ficha-tecnica',
}: {
  readonly backHref?: string;
}) {
  const router = useRouter();
  const [sharing, setSharing] = useState(false);
  async function share() {
    setSharing(true);
    try {
      const url = window.location.href;
      if (navigator.share) await navigator.share({ title: document.title, url });
      else {
        await navigator.clipboard.writeText(url);
        window.alert('Link da ficha técnica copiado.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        window.alert('Não foi possível compartilhar o link.');
      }
    } finally {
      setSharing(false);
    }
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3 print:hidden">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="cc-outline-icon-action"
      >
        <img src="/carboot/back.svg" alt="" aria-hidden="true" className="size-4 object-contain" />
        Voltar aos modelos
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          title="Abrir impressão do navegador; selecione Salvar como PDF"
          className="cc-outline-icon-action"
        >
          <img
            src="/carboot/download.svg"
            alt=""
            aria-hidden="true"
            className="size-4 object-contain"
          />
          Salvar PDF
        </button>
        <button
          type="button"
          onClick={() => void share()}
          disabled={sharing}
          className="cc-outline-icon-action"
        >
          <img
            src="/carboot/share.svg"
            alt=""
            aria-hidden="true"
            className="size-4 object-contain"
          />
          {sharing ? 'Preparando…' : 'Compartilhar'}
        </button>
      </div>
    </div>
  );
}
