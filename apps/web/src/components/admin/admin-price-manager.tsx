'use client';

import type {
  ProductPublicPriceActionStateDto,
  ProductPublicPriceFormValuesDto,
  ProductPublicPriceListItemDto,
  ProductPublicPriceListPageDto,
  ProductPublicPriceProductOptionDto,
} from '@compra-car/contracts';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';

import {
  amountToPtBrInput,
  EMPTY_PRODUCT_PUBLIC_PRICE_VALUES,
} from '@/application/admin/product-public-price-form';

import { AdminPriceList } from './admin-price-list';
import { EmptyState } from './empty-state';

type PriceAction = (
  state: ProductPublicPriceActionStateDto,
  formData: FormData,
) => Promise<ProductPublicPriceActionStateDto>;

interface AdminPriceManagerProps {
  readonly createAction: PriceAction;
  readonly page: ProductPublicPriceListPageDto;
  readonly products: readonly ProductPublicPriceProductOptionDto[];
  readonly updateAction: PriceAction;
}

function valuesForPrice(price: ProductPublicPriceListItemDto): ProductPublicPriceFormValuesDto {
  return {
    id: price.id,
    productId: price.product.id,
    amount: amountToPtBrInput(price.money.amount),
    startsOn: price.startsOn,
    endsOn: price.endsOn ?? '',
    lockVersion: String(price.lockVersion),
  };
}

function FieldError({
  id,
  messages,
}: {
  readonly id: string;
  readonly messages?: readonly string[];
}) {
  return messages?.length ? (
    <span className="mt-1 block text-sm text-rose-300" id={id}>
      {messages[0]}
    </span>
  ) : null;
}

function PriceDialog({
  action,
  initialValues,
  mode,
  onClose,
  onSuccess,
  products,
}: {
  readonly action: PriceAction;
  readonly initialValues: ProductPublicPriceFormValuesDto;
  readonly mode: 'create' | 'edit';
  readonly onClose: () => void;
  readonly onSuccess: (message: string) => void;
  readonly products: readonly ProductPublicPriceProductOptionDto[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const initialState: ProductPublicPriceActionStateDto = {
    status: 'idle',
    values: initialValues,
    fieldErrors: {},
  };
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    dialogRef.current?.showModal();
    amountRef.current?.focus();
  }, []);
  useEffect(() => {
    if (state.status === 'success') onSuccess(state.message);
  }, [onSuccess, state]);

  const inputClass =
    'mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';
  const stateKey = `${state.status}\u001f${Object.values(state.values).join('\u001f')}`;

  return (
    <dialog
      aria-labelledby="price-dialog-title"
      className="m-auto w-[min(94vw,42rem)] rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85"
      onCancel={onClose}
      onClose={onClose}
      ref={dialogRef}
    >
      <form action={formAction} className="p-6 sm:p-8" key={stateKey}>
        <fieldset disabled={pending}>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-300">Pricing</p>
          <h2 className="mt-2 text-2xl font-bold" id="price-dialog-title">
            {mode === 'create' ? 'Novo preço público' : 'Editar preço público'}
          </h2>
          {state.status === 'error' || state.status === 'conflict' ? (
            <div
              className="mt-5 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200"
              role="alert"
            >
              {state.message}
            </div>
          ) : null}
          <input name="id" type="hidden" value={state.values.id} />
          <input name="lockVersion" type="hidden" value={state.values.lockVersion} />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-200 sm:col-span-2">
              Produto
              <select
                aria-describedby={state.fieldErrors.productId ? 'price-product-error' : undefined}
                aria-invalid={Boolean(state.fieldErrors.productId)}
                className={inputClass}
                defaultValue={state.values.productId}
                disabled={mode === 'edit'}
                name={mode === 'edit' ? undefined : 'productId'}
                required
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
              </select>
              {mode === 'edit' ? (
                <input name="productId" type="hidden" value={state.values.productId} />
              ) : null}
              <FieldError id="price-product-error" messages={state.fieldErrors.productId} />
            </label>
            <label className="block text-sm font-semibold text-slate-200 sm:col-span-2">
              Preço público
              <input
                aria-describedby={state.fieldErrors.amount ? 'price-amount-error' : undefined}
                aria-invalid={Boolean(state.fieldErrors.amount)}
                className={inputClass}
                defaultValue={state.values.amount}
                inputMode="decimal"
                name="amount"
                placeholder="159.990,50"
                ref={amountRef}
                required
              />
              <FieldError id="price-amount-error" messages={state.fieldErrors.amount} />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Início da vigência
              <input
                aria-describedby={state.fieldErrors.startsOn ? 'price-start-error' : undefined}
                aria-invalid={Boolean(state.fieldErrors.startsOn)}
                className={inputClass}
                defaultValue={state.values.startsOn}
                name="startsOn"
                required
                type="date"
              />
              <FieldError id="price-start-error" messages={state.fieldErrors.startsOn} />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Fim da vigência
              <input
                aria-describedby={state.fieldErrors.endsOn ? 'price-end-error' : undefined}
                aria-invalid={Boolean(state.fieldErrors.endsOn)}
                className={inputClass}
                defaultValue={state.values.endsOn}
                name="endsOn"
                type="date"
              />
              <FieldError id="price-end-error" messages={state.fieldErrors.endsOn} />
            </label>
          </div>
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-xl border border-slate-700 px-5 font-semibold text-slate-200 hover:bg-slate-800"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-xl bg-sky-500 px-5 font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}

export function AdminPriceManager({
  createAction,
  page,
  products,
  updateAction,
}: AdminPriceManagerProps) {
  const router = useRouter();
  const newPriceButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState<ProductPublicPriceListItemDto | 'create' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function close() {
    setEditing(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }
  function success(message: string) {
    setFeedback(message);
    setEditing(null);
    router.refresh();
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {feedback ? (
          <p
            className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            {feedback}
          </p>
        ) : (
          <span />
        )}
        <button
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-semibold text-slate-950 hover:bg-sky-400"
          onClick={(event) => {
            openerRef.current = event.currentTarget;
            setFeedback(null);
            setEditing('create');
          }}
          ref={newPriceButtonRef}
          type="button"
        >
          Novo preço
        </button>
      </div>
      {page.items.length ? (
        <AdminPriceList
          onEdit={(id, opener) => {
            openerRef.current = opener;
            setEditing(page.items.find((price) => price.id === id) ?? null);
          }}
          page={page}
        />
      ) : (
        <EmptyState
          description="Ainda não há preços públicos disponíveis para consulta nesta página."
          title="Nenhum preço público encontrado"
        />
      )}
      {editing ? (
        <PriceDialog
          action={editing === 'create' ? createAction : updateAction}
          initialValues={
            editing === 'create' ? EMPTY_PRODUCT_PUBLIC_PRICE_VALUES : valuesForPrice(editing)
          }
          key={editing === 'create' ? 'create' : `edit-${editing.id}`}
          mode={editing === 'create' ? 'create' : 'edit'}
          onClose={close}
          onSuccess={success}
          products={products}
        />
      ) : null}
    </>
  );
}
