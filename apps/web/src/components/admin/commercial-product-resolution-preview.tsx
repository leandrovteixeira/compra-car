'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonClassName } from '@compra-car/ui';
import {
  formatAdministrativeVehicleName,
  confirmOperatorProduct,
  effectiveCommercialResolution,
  initialOperatorCandidates,
  type AdministrativeVehicle,
  type CommercialOperatorDecisions,
  type EffectiveCommercialProductResolution,
} from '@compra-car/core';
import type { StructuredPoliciesResult } from '@/application/admin/structured-policies';
import type { OperatorCatalogResult } from '@/server/commercial-operator-catalog';
import { loadOperatorMatchingCatalog } from '@/app/admin/imports/structured-policies/actions';
import { AdminProductCombobox } from './admin-product-combobox';

type Resolution = Extract<StructuredPoliciesResult, { status: 'STRUCTURALLY_VALID' }>['resolution'];

function CatalogMatch({ product }: { readonly product: EffectiveCommercialProductResolution }) {
  if (product.status === 'MATCHED' || product.status === 'OPERATOR_MATCHED')
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
  initialCatalog,
  loadCatalog = loadOperatorMatchingCatalog,
}: {
  readonly resolution: Resolution;
  readonly initialCatalog: readonly AdministrativeVehicle[];
  readonly loadCatalog?: () => Promise<OperatorCatalogResult>;
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
  return (
    <OperatorResolutionTable
      resolution={resolution}
      initialCatalog={initialCatalog}
      loadCatalog={loadCatalog}
    />
  );
}

