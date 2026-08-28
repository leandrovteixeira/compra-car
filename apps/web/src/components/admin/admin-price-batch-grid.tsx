'use client';

import type {
  ManualPriceBatchActionStateDto,
  ManualPriceBatchGridRowDto,
  ManualPriceBatchProductOptionDto,
  ManualPriceBatchRowFieldErrorsDto,
} from '@compra-car/contracts';
import { formatPtBrMoneyInput, ptBrMoneyCaretPosition } from '@compra-car/core';
import { useActionState, useEffect, useRef, useState } from 'react';

import { EMPTY_MANUAL_PRICE_BATCH_ROW } from '@/application/admin/manual-price-batch';
import { AdminProductCombobox } from '@/components/admin/admin-product-combobox';
import { buttonClassName, fieldClassName } from '@compra-car/ui';

type BatchAction = (
  state: ManualPriceBatchActionStateDto,
  formData: FormData,
) => Promise<ManualPriceBatchActionStateDto>;

interface AdminPriceBatchGridProps {
  readonly action: BatchAction;
  readonly products: readonly ManualPriceBatchProductOptionDto[];
}

function isOperationallyEmpty(row: ManualPriceBatchGridRowDto): boolean {
  return !row.productId && !row.amount.trim() && !row.startsOn && !row.endsOn;
}

function newEmptyRow(clientRowId: string): ManualPriceBatchGridRowDto {
  return { ...EMPTY_MANUAL_PRICE_BATCH_ROW, clientRowId };
}

function FieldError({
  id,
  messages,
}: {
  readonly id: string;
  readonly messages?: readonly string[];
}) {
  return messages?.length ? (
    <span className="mt-1 block text-xs leading-5 text-rose-300" id={id}>
      {messages[0]}
    </span>
  ) : null;
}

