import Link from 'next/link';

import { SellerModelPicker } from '@/components/seller-model-picker';
import { SellerModelRadar } from '@/components/seller-model-radar';
import { loadSellerModelScore, type SellerScoreRadius } from '@/server/seller-model-score-service';

interface SellerModelPageProps {
  readonly searchParams: Promise<{
    readonly product?: string | readonly string[];
    readonly radius?: string | readonly string[];
  }>;
}

function first(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseRadius(value: string | readonly string[] | undefined): SellerScoreRadius {
  const parsed = Number(first(value));
  return parsed === 3 || parsed === 10 ? parsed : 5;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatScore(value: number | null) {
  return value === null ? 'N/D' : value.toFixed(1).replace('.', ',');
}

export default async function SellerModelPage({ searchParams }: SellerModelPageProps) {
  const params = await searchParams;
  const radius = parseRadius(params.radius);
  const rawProduct = Number(first(params.product));
  const productId = Number.isSafeInteger(rawProduct) && rawProduct > 0 ? rawProduct : null;
  const result = await loadSellerModelScore(productId, radius);

  return (
    <main className="min-h-[calc(100dvh-var(--app-topbar-height))] bg-background px-3 py-5 text-text-primary sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto w-full max-w-[100rem]">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-interactive">Vendedor</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Ver modelo</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Entenda o valor percebido do modelo contra veículos de preço semelhante.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <SellerModelPicker options={result.options} radius={radius} />

          <section className="min-w-0">
            {!result.selected ? (
              <div className="ui-surface flex min-h-64 items-center justify-center text-center">
                <div>
                  <h2 className="text-lg font-semibold">Escolha um modelo</h2>
                  <p className="mt-1 text-sm text-text-muted">Use a busca para abrir o score e o radar do veículo.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="ui-surface">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{result.selected.label}</h2>
                      <p className="mt-1 text-sm text-text-muted">MSRP vigente: {formatMoney(result.selected.price)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-xs font-semibold text-text-muted">Raio de preço</span>
                      {[3, 5, 10].map((value) => (
                        <Link
                          className={`ui-button ui-button--compact ${radius === value ? 'ui-button--primary' : 'ui-button--secondary'}`}
                          href={`/ver-modelo?product=${result.selected!.id}&radius=${value}`}
                          key={value}
                        >
                          ±{value}%
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Score geral</p>
                      <p className="mt-1 text-3xl font-semibold">{formatScore(result.overallScore)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Raio</p>
                      <p className="mt-1 text-3xl font-semibold">±{radius}%</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Mercado comparável</p>
                      <p className="mt-1 text-3xl font-semibold">{result.peerCount}</p>
                      <p className="mt-0.5 text-xs text-text-muted">modelos no raio de pesquisa</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
                  <SellerModelRadar categories={result.categories} />
                  <div className="ui-surface">
                    <h2 className="text-base font-semibold">Notas por categoria</h2>
                    <div className="mt-3 divide-y divide-border">
                      {result.categories.map((category) => (
                        <div className="flex items-center justify-between gap-4 py-2.5" key={category.key}>
                          <span className="text-sm text-text-secondary">{category.label}</span>
                          <span className="text-base font-semibold">{formatScore(category.score)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-text-muted">
                      Nota 10 representa o maior valor observado na categoria entre os modelos dentro do raio selecionado. Espaço + Carga usa dimensões físicas.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
