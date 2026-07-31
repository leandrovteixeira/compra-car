'use client';

import type {
  ManualPolicyBasePriceDto,
  ManualPolicyBatchActionStateDto,
  ManualPolicyBatchGridRowDto,
  ManualPolicyFinancialReferenceDto,
  ManualPriceBatchProductOptionDto,
} from '@compra-car/contracts';
import {
  calculateManualPolicyBenefit,
  formatPtBrMoneyInput,
  formatPtBrPercentageInput,
  MANUAL_POLICY_DISPLAY_LABELS,
  MANUAL_POLICY_TITLES,
  normalizeManualPolicyBatchRow,
  ptBrMoneyCaretPosition,
  resolveManualPolicyReferenceData,
} from '@compra-car/core';
import { useActionState, useEffect, useRef, useState } from 'react';

import { EMPTY_MANUAL_POLICY_BATCH_ROW } from '@/application/admin/manual-policy-batch';
import { AdminProductCombobox } from '@/components/admin/admin-product-combobox';

const TYPES = Object.entries(MANUAL_POLICY_DISPLAY_LABELS);
const FIXED = new Set([
  'retail_bonus',
  'trade_in_bonus',
  'loyalty_bonus',
  'free_wallbox',
  'free_maintenance',
  'fuel_or_recharge_voucher',
  'other',
]);
type Action = (
  state: ManualPolicyBatchActionStateDto,
  data: FormData,
) => Promise<ManualPolicyBatchActionStateDto>;
const empty = (id: string): ManualPolicyBatchGridRowDto => ({
  ...EMPTY_MANUAL_POLICY_BATCH_ROW,
  clientRowId: id,
});
const isEmpty = (row: ManualPolicyBatchGridRowDto) =>
  Object.entries(row).every(
    ([field, value]) => field === 'clientRowId' || value == null || String(value).trim() === '',
  );
const grid =
  'grid gap-3 lg:grid-cols-[minmax(8rem,2fr)_minmax(7.5rem,1fr)_7.75rem_4.25rem_4.75rem_4.5rem_7.5rem_minmax(8rem,1.4fr)]';
const input =
  'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';

function brl(value: string): string {
  const [integer, fraction = '00'] = value.split('.');
  return `R$ ${BigInt(integer!).toLocaleString('pt-BR')},${fraction.padEnd(2, '0')}`;
}

function CellLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-semibold text-slate-400 lg:sr-only">{children}</span>
  );
}

function EmptyCell() {
  return <div aria-hidden="true" className="hidden min-h-11 lg:block" />;
}

