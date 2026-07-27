'use client';

import type { ProductPublicPriceListPageDto, PricingWorkflowStatus } from '@compra-car/contracts';
import { isProductPublicPriceEditable } from '@compra-car/core';
import Link from 'next/link';

import {
  adminPriceStatusLabel,
  formatAdminDate,
  formatAdminPrice,
} from './admin-price-presentation';

interface AdminPriceListProps {
  readonly page: ProductPublicPriceListPageDto;
  readonly onEdit: (id: string, opener: HTMLButtonElement) => void;
}

function statusClass(status: PricingWorkflowStatus): string {
  return status === 'published'
    ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
    : status === 'needs_review'
      ? 'border-amber-800 bg-amber-950/50 text-amber-300'
      : 'border-slate-700 bg-slate-900 text-slate-300';
}

export function AdminPriceList({ page, onEdit }: AdminPriceListProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
          <caption className="sr-only">Preços públicos cadastrados</caption>
          <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                Veículo
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Preço público
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Vigência
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Status
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Publicação
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Atualização
              </th>
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
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(price.status)}`}
                  >
                    {adminPriceStatusLabel(price.status)}
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