export function AdminPriceBatchGrid({ action, products }: AdminPriceBatchGridProps) {
  const initialState: ManualPriceBatchActionStateDto = {
    status: 'idle',
    rows: [EMPTY_MANUAL_PRICE_BATCH_ROW],
    rowErrors: {},
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  const [rows, setRows] = useState<readonly ManualPriceBatchGridRowDto[]>(initialState.rows);
  const nextRowId = useRef(2);

  useEffect(() => {
    if (state.status === 'idle') return;
    if (state.status === 'success') {
      setRows([newEmptyRow(`row-${nextRowId.current++}`)]);
      return;
    }
    const submitted = [...state.rows];
    if (submitted.length === 0 || !isOperationallyEmpty(submitted.at(-1)!)) {
      submitted.push(newEmptyRow(`row-${nextRowId.current++}`));
    }
    setRows(submitted);
  }, [state]);

  const filledCount = rows.filter((row) => !isOperationallyEmpty(row)).length;
  const inputClass = `${fieldClassName} disabled:cursor-not-allowed disabled:opacity-60`;

  function updateRow(clientRowId: string, change: Partial<ManualPriceBatchGridRowDto>) {
    setRows((current) => {
      const next = current.map((row) =>
        row.clientRowId === clientRowId ? { ...row, ...change } : row,
      );
      const last = next.at(-1);
      if (
        last &&
        !isOperationallyEmpty(last) &&
        next.filter((row) => !isOperationallyEmpty(row)).length <= 100
      ) {
        next.push(newEmptyRow(`row-${nextRowId.current++}`));
      }
      return next;
    });
  }

  function updateMoney(clientRowId: string, element: HTMLInputElement) {
    const raw = element.value;
    const formatted = formatPtBrMoneyInput(raw);
    const caret = ptBrMoneyCaretPosition(raw, formatted, element.selectionStart);
    updateRow(clientRowId, { amount: formatted });
    requestAnimationFrame(() => {
      if (document.activeElement !== element || caret === null) return;
      element.setSelectionRange(caret, caret);
    });
  }

  function removeRow(clientRowId: string) {
    setRows((current) => {
      const next = current.filter((row) => row.clientRowId !== clientRowId);
      return next.length ? next : [newEmptyRow(`row-${nextRowId.current++}`)];
    });
  }

  return (
    <form action={formAction} autoComplete="off" className="space-y-5">
      <input name="rows" type="hidden" value={JSON.stringify(rows)} />

      {state.status !== 'idle' ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm ${
            state.status === 'success'
              ? 'border-emerald-800 bg-emerald-950/30 text-emerald-200'
              : 'border-rose-800 bg-rose-950/30 text-rose-200'
          }`}
          role={state.status === 'success' ? 'status' : 'alert'}
        >
          {state.message}
          {state.status === 'success' ? (
            <span className="ml-1 text-emerald-300/80">Lote #{state.batchId}.</span>
          ) : null}
        </div>
      ) : null}

      <div className="ui-table-frame">
        <div className="hidden min-h-8 grid-cols-[minmax(18rem,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_3rem] items-center gap-3 border-b border-border bg-surface-muted px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted md:grid">
          <span>Veículo</span>
          <span>Preço público</span>
          <span>Início</span>
          <span>Fim</span>
          <span className="sr-only">Ações</span>
        </div>

        <fieldset disabled={pending}>
          {rows.map((row, index) => {
            const errors: ManualPriceBatchRowFieldErrorsDto =
              state.rowErrors[row.clientRowId] ?? {};
            const isLastEmpty = index === rows.length - 1 && isOperationallyEmpty(row);
            const maxReached = isLastEmpty && filledCount >= 100;
            const prefix = `batch-${row.clientRowId}`;

            return (
              <div
                className="grid gap-3 border-b border-border px-3 py-3 last:border-b-0 md:grid-cols-[minmax(18rem,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_3rem] md:py-2"
                key={row.clientRowId}
              >
                <div>
                  <AdminProductCombobox
                    disabled={maxReached}
                    error={Boolean(errors.productId || errors.row)}
                    errorDescriptionId={
                      errors.productId || errors.row ? `${prefix}-product-error` : undefined
                    }
                    label={`Veículo — linha ${index + 1}`}
                    hideLabel
                    onChange={(productId) => updateRow(row.clientRowId, { productId })}
                    options={products}
                    value={row.productId}
                  />
                  <FieldError
                    id={`${prefix}-product-error`}
                    messages={errors.productId ?? errors.row}
                  />
                </div>

                <label className="block text-xs font-semibold text-text-secondary">
                  <span className="md:sr-only">Preço público</span>
                  <input
                    aria-describedby={errors.amount ? `${prefix}-amount-error` : undefined}
                    aria-invalid={Boolean(errors.amount)}
                    autoComplete="off"
                    className={inputClass}
                    disabled={maxReached}
                    inputMode="decimal"
                    onChange={(event) => updateMoney(row.clientRowId, event.currentTarget)}
                    placeholder="159.990,00"
                    value={row.amount}
                  />
                  <FieldError id={`${prefix}-amount-error`} messages={errors.amount} />
                </label>

                <label className="block text-xs font-semibold text-text-secondary">
                  <span className="md:sr-only">Início da vigência</span>
                  <input
                    aria-describedby={errors.startsOn ? `${prefix}-start-error` : undefined}
                    aria-invalid={Boolean(errors.startsOn)}
                    className={inputClass}
                    disabled={maxReached}
                    onChange={(event) =>
                      updateRow(row.clientRowId, { startsOn: event.target.value })
                    }
                    type="date"
                    value={row.startsOn}
                  />
                  <FieldError id={`${prefix}-start-error`} messages={errors.startsOn} />
                </label>

                <label className="block text-xs font-semibold text-text-secondary">
                  <span className="md:sr-only">Fim da vigência (opcional)</span>
                  <input
                    aria-describedby={errors.endsOn ? `${prefix}-end-error` : undefined}
                    aria-invalid={Boolean(errors.endsOn)}
                    className={inputClass}
                    disabled={maxReached}
                    onChange={(event) => updateRow(row.clientRowId, { endsOn: event.target.value })}
                    type="date"
                    value={row.endsOn}
                  />
                  <FieldError id={`${prefix}-end-error`} messages={errors.endsOn} />
                </label>

                <button
                  aria-label={`Remover linha ${index + 1}`}
                  className={`${buttonClassName({ compact: true, variant: 'ghost' })} text-status-error disabled:cursor-not-allowed disabled:opacity-40 md:px-0`}
                  disabled={isLastEmpty}
                  onClick={() => removeRow(row.clientRowId)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  <span className="ml-2 md:sr-only">Remover linha</span>
                </button>
              </div>
            );
          })}
        </fieldset>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">
          {filledCount}/100 linhas preenchidas. O salvamento é atômico e cria preços em rascunho.
        </p>
        <button
          className={buttonClassName({ variant: 'interactive' })}
          disabled={pending || filledCount === 0}
          type="submit"
        >
          {pending ? 'Salvando…' : 'Salvar preços'}
        </button>
      </div>
    </form>
  );
}