export function AdminPolicyBatchGrid({
  action,
  products,
  prices,
  references,
  productId,
  onDirty,
  onSaved,
}: {
  readonly action: Action;
  readonly products: readonly ManualPriceBatchProductOptionDto[];
  readonly prices: readonly ManualPolicyBasePriceDto[];
  readonly references: readonly ManualPolicyFinancialReferenceDto[];
  readonly productId?: string;
  readonly onDirty?: () => void;
  readonly onSaved?: () => void;
}) {
  const initial: ManualPolicyBatchActionStateDto = {
    status: 'idle',
    rows: [EMPTY_MANUAL_POLICY_BATCH_ROW],
    rowErrors: {},
  };
  const [state, formAction, pending] = useActionState(action, initial);
  const [rows, setRows] = useState(initial.rows);
  const next = useRef(2);

  useEffect(() => {
    if (state.status === 'idle') return;
    if (state.status === 'success') {
      setRows([empty(`row-${next.current++}`)]);
      onSaved?.();
    } else {
      const submitted = [...state.rows];
      if (!submitted.length || !isEmpty(submitted.at(-1)!)) {
        submitted.push(empty(`row-${next.current++}`));
      }
      setRows(submitted);
    }
  }, [onSaved, state]);

  useEffect(() => {
    if (productId === undefined) return;
    setRows([empty(`row-${next.current++}`)]);
  }, [productId]);

  const update = (id: string, change: Partial<ManualPolicyBatchGridRowDto>) => {
    onDirty?.();
    setRows((current) => {
      const result = current.map((row) => (row.clientRowId === id ? { ...row, ...change } : row));
      if (!isEmpty(result.at(-1)!) && result.filter((row) => !isEmpty(row)).length <= 100) {
        result.push(empty(`row-${next.current++}`));
      }
      return result;
    });
  };

  function updateMoney(row: ManualPolicyBatchGridRowDto, element: HTMLInputElement) {
    const raw = element.value;
    const formatted = formatPtBrMoneyInput(raw);
    const caret = ptBrMoneyCaretPosition(raw, formatted, element.selectionStart);
    update(row.clientRowId, { amount: formatted });
    requestAnimationFrame(() => {
      if (document.activeElement !== element || caret === null) return;
      element.setSelectionRange(caret, caret);
    });
  }

  function changeType(row: ManualPolicyBatchGridRowDto, policyType: string) {
    update(row.clientRowId, {
      ...empty(row.clientRowId),
      productId: row.productId,
      policyType,
      title: MANUAL_POLICY_TITLES[policyType] ?? '',
      startsOn: row.startsOn,
      description: row.description,
      termMonths: policyType === 'free_insurance' ? '12' : '',
      voucherType: policyType === 'fuel_or_recharge_voucher' ? 'unspecified' : '',
    });
  }

  const filled = rows.filter((row) => !isEmpty(row)).length;
  return (
    <form action={formAction} className="space-y-5">
      <input
        name="rows"
        type="hidden"
        value={JSON.stringify(
          rows
            .filter((row) => !isEmpty(row))
            .map((row) => (productId === undefined ? row : { ...row, productId })),
        )}
      />
      {state.status !== 'idle' ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm ${state.status === 'success' ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
          role={state.status === 'success' ? 'status' : 'alert'}
        >
          {state.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50 lg:overflow-x-visible">
        <div
          className={`${grid} admin-table-header hidden border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 lg:grid`}
        >
          <span>Veículo</span>
          <span>Tipo</span>
          <span>Início</span>
          <span>Prazo</span>
          <span>Taxa</span>
          <span>Entrada</span>
          <span>Valor</span>
          <span>Descrição</span>
        </div>
        <fieldset disabled={pending}>
          {rows.map((row, index) => {
            const errors = state.rowErrors[row.clientRowId] ?? {};
            const normalized = normalizeManualPolicyBatchRow({ ...row, endsOn: null });
            const reference = resolveManualPolicyReferenceData(normalized, prices, references);
            const preview = calculateManualPolicyBenefit(normalized, reference);
            const calculated = !FIXED.has(row.policyType);
            const messages = Object.values(errors).flat().filter(Boolean);
            return (
              <div
                className="relative border-b border-slate-800 p-4 last:border-b-0"
                key={row.clientRowId}
              >
                <div className={grid}>
                  {productId === undefined ? (
                    <AdminProductCombobox
                      error={Boolean(errors.productId)}
                      hideLabel
                      label={`Veículo da linha ${index + 1}`}
                      onChange={(productId) => update(row.clientRowId, { productId })}
                      options={products}
                      value={row.productId}
                    />
                  ) : (
                    <output className="flex min-h-11 items-center text-sm text-slate-300">
                      Veículo selecionado
                    </output>
                  )}
                  <label>
                    <CellLabel>Tipo</CellLabel>
                    <select
                      aria-label={`Tipo da linha ${index + 1}`}
                      className={input}
                      onChange={(event) => changeType(row, event.target.value)}
                      value={row.policyType}
                    >
                      <option value="">Selecione</option>
                      {TYPES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <CellLabel>Início</CellLabel>
                    <input
                      aria-label={`Início da linha ${index + 1}`}
                      className={input}
                      onChange={(event) =>
                        update(row.clientRowId, { startsOn: event.target.value })
                      }
                      type="date"
                      value={row.startsOn}
                    />
                  </label>

                  {row.policyType === 'subsidized_financing' ? (
                    <label>
                      <CellLabel>Prazo</CellLabel>
                      <input
                        aria-label={`Prazo da linha ${index + 1}`}
                        className={input}
                        inputMode="numeric"
                        onChange={(event) =>
                          update(row.clientRowId, { termMonths: event.target.value })
                        }
                        placeholder="meses"
                        value={row.termMonths}
                      />
                    </label>
                  ) : row.policyType === 'free_insurance' ? (
                    <label>
                      <CellLabel>Prazo</CellLabel>
                      <select
                        aria-label={`Prazo do seguro da linha ${index + 1}`}
                        className={input}
                        onChange={(event) =>
                          update(row.clientRowId, { termMonths: event.target.value })
                        }
                        value={row.termMonths || '12'}
                      >
                        <option value="12">12 meses</option>
                        <option value="24">24 meses</option>
                        <option value="36">36 meses</option>
                      </select>
                    </label>
                  ) : (
                    <EmptyCell />
                  )}

                  {row.policyType === 'subsidized_financing' ? (
                    <label>
                      <CellLabel>Taxa</CellLabel>
                      <input
                        aria-label={`Taxa da linha ${index + 1}`}
                        className={input}
                        inputMode="decimal"
                        onChange={(event) =>
                          update(row.clientRowId, {
                            customerInterestRateMonthly: formatPtBrPercentageInput(
                              event.target.value,
                            ),
                          })
                        }
                        placeholder="% a.m."
                        value={row.customerInterestRateMonthly}
                      />
                    </label>
                  ) : (
                    <EmptyCell />
                  )}

                  {row.policyType === 'subsidized_financing' ? (
                    <label>
                      <CellLabel>Entrada</CellLabel>
                      <input
                        aria-label={`Entrada da linha ${index + 1}`}
                        className={input}
                        inputMode="decimal"
                        onChange={(event) =>
                          update(row.clientRowId, {
                            downPaymentPercentage: formatPtBrPercentageInput(event.target.value),
                          })
                        }
                        placeholder="%"
                        value={row.downPaymentPercentage}
                      />
                    </label>
                  ) : (
                    <EmptyCell />
                  )}

                  <div>
                    <CellLabel>Valor</CellLabel>
                    {FIXED.has(row.policyType) ? (
                      <input
                        aria-label={`Valor da linha ${index + 1}`}
                        className={input}
                        inputMode="decimal"
                        onChange={(event) => updateMoney(row, event.currentTarget)}
                        placeholder="0,00"
                        value={row.amount}
                      />
                    ) : calculated && preview?.customerBenefitAmount ? (
                      <output className="flex min-h-11 items-center text-sm font-semibold text-sky-200">
                        {brl(preview.customerBenefitAmount)}
                      </output>
                    ) : calculated ? (
                      <span className="flex min-h-11 items-center text-xs text-slate-500">
                        aguardando
                      </span>
                    ) : (
                      <span className="block min-h-11" />
                    )}
                  </div>

                  <div>
                    <CellLabel>Descrição</CellLabel>
                    {row.policyType === 'fuel_or_recharge_voucher' ? (
                      <select
                        aria-label={`Tipo de voucher da linha ${index + 1}`}
                        className={`${input} mb-2`}
                        onChange={(event) =>
                          update(row.clientRowId, { voucherType: event.target.value })
                        }
                        value={row.voucherType || 'unspecified'}
                      >
                        <option value="fuel">Combustível</option>
                        <option value="electric_recharge">Recarga elétrica</option>
                        <option value="unspecified">Não especificado</option>
                      </select>
                    ) : null}
                    <input
                      aria-label={`Descrição da linha ${index + 1}`}
                      className={input}
                      onChange={(event) =>
                        update(row.clientRowId, { description: event.target.value })
                      }
                      placeholder={row.policyType === 'other' ? 'obrigatória' : 'opcional'}
                      value={row.description}
                    />
                  </div>
                </div>
                {messages.length ? (
                  <p className="mt-2 pr-24 text-xs text-rose-300">{messages.join(' ')}</p>
                ) : null}
                <button
                  className="mt-2 min-h-10 text-xs font-semibold text-rose-300 lg:absolute lg:bottom-1 lg:right-3"
                  disabled={index === rows.length - 1 && isEmpty(row)}
                  onClick={() =>
                    setRows((current) => {
                      const remaining = current.filter(
                        (currentRow) => currentRow.clientRowId !== row.clientRowId,
                      );
                      return remaining.length ? remaining : [empty(`row-${next.current++}`)];
                    })
                  }
                  type="button"
                >
                  Remover
                </button>
              </div>
            );
          })}
        </fieldset>
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">{filled}/10 políticas</p>
        <button
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-bold text-slate-950 disabled:opacity-50"
          disabled={pending || filled === 0 || !productId || filled > 10}
        >
          {pending ? 'Salvando…' : 'Salvar políticas'}
        </button>
      </div>
    </form>
  );
}
