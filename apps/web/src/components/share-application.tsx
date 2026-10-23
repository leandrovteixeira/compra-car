'use client';

import { useState } from 'react';

/** Shares the origin only: never sends the current route, query or user tokens. */
export function ShareApplication() {
  const [feedback, setFeedback] = useState('');
  const share = async () => {
    const url = window.location.origin + '/';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Compra Car', url });
        setFeedback('');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback('Link copiado');
      } else {
        setFeedback('Copie o endereço da página inicial para compartilhar.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback('Não foi possível compartilhar. Tente novamente.');
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label="Compartilhar aplicativo"
        title="Compartilhar aplicativo"
        onClick={share}
        className="ui-button ui-button--ghost ui-button--compact"
      >
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
          <path d="M18 8a3 3 0 1 0-2.75-4.2L8.7 8.35a3 3 0 1 0 0 7.3l6.55 4.55A3 3 0 1 0 16.4 18.6L9.9 14.1a3.1 3.1 0 0 0 0-4.2l6.5-4.5A3 3 0 0 0 18 8Z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </button>
      {feedback ? <span role="status" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">{feedback}</span> : null}
    </div>
  );
}
