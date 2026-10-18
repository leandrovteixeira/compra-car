'use client';

import type { ProductPublicPriceListPageDto, PricingWorkflowStatus } from '@compra-car/contracts';
import { isProductPublicPriceEditable } from '@compra-car/core';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProductPublicPriceAction, updateProductPublicPriceAction } from '@/app/admin/prices/actions';
import { amountToPtBrInput } from '@/application/admin/product-public-price-form';
import { ComparisonLoadingOverlay } from '@/components/admin/comparison-loading-overlay';
import { useSearchParams } from 'next/navigation';
import { buttonClassName, tableClassName, tableFrameClassName } from '@compra-car/ui';

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
  readonly onCorrect: (id: string, opener: HTMLButtonElement) => void;
  readonly publishAction: (
    formData: FormData,
  ) => Promise<{ readonly ok: boolean; readonly message: string }>;
  readonly onPublished: (message: string) => void;
}

function statusClass(status: PricingWorkflowStatus, expired: boolean): string {
  if (expired) return 'border-[#D6DEE3] bg-[#F1F3F5] text-[#697786]';
  return status === 'published'
    ? 'border-[#AFE3C3] bg-[#F1FAF5] text-[#16854A]'
    : status === 'needs_review'
      ? 'border-[#EDD19A] bg-[#FFF8E8] text-[#9B6A19]'
      : 'border-[#D6DEE3] bg-[#F1F3F5] text-[#697786]';
}

