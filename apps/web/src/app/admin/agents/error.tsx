'use client';
export default function AgentError({ reset }: { readonly reset: () => void }) {
  return (
    <section className="ui-surface space-y-3 p-5">
      <h2 className="text-lg font-semibold">Dados dos agentes indisponíveis</h2>
      <p role="alert">Não foi possível carregar os dados. Tente novamente.</p>
      <button onClick={reset} className="ui-button ui-button--secondary">
        Tentar novamente
      </button>
    </section>
  );
}
