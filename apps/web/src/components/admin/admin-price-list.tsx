'use client';

import type { ProductPublicPriceListPageDto, PricingWorkflowStatus } from '@compra-car/contracts';
import { isProductPublicPriceEditable } from '@compra-car/core';
import Link from 'next/link';

import {
  adminPriceVisualStatusLabel,
  formatAdminDate,
  formatAdminPrice,
  isAdminPriceExpired,
  operationalDateInSaoPaulo,
} from './admin-price-presentation';

interface AdminPriceListProps {
  readonly page: ProductPublicPriceListPageDto;
  readonly onEdit: (id: string, opener: HTMLButtonElement) => void;
  readonly publishAction: (
    formData: FormData,
  ) => Promise<{ readonly ok: boolean; readonly message: string }>;
  readonly onPublished: (message: string) => void;
}

function statusClass(status: PricingWorkflowStatus, expired: boolean): string {
  if (expired) return 'border-slate-600 bg-slate-800/70 text-slate-200';
  return status === 'published'
    ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
    : status === 'needs_review'
      ? 'border-amber-800 bg-amber-950/50 text-amber-300'
      : 'border-slate-700 bg-slate-900 text-slate-300';
}

function SortHeader({
  page,
  field,
  children,
}: {
  readonly page: ProductPublicPriceListPageDto;
  readonly field: ProductPublicPriceListPageDto['sort'];
  readonly children: React.ReactNode;
}) {
  const active = page.sort === field;
  const direction = active && page.direction === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className="px-4 py-3 font-semibold"
      scope="col"
      aria-sort={active ? (page.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        className="inline-flex items-center gap-1 rounded hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-300"
        href={{ pathname: '/admin/prices', query: { sort: field, direction } }}
      >
        {children}
        <span aria-hidden="true">{active ? (page.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </Link>
    </th>
  );
}

export function AdminPriceList({ page, onEdit, publishAction, onPublished }: AdminPriceListProps) {
  const operationalDate = operationalDateInSaoPaulo();
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="overflow-x-auto lg:overflow-visible">
        <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
          <caption className="sr-only">Preços públicos cadastrados</caption>
          <thead className="admin-table-header border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <SortHeader page={page} field="vehicle">
                Veículo
              </SortHeader>
              <SortHeader page={page} field="amount">
                Preço público
              </SortHeader>
              <SortHeader page={page} field="startsOn">
                Vigência
              </SortHeader>
              <SortHeader page={page} field="status">
                Status
              </SortHeader>
              <SortHeader page={page} field="publishedAt">
                Publicação
              </SortHeader>
              <SortHeader page={page} field="updatedAt">
                Atualização
              </SortHeader>
              <th className="px-4 py-3 font-semibold" scope="col">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {page.items.map((price) => (
              <tr className="align-top transition hover:bg-slate-900/80" key={price.id}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-100">
                    {price.product.brand} {price.product.model}
                  </p>
                  <p className="mt-1 text-slate-400">
                    {price.product.version} · {price.product.modelYear}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-100">
                  <p>{formatAdminPrice(price.money.amount, price.money.currencyCode)}</p>
                  <p className="mt-1 font-mono text-xs font-normal text-slate-500">
                    Preço #{price.id}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                  <p>{formatAdminDate(price.startsOn)}</p>
                  <p className="mt-1 text-xs text-slate-500">até {formatAdminDate(price.endsOn)}</p>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(price.status, isAdminPriceExpired(price.status, price.endsOn, operationalDate))}`}
                  >
                    {adminPriceVisualStatusLabel(price.status, price.endsOn, operationalDate)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                  {price.publishedAt ? formatAdminDate(price.publishedAt) : 'Não publicado'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                  <p>{formatAdminDate(price.updatedAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Criado em {formatAdminDate(price.createdAt)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    {isProductPublicPriceEditable(price.status) ? (
                      <button
                        className="min-h-10 rounded-lg border border-slate-700 px-3 font-semibold text-slate-200 transition hover:bg-slate-800"
                        onClick={(event) => onEdit(price.id, event.currentTarget)}
                        type="button"
                      >
                        Editar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Somente leitura</span>
                    )}
                    {price.status === 'draft' || price.status === 'needs_review' ? (
                      <form
                        action={async (data) => {
                          if (
                            !window.confirm(
                              'Publicar preço? Este preço passará a ser utilizado pelas regras comerciais aplicáveis.',
                            )
                          )
                            return;
                          const result = await publishAction(data);
                          onPublished(result.message);
                        }}
                      >
                        <input type="hidden" name="id" value={price.id} />
                        <input type="hidden" name="lockVersion" value={price.lockVersion} />
                        <button
                          className="min-h-10 rounded-lg bg-sky-500 px-3 font-semibold text-slate-950"
                          type="submit"
                        >
                          Publicar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {page.total} {page.total === 1 ? 'preço encontrado' : 'preços encontrados'}
        </p>
        {page.pageCount > 1 ? (
          <nav aria-label="Paginação de preços públicos" className="flex items-center gap-2">
            {page.page > 1 ? (
              <Link
                className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-200"
                href={`/admin/prices?page=${page.page - 1}`}
              >
                Anterior
              </Link>
            ) : null}
            <span>
              Página {page.page} de {page.pageCount}
            </span>
            {page.page < page.pageCount ? (
              <Link
                className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-200"
                href={`/admin/prices?page=${page.page + 1}`}
              >
                Próxima
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
