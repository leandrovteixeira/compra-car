'use client';

import type {
  ProductPublicPriceActionStateDto,
  ProductPublicPriceFormValuesDto,
  ProductPublicPriceListItemDto,
  ProductPublicPriceListPageDto,
  ProductPublicPriceProductOptionDto,
} from '@compra-car/contracts';
import { formatPtBrMoneyInput, ptBrMoneyCaretPosition } from '@compra-car/core';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { amountToPtBrInput } from '@/application/admin/product-public-price-form';

import { AdminPriceList } from './admin-price-list';
import { EmptyState } from './empty-state';

type PriceAction = (
  state: ProductPublicPriceActionStateDto,
  formData: FormData,
) => Promise<ProductPublicPriceActionStateDto>;
type PublishAction = (
  formData: FormData,
) => Promise<{ readonly ok: boolean; readonly message: string }>;

interface AdminPriceManagerProps {
  readonly page: ProductPublicPriceListPageDto;
  readonly products: readonly ProductPublicPriceProductOptionDto[];
  readonly updateAction: PriceAction;
  readonly publishAction: (
    formData: FormData,
  ) => Promise<{ readonly ok: boolean; readonly message: string }>;
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

export function PriceDialog({
  action,
  initialValues,
  onClose,
  onSuccess,
  publishAction,
  products,
}: {
  readonly action: PriceAction;
  readonly initialValues: ProductPublicPriceFormValuesDto;
  readonly onClose: () => void;
  readonly onSuccess: (message: string) => void;
  readonly publishAction?: PublishAction;
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
  const [amountValue, setAmountValue] = useState(initialValues.amount);
  const [publicationPending, startPublication] = useTransition();
  const [publicationError, setPublicationError] = useState('');
  const publishAfterSave = useRef(false);
  const publicationCompleted = useRef(false);
  const handledSuccess = useRef('');

  useEffect(() => {
    dialogRef.current?.showModal();
    amountRef.current?.focus();
  }, []);
  const publishCreatedPrice = useCallback(() => {
    if (
      !publishAction ||
      !state.values.id ||
      !state.values.lockVersion ||
      publicationCompleted.current
    )
      return;
    const data = new FormData();
    data.set('id', state.values.id);
    data.set('lockVersion', state.values.lockVersion);
    startPublication(async () => {
      let result: Awaited<ReturnType<PublishAction>>;
      try {
        result = await publishAction(data);
      } catch (error) {
        publishAfterSave.current = false;
        console.error('Product public price publication action failed.', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          priceId: state.values.id,
        });
        setPublicationError('NÃ£o foi possÃ­vel publicar. Tente publicar novamente.');
        return;
      }
      if (result.ok) {
        publicationCompleted.current = true;
        publishAfterSave.current = false;
        try {
          onSuccess(result.message);
        } catch (error) {
          console.error('Product public price refresh failed after successful publication.', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            priceId: state.values.id,
          });
        }
        return;
      }
      publishAfterSave.current = false;
      setPublicationError(result.message);
    });
  }, [onSuccess, publishAction, state.values.id, state.values.lockVersion]);
  useEffect(() => {
    if (state.status !== 'success') return;
    const successKey = `${state.values.id}:${state.values.lockVersion}`;
    if (handledSuccess.current === successKey) return;
    handledSuccess.current = successKey;
    if (!publishAfterSave.current || !publishAction) {
      onSuccess(state.message);
      return;
    }
    publishCreatedPrice();
  }, [onSuccess, publishAction, publishCreatedPrice, state]);

  useEffect(() => setAmountValue(state.values.amount), [state.values.amount]);

  function updateAmount(element: HTMLInputElement) {
    const raw = element.value;
    const formatted = formatPtBrMoneyInput(raw);
    const caret = ptBrMoneyCaretPosition(raw, formatted, element.selectionStart);
    setAmountValue(formatted);
    requestAnimationFrame(() => {
      if (caret !== null) element.setSelectionRange(caret, caret);
    });
  }

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
      <form action={formAction} autoComplete="off" className="p-6 sm:p-8" key={stateKey}>
        <fieldset disabled={pending || publicationPending}>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-300">Pricing</p>
          <h2 className="mt-2 text-2xl font-bold" id="price-dialog-title">
            {initialValues.id ? 'Editar preço público' : 'Adicionar preço público'}
          </h2>
          {state.status === 'error' || state.status === 'conflict' ? (
            <div
              className="mt-5 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200"
              role="alert"
            >
              {state.message}
            </div>
          ) : null}
          {publicationError ? (
            <div
              className="mt-5 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200"
              role="alert"
            >
              {publicationError}
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
                disabled
                required
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
              </select>
              <input name="productId" type="hidden" value={state.values.productId} />
              <FieldError id="price-product-error" messages={state.fieldErrors.productId} />
            </label>
            <label className="block text-sm font-semibold text-slate-200 sm:col-span-2">
              Preço público
              <input
                aria-describedby={state.fieldErrors.amount ? 'price-amount-error' : undefined}
                aria-invalid={Boolean(state.fieldErrors.amount)}
                className={inputClass}
                autoComplete="off"
                inputMode="decimal"
                name="amount"
                onChange={(event) => updateAmount(event.currentTarget)}
                placeholder="159.990,50"
                ref={amountRef}
                required
                value={amountValue}
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
              name="intent"
              onClick={() => {
                publishAfterSave.current = false;
                setPublicationError('');
              }}
              type="submit"
              value="draft"
            >
              {pending ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            {publishAction && !initialValues.id && state.status !== 'success' ? (
              <button
                className="min-h-11 rounded-xl bg-emerald-500 px-5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                disabled={pending || publicationPending}
                name="intent"
                onClick={() => {
                  publishAfterSave.current = true;
                  setPublicationError('');
                }}
                type="submit"
                value="publish"
              >
                {publicationPending ? 'Publicando…' : 'Publicar agora'}
              </button>
            ) : null}
            {publicationError && state.status === 'success' ? (
              <button
                className="min-h-11 rounded-xl bg-emerald-500 px-5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                disabled={publicationPending}
                onClick={() => {
                  setPublicationError('');
                  publishCreatedPrice();
                }}
                type="button"
              >
                {publicationPending ? 'Publicando…' : 'Tentar publicar novamente'}
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}

export function AdminPriceManager({
  page,
  products,
  updateAction,
  publishAction,
}: AdminPriceManagerProps) {
  const router = useRouter();
  const openerRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState<ProductPublicPriceListItemDto | null>(null);
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
    <div className="admin-pricing-manager">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        <span />
      </div>
      {page.items.length ? (
        <AdminPriceList
          onEdit={(id, opener) => {
            openerRef.current = opener;
            setEditing(page.items.find((price) => price.id === id) ?? null);
          }}
          page={page}
          publishAction={publishAction}
          onPublished={(message) => {
            setFeedback(message);
            router.refresh();
          }}
        />
      ) : (
        <EmptyState
          description="Ainda não há preços públicos disponíveis para consulta nesta página."
          title="Nenhum preço público encontrado"
        />
      )}
      {editing ? (
        <PriceDialog
          action={updateAction}
          initialValues={valuesForPrice(editing)}
          key={`edit-${editing.id}`}
          onClose={close}
          onSuccess={success}
          products={products}
        />
      ) : null}
    </div>
  );
}