function OperatorResolutionTable({
  resolution,
  initialCatalog,
  loadCatalog,
}: {
  readonly resolution: Exclude<Resolution, { status: 'PRODUCT_RESOLUTION_FAILED' }>;
  readonly initialCatalog: readonly AdministrativeVehicle[];
  readonly loadCatalog: () => Promise<OperatorCatalogResult>;
}) {
  const [decisions, setDecisions] = useState<CommercialOperatorDecisions>({});
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [lastIndex, setLastIndex] = useState(-1);
  const [fullCatalog, setFullCatalog] = useState<readonly AdministrativeVehicle[] | null>(null);
  const [useFullCatalog, setUseFullCatalog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef<Promise<OperatorCatalogResult> | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const summary = useMemo(
    () => effectiveCommercialResolution(resolution.products, decisions),
    [resolution.products, decisions],
  );
  const activeProduct = activeIndex === null ? undefined : resolution.products[activeIndex];
  const candidates = useMemo(
    () =>
      !activeProduct
        ? []
        : useFullCatalog
          ? (fullCatalog ?? [])
          : initialOperatorCandidates(activeProduct, initialCatalog),
    [activeProduct, useFullCatalog, fullCatalog, initialCatalog],
  );
  const options = useMemo(
    () =>
      candidates.map((product) => ({
        id: product.id,
        displayName: `${formatAdministrativeVehicleName(product)} · ID ${product.id}`,
        isActive: product.isActive,
        isPublic: product.isPublic,
      })),
    [candidates],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    editor.current?.scrollIntoView({ block: 'nearest' });
    editor.current?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
  }, [activeIndex, useFullCatalog]);

  function open(index: number) {
    setActiveIndex(index);
    setLastIndex(index);
    setUseFullCatalog(false);
    setError('');
  }
  function nextPending() {
    for (let offset = 1; offset <= summary.products.length; offset++) {
      const index = (lastIndex + offset) % summary.products.length;
      const product = summary.products[index];
      if (product && product.status !== 'MATCHED' && product.status !== 'OPERATOR_MATCHED') {
        open(index);
        return;
      }
    }
  }
  async function browseCatalog() {
    setUseFullCatalog(true);
    setError('');
    if (fullCatalog) return;
    setLoading(true);
    try {
      inFlight.current ??= loadCatalog();
      const result = await inFlight.current;
      if (result.ok) setFullCatalog(result.products);
      else setError(result.message);
    } catch {
      setError('Não foi possível carregar o catálogo. Tente novamente.');
    } finally {
      setLoading(false);
      inFlight.current = null;
    }
  }
  function choose(id: string) {
    if (!id || !activeProduct) return;
    try {
      const decision = confirmOperatorProduct(activeProduct, id, candidates);
      setDecisions((current) => ({ ...current, [decision.productExternalKey]: decision }));
      setActiveIndex(null);
      setError('');
    } catch {
      setError('Selecione um Product válido da lista.');
    }
  }
  return (
    <section aria-label="Resolução de produtos" className="space-y-3">
      <h2 className="font-semibold">Resolução de produtos</h2>
      <p className="text-sm" role="status">
        {summary.counts.PENDING === 0
          ? `Produtos resolvidos · ${summary.products.length} / ${summary.products.length}`
          : `${summary.counts.PENDING} precisam de atenção`}{' '}
        · <code>{summary.status}</code>
      </p>
      {summary.counts.PENDING === 0 && (
        <p className="text-sm text-text-secondary">
          Todos os produtos foram associados. A importação está pronta para a validação final antes
          da publicação.
        </p>
      )}
      <p className="text-xs text-text-muted">
        As escolhas valem somente para este preview. Remover, substituir ou revalidar o arquivo
        descarta as associações.
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Contagens de resolução">
        <li>
          <strong>{summary.products.length}</strong> Total Products
        </li>
        {Object.entries(summary.counts).map(([status, count]) => (
          <li key={status}>
            <strong>{count}</strong> {status}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!summary.counts.PENDING}
        onClick={nextPending}
        className={buttonClassName({ size: 'action', variant: 'secondary' })}
      >
        Próximo pendente
      </button>
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
            {summary.products.map((product, index) => {
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
                      className={`font-semibold ${product.status === 'MATCHED' || product.status === 'OPERATOR_MATCHED' ? 'text-green-700' : 'text-amber-800'}`}
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
                    {product.status !== 'MATCHED' && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => open(index)}
                            className={buttonClassName({ size: 'micro', variant: 'secondary' })}
                          >
                            {product.status === 'OPERATOR_MATCHED'
                              ? 'Trocar associação'
                              : 'Resolver'}
                          </button>
                          {product.status === 'OPERATOR_MATCHED' && (
                            <button
                              type="button"
                              className={buttonClassName({ size: 'micro', variant: 'ghost' })}
                              onClick={() => {
                                setDecisions((current) => {
                                  const next = { ...current };
                                  delete next[product.productExternalKey];
                                  return next;
                                });
                                setActiveIndex(null);
                              }}
                            >
                              Desfazer
                            </button>
                          )}
                        </div>
                        {activeIndex === index && (
                          <div
                            ref={editor}
                            className="min-w-72 space-y-2"
                            aria-label="Escolha de Product"
                          >
                            <p className="text-xs text-text-secondary">
                              {useFullCatalog
                                ? 'Catálogo completo'
                                : `${candidates.length} candidatos iniciais`}
                              . Escolha explícita do operador.
                            </p>
                            <AdminProductCombobox
                              label={`Associar ${source.model} ${source.version} ${source.productionYear ?? '—'}/${source.modelYear ?? '—'}`}
                              options={options}
                              value=""
                              onChange={choose}
                              disabled={loading}
                            />
                            {loading && (
                              <p role="status" className="text-xs">
                                Carregando catálogo…
                              </p>
                            )}
                            {error && (
                              <p role="alert" className="text-xs text-red-700">
                                {error}
                              </p>
                            )}
                            {!useFullCatalog || error ? (
                              <button
                                type="button"
                                disabled={loading}
                                className={buttonClassName({ size: 'micro', variant: 'secondary' })}
                                onClick={() => void browseCatalog()}
                              >
                                {error ? 'Tentar novamente' : 'Buscar no catálogo completo'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={buttonClassName({ size: 'micro', variant: 'ghost' })}
                                onClick={() => setUseFullCatalog(false)}
                              >
                                Candidatos iniciais
                              </button>
                            )}
                            <button
                              type="button"
                              className={buttonClassName({ size: 'micro', variant: 'ghost' })}
                              onClick={() => setActiveIndex(null)}
                            >
                              Fechar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
