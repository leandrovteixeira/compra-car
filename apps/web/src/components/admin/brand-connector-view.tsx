import { validateConnectorDefinition } from '@compra-car/core/agents';
export function BrandConnectorView({ value }: { readonly value: unknown }) {
  let definition;
  try {
    definition = validateConnectorDefinition(value);
  } catch {
    return <p>Proposta inválida ou indisponível. Ativação indisponível.</p>;
  }
  return (
    <section className="space-y-4 break-words">
      <h2 className="text-lg font-semibold">Domínios propostos / permitidos</h2>
      <ul>
        {definition.allowedDomains.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <h2 className="text-lg font-semibold">Fontes oficiais</h2>
      <ul className="space-y-2">
        {definition.sourceEntries.map((e) => (
          <li key={e.type + e.url}>
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
              {e.type} — {e.url}
            </a>
            <p>
              Prioridade: {e.priority}
              {e.notes ? ' · ' + e.notes : ''}
            </p>
          </li>
        ))}
      </ul>
      {!definition.sourceEntries.length ? <p>Sem entry points registrados.</p> : null}
      <h2 className="text-lg font-semibold">Termos de busca</h2>
      <ul>
        {definition.searchHints.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <h2 className="text-lg font-semibold">Terminologia de navegação</h2>
      <p>Termos de pesquisa; não representam equivalências técnicas.</p>
      <ul>
        {definition.terminologyHints.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </section>
  );
}
