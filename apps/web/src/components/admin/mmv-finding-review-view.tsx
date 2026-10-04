import type { AgentFindingDetail, AgentJson, AgentObject } from '@compra-car/core/agent-platform';

function object(value: AgentJson | undefined): AgentObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as AgentObject)
    : null;
}

function objects(value: AgentJson | undefined): readonly AgentObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is AgentObject => item !== null && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

function text(value: AgentJson | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function technicalLine(identity: AgentObject): string {
  const values = [
    text(identity.propulsion),
    typeof identity.engineDisplacement === 'number'
      ? identity.engineDisplacement.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' L'
      : null,
    text(identity.powertrainLabel),
    text(identity.transmission),
    text(identity.drivetrain),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(values)].join(' · ');
}

export function MmvFindingReviewView({ detail }: { readonly detail: AgentFindingDetail }) {
  const { finding } = detail;
  const proposal = object(finding.proposal ?? undefined);
  const identities = proposal ? objects(proposal.identities) : [];
  const canonical = objects(finding.subject.canonicalMmv);
  const structured = object(finding.payload.structuredCandidate);
  const resolved = objects(finding.payload.resolvedVariants);
  const proposed = identities.length ? identities : resolved;
  const marketReconciliation = objects(finding.payload.marketReconciliation);
  const model = text(finding.subject.model) ?? text(structured?.model) ?? 'Modelo';
  const brand = text(finding.subject.brand) ?? text(structured?.brand) ?? '';
  const version = text(finding.subject.officialVersionLabel) ?? text(structured?.officialVersionLabel);

  const headline =
    finding.findingType === 'NEW_MODEL'
      ? 'O agente encontrou um modelo que ainda não existe no catálogo.'
      : finding.findingType === 'NEW_VERSION'
        ? 'O agente encontrou uma versão comercial que ainda não foi reconciliada com o catálogo.'
        : finding.findingType === 'AMBIGUOUS_MMV'
          ? 'O agente encontrou uma identidade que precisa de decisão humana.'
          : 'O agente encontrou correspondência com uma identidade já conhecida.';

  return (
    <section className="ui-form-section space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Resumo para decisão</h2>
        <p className="mt-1 text-sm text-text-secondary">{headline}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="ui-surface p-3">
          <p className="text-xs text-text-muted">Identidade observada</p>
          <p className="font-medium">{[brand, model, version].filter(Boolean).join(' ')}</p>
        </div>
        <div className="ui-surface p-3">
          <p className="text-xs text-text-muted">Match com catálogo</p>
          {canonical.length ? (
            <ul className="mt-1 space-y-1">
              {canonical.map((item, index) => (
                <li key={index} className="font-medium">
                  {[text(item.brand), text(item.model), text(item.canonicalVersionLabel)]
                    .filter(Boolean)
                    .join(' ')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-medium">Nenhum MMV compatível encontrado.</p>
          )}
        </div>
      </div>

      {proposed.length ? (
        <div>
          <h3 className="font-semibold">
            {finding.findingType === 'NEW_MODEL' ? 'MMVs encontrados' : 'MMV proposto'}
          </h3>
          <div className="mt-2 grid gap-2">
            {proposed.map((identity, index) => {
              const label =
                text(identity.officialVersionLabel) ??
                text(identity.trim) ??
                text(identity.model) ??
                'Identidade sem rótulo';
              const technical = technicalLine(identity);
              return (
                <div key={index} className="ui-surface p-3">
                  <p className="font-medium">{label}</p>
                  {technical ? <p className="text-sm text-text-secondary">{technical}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {marketReconciliation.length ? (
        <div>
          <h3 className="font-semibold">FIPE / mercado</h3>
          <div className="mt-2 grid gap-2">
            {marketReconciliation.map((item, index) => {
              const manufacturerVersionLabel =
                text(item.manufacturerVersionLabel) ?? 'Versão não identificada';
              const observations = objects(item.observations);
              return (
                <div key={index} className="ui-surface p-3">
                  <p className="font-medium">{manufacturerVersionLabel}</p>
                  {!observations.length ? (
                    <p className="text-sm text-text-secondary">
                      Nenhum código FIPE explícito encontrado.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {observations.map((observation, observationIndex) => {
                        const official = text(observation.sourceKind) === 'FIPE';
                        return (
                          <li key={observationIndex}>
                            <strong>{text(observation.fipeCode) ?? '—'}</strong>
                            {' · '}
                            {text(observation.modelLabel) ?? 'Rótulo não informado'}
                            {' · '}
                            {official ? 'FIPE oficial' : 'candidato via mercado'}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <details className="ui-surface p-3">
        <summary className="cursor-pointer font-medium">Ver detalhes técnicos / JSON</summary>
        <div className="mt-3 grid gap-3">
          <pre className="overflow-auto whitespace-pre-wrap break-words text-xs">
            {JSON.stringify({ subject: finding.subject, proposal: finding.proposal, payload: finding.payload }, null, 2)}
          </pre>
        </div>
      </details>
    </section>
  );
}