function hrefWithParams(currentParams: URLSearchParams, changes: Readonly<Record<string, string | null>>): string {
  const params = new URLSearchParams(currentParams.toString());
  for (const [name, value] of Object.entries(changes)) {
    if (value === null || value === '') params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return query ? `/admin/prices?${query}` : '/admin/prices';
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
  const currentParams = useSearchParams();
  const active = page.sort === field;
  const direction = active && page.direction === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className={`font-semibold bg-[#DCE8ED] ${field === "vehicle" ? "text-left" : "text-center"}`}
      scope="col"
      aria-sort={active ? (page.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        className={`inline-flex items-center gap-1 rounded hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus ${field === "vehicle" ? "" : "justify-center"}`}
        href={hrefWithParams(currentParams, {
          page: null,
          sort: field,
          direction,
        })}
      >
        {children}
        <span aria-hidden="true">{active ? (page.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </Link>
    </th>
  );
}

export function AdminPriceList({ page, onEdit, onCorrect, publishAction, onPublished }: AdminPriceListProps) {
  const router = useRouter();
  const [editingId,setEditingId] = useState<string | null>(null);
  const [draft,setDraft] = useState({ amount:'', startsOn:'',endsOn:'' });
  const [feedback,setFeedback] = useState('');
  const [pending,startTransition] = useTransition();
  const operationalDate = operationalDateInSaoPaulo();
  function openEditor(price: ProductPublicPriceListPageDto['items'][number]) {
    setEditingId(price.id);
    setFeedback('');
    const editable = isProductPublicPriceEditable(price.status);
    const today = operationalDateInSaoPaulo();
    const nextDay = new Date(Date.parse(price.startsOn + 'T00:00:00Z') + 86400000).toISOString().slice(0,10);
    const correctionStart = editable ? price.startsOn : (today > price.startsOn ? today : nextDay);
    setDraft({ amount:amountToPtBrInput(price.money.amount),startsOn:correctionStart,endsOn:price.endsOn && price.endsOn >= correctionStart ? price.endsOn : '' });
  }
  function save(price: ProductPublicPriceListPageDto['items'][number]) {
    if(pending) return;
    const parsedAmount = Number(draft.amount.trim().replace(/\./g,'').replace(',','.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setFeedback('Informe um preço válido maior que zero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn)) { setFeedback('Informe a data inicial da vigência.'); return; }
    if (draft.endsOn && draft.endsOn < draft.startsOn) { setFeedback('A vigência final não pode anteceder a inicial.'); return; }
    const data = new FormData();
    data.set('id', isProductPublicPriceEditable(price.status) ? price.id : '');
    data.set('lockVersion', isProductPublicPriceEditable(price.status) ? String(price.lockVersion) : '');
    data.set('productId',String(price.product.id));
    data.set('amount',draft.amount);
    data.set('startsOn',draft.startsOn);
    data.set('endsOn',draft.endsOn);
    startTransition(async () => {
      try {
        const state = {status:'idle' as const,values:{id:'',productId:String(price.product.id),amount:'',startsOn:'',endsOn:'',lockVersion:''},fieldErrors:{}};
        const result = isProductPublicPriceEditable(price.status)
          ? await updateProductPublicPriceAction(state,data)
          : await createProductPublicPriceAction(state,data);
        if(result.status === 'success') {
          setEditingId(null);
          const editable = isProductPublicPriceEditable(price.status);
          setFeedback(editable ? 'Preço atualizado.' : 'Rascunho de correção criado. Revise-o antes de publicar.');
          if (!editable) router.replace('/admin/prices?status=draft', {scroll:false});
          else router.refresh();
        } else {
          const errors = 'fieldErrors' in result && result.fieldErrors
            ? Object.values(result.fieldErrors).flat().filter(Boolean).join(' ')
            : '';
          setFeedback(errors || ('message' in result ? result.message : '') || 'Revise os campos de preço e vigência.');
        }
      } catch {setFeedback('Não foi possível salvar. Nenhuma alteração foi confirmada.');}
    });
  }
  const currentParams = useSearchParams();
  return (
    <div className={`${tableFrameClassName} admin-pricing-table-frame`}>
      {pending && <ComparisonLoadingOverlay />}
      {feedback && <p role="status" className="px-3 py-1 text-xs text-[#526670]">{feedback}</p>}
      <div className="admin-pricing-table-scroll overflow-auto">
        <table className={`${tableClassName} min-w-[56rem]`}>
          <caption className="sr-only">Preços públicos cadastrados</caption>
          <thead className="admin-pricing-table-header bg-[#DCE8ED]">
            <tr>
              <SortHeader page={page} field="vehicle">
                Veículo
              </SortHeader>
              <SortHeader page={page} field="amount">
                Preço público
              </SortHeader>
              <SortHeader page={page} field="startsOn">
                Vigência De
              </SortHeader>
              <th scope="col" className="bg-[#DCE8ED] text-center font-semibold">Vigência Até</th>
              <SortHeader page={page} field="status">
                Status
              </SortHeader>
              <SortHeader page={page} field="updatedAt">
                Atualizado em
              </SortHeader>
              <th className="bg-[#DCE8ED] text-center font-semibold" scope="col">Editar</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((price) => (
              <tr className="group align-middle transition-colors hover:!bg-[#EAF1F4]" key={price.id}>
                <td className="whitespace-nowrap">
                  <span className="cc-type-data !font-semibold text-[#1A1D21]">{price.product.brand} {price.product.model} {price.product.version} {price.product.modelYear}</span>
                </td>
                <td className="whitespace-nowrap text-center font-semibold text-text-primary">
                  {editingId === price.id ? <input aria-label="Preço público" className="ui-field !h-8 w-32 text-center text-xs" value={draft.amount} onChange={event=>setDraft(d=>({...d,amount:event.target.value}))} /> : <p>{formatAdminPrice(price.money.amount, price.money.currencyCode)}</p>}
                </td>
                <td className="whitespace-nowrap text-center text-text-secondary">
                  {editingId === price.id ? <input type="date" aria-label="Vigência De" className="ui-field !h-8 w-36 text-xs" value={draft.startsOn} onChange={event=>setDraft(d=>({...d,startsOn:event.target.value}))}/> : <p>{formatAdminDate(price.startsOn)}</p>}

                </td>
                <td className="whitespace-nowrap text-center text-text-secondary">{editingId === price.id ? <input type="date" aria-label="Vigência Até" className="ui-field !h-8 w-36 text-xs" value={draft.endsOn} onChange={event=>setDraft(d=>({...d,endsOn:event.target.value}))} /> : price.endsOn ? formatAdminDate(price.endsOn) : "—"}</td>
                <td className="text-center">
                  <span
                    className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(price.status, isAdminPriceExpired(price.status, price.endsOn, operationalDate))}`}
                  >
                    {adminPriceVisualStatusLabel(price.status, price.startsOn, price.endsOn, operationalDate)}
                  </span>
                </td>
                <td className="whitespace-nowrap text-center text-text-secondary">
                  <p>{formatAdminDate(price.updatedAt)}</p>
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {editingId === price.id ? (
                      <>
                        <button type="button" disabled={pending} onClick={()=>save(price)} className="cc-btn cc-btn--p cc-btn--primary">Salvar</button>
                        <button type="button" disabled={pending} onClick={()=>{setEditingId(null);setFeedback('');}} className="cc-btn cc-btn--p cc-btn--secondary">Cancelar</button>
                      </>
                    ) : <button type="button" disabled={pending || editingId !== null} onClick={()=>openEditor(price)} className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action group-hover:!bg-[#1A1D21] group-hover:!text-white">{isProductPublicPriceEditable(price.status)?'Editar':'Corrigir'}</button>}
                    {editingId !== price.id && (price.status === 'draft' || price.status === 'needs_review') ? (
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
                          className={buttonClassName({ size: 'commit', variant: 'interactive' })}
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
      <div className="flex flex-col gap-3 border-t border-border px-3 py-2 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          {page.total} {page.total === 1 ? 'preço encontrado' : 'preços encontrados'}
        </p>

      </div>
    </div>
  );
}
