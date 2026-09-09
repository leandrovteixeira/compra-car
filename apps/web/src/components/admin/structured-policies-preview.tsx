import type { StructuredPoliciesResult } from '@/application/admin/structured-policies';

export function StructuredPoliciesPreview({
  result,
}: {
  readonly result: StructuredPoliciesResult;
}) {
  if ('message' in result)
    return (
      <p role="alert" className="rounded-md border border-border p-3 text-sm">
        {result.message}
      </p>
    );
  if (result.status !== 'STRUCTURALLY_VALID')
    return (
      <section className="space-y-3" aria-label="Diagnósticos estruturais">
        <h2 className="text-lg font-semibold">Estrutura inválida</h2>
        <p>
          {result.diagnostics.length} problemas encontrados ·{' '}
          {result.status === 'PARSER_FAILURE' ? 'Falha no parsing' : 'Validação estrutural'}
        </p>
        <ul className="divide-y divide-border rounded-md border border-border">
          {result.diagnostics.map((diagnostic, index) => (
            <li key={index} className="space-y-1 p-3 text-sm break-words">
              <span className="font-semibold text-red-700">Erro</span> ·{' '}
              <code>{diagnostic.code}</code>
              <p className="text-text-secondary">
                {[
                  diagnostic.sheet,
                  diagnostic.row !== undefined ? `linha ${diagnostic.row}` : null,
                  diagnostic.column,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p>{diagnostic.message}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  const { contract, filename } = result;
  const { metadata } = contract;
  const counts = [
    ['Produtos', contract.products.length],
    ['Políticas', contract.policies.length],
    ['Ofertas', contract.offers.length],
    ['Issues', contract.issues.length],
    ['Evidências', contract.evidence.length],
  ] as const;
  const fields = [
    ['Arquivo', filename],
    ['Contrato', metadata.contractVersion],
    ['issuer_brand', metadata.issuerBrand],
    ['competence', metadata.competence],
    ['valid_from', metadata.validFrom],
    ['valid_to', metadata.validTo],
    ['prompt_version', metadata.promptVersion],
    ['handbook_version', metadata.handbookVersion],
  ] as const;
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">
          {metadata.issuerBrand} · {metadata.competence}
        </h2>
        <p className="text-sm font-semibold text-green-700">
          Estrutura válida ✓ · STRUCTURALLY_VALID
        </p>
        <p className="text-sm text-text-secondary">
          A estrutura do arquivo é válida. A resolução dos produtos será executada na próxima etapa.
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-text-muted">{label}</dt>
              <dd className="break-words">{value ?? 'Não informado'}</dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
          {counts.map(([label, count]) => (
            <li key={label}>
              <strong>{count}</strong> {label}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Produtos documentais">
        <h2 className="mb-2 font-semibold">Produtos do arquivo</h2>
        <div className="max-h-96 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-muted">
              <tr>
                {['Marca', 'Modelo', 'Versão', 'PY/MY', 'Confidence', 'Status documental'].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-3 py-2 font-semibold whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contract.products.map((product, index) => (
                <tr key={product.productExternalKey ?? index}>
                  {[
                    product.brand,
                    product.model,
                    product.version,
                    product.productionYear === null || product.modelYear === null
                      ? 'PY/MY pendente'
                      : `${product.productionYear}/${product.modelYear}`,
                    [product.confidenceStatus, product.confidenceScore]
                      .filter((value) => value !== null)
                      .join(' · ') || 'Não informado',
                    'Aguardando resolução',
                  ].map((value, column) => (
                    <td key={column} className="px-3 py-2">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Issues da extração" className="space-y-2">
        <h2 className="font-semibold">Issues da extração · {contract.issues.length}</h2>
        <p className="text-sm text-text-secondary">
          Issues comerciais do arquivo, separados dos diagnósticos estruturais. Decisões do operador
          ainda não disponíveis.
        </p>
        <ul className="max-h-80 overflow-auto divide-y divide-border">
          {contract.issues.map((issue, index) => (
            <li key={issue.issueExternalKey ?? index} className="py-2 text-sm break-words">
              <code>{issue.reasonCode}</code> · <span>{issue.severity}</span>
              <p>{issue.explanation}</p>
              <p className="text-text-muted">
                {issue.entityType} · {issue.entityKey}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-text-secondary">
        Evidências: {contract.evidence.length}. Políticas e ofertas disponíveis somente como
        contagens nesta etapa.
      </p>
    </div>
  );
}
