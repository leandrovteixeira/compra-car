import {
  formatAdministrativeVehicleName,
  type CommercialProductResolution,
} from '@compra-car/core';
import type { StructuredPoliciesResult } from '@/application/admin/structured-policies';

type Resolution = Extract<StructuredPoliciesResult, { status: 'STRUCTURALLY_VALID' }>['resolution'];

function CatalogMatch({ product }: { readonly product: CommercialProductResolution }) {
  if (product.status === 'MATCHED')
    return (
      <>
        <p>{formatAdministrativeVehicleName(product.matchedProduct)}</p>
        <p className="text-xs text-text-muted">ID {product.resolvedProductId}</p>
      </>
    );
  if (product.status === 'AMBIGUOUS')
    return (
      <details>
        <summary className="cursor-pointer">{product.candidates.length} candidatos</summary>
        <ul className="space-y-2 pt-2">
          {product.candidates.map((candidate) => (
            <li key={candidate.id}>
              {formatAdministrativeVehicleName(candidate)}{' '}
              <span className="text-xs text-text-muted">· ID {candidate.id}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  return <span className="text-text-muted">—</span>;
}

export function CommercialProductResolutionPreview({
  resolution,
}: {
  readonly resolution: Resolution;
}) {
  if (resolution.status === 'PRODUCT_RESOLUTION_FAILED')
    return (
      <section aria-label="Resolução de produtos" className="space-y-2">
        <h2 className="font-semibold">Resolução de produtos</h2>
        <p role="alert" className="text-sm">
          {resolution.message}
        </p>
        <code className="text-xs">PRODUCT_RESOLUTION_FAILED</code>
      </section>
    );
  const attention = resolution.products.length - resolution.counts.MATCHED;
  return (
    <section aria-label="Resolução de produtos" className="space-y-3">
      <h2 className="font-semibold">Resolução de produtos</h2>
      <p className="text-sm">
        {attention} precisam de atenção · <code>{resolution.status}</code>
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Contagens de resolução">
        {Object.entries(resolution.counts).map(([status, count]) => (
          <li key={status}>
            <strong>{count}</strong> {status}
          </li>
        ))}
      </ul>
      <div className="max-h-96 overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-muted">
            <tr>
              {[
                'Marca',
                'Modelo',
                'Versão',
                'PY/MY',
                'MVS/código',
                'Confidence',
                'Resolução',
                'Product Compra-Car',
              ].map((label) => (
                <th key={label} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resolution.products.map((product, index) => {
              const source = product.source;
              return (
                <tr key={product.productExternalKey ?? index} className="align-top">
                  {[
                    source.brand,
                    source.model,
                    source.version,
                    source.productionYear === null || source.modelYear === null
                      ? 'PY/MY pendente'
                      : `${source.productionYear}/${source.modelYear}`,
                    source.sourceMvs ?? '—',
                    [source.confidenceStatus, source.confidenceScore]
                      .filter((value) => value !== null)
                      .join(' · ') || 'Não informado',
                  ].map((value, column) => (
                    <td key={column} className="px-3 py-2">
                      {value}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <p
                      className={`font-semibold ${product.status === 'MATCHED' ? 'text-green-700' : 'text-amber-800'}`}
                    >
                      {product.status}
                    </p>
                    <code className="text-xs break-words text-text-muted">
                      {product.reasonCode}
                    </code>
                    <p className="text-xs text-text-muted">{product.productExternalKey}</p>
                  </td>
                  <td className="min-w-56 px-3 py-2">
                    <CatalogMatch product={product} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
