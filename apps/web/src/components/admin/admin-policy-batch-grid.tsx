'use client';

import type {
  ManualPolicyBasePriceDto,
  ManualPolicyBatchActionStateDto,
  ManualPolicyBatchGridRowDto,
  ManualPolicyFinancialReferenceDto,
  ManualPriceBatchProductOptionDto,
  OfferBuilderDraftDto,
  OfferBuilderPolicyDto,
} from '@compra-car/contracts';
import {
  formatPtBrMoneyInput,
  formatPtBrPercentageInput,
  MANUAL_POLICY_DISPLAY_LABELS,
  MANUAL_POLICY_TITLES,
  ptBrMoneyCaretPosition,
  type CommercialPeriodKind,
} from '@compra-car/core';
import { useActionState, useEffect, useRef, useState } from 'react';

import {
  buildCopiedCommercialPeriodOffers,
  buildManualPolicyPreview,
  EMPTY_MANUAL_POLICY_BATCH_ROW,
  resolveManualPolicyPredecessor,
} from '@/application/admin/manual-policy-batch';
import { AdminProductCombobox } from '@/components/admin/admin-product-combobox';

const TYPES = Object.entries(MANUAL_POLICY_DISPLAY_LABELS);
const FIXED = new Set([
  'retail_bonus',
  'invoice_discount',
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
    ([field, value]) =>
      field === 'clientRowId' ||
      field === 'sourcePolicyId' ||
      field === 'rebateAmount' ||
      value == null ||
      String(value).trim() === '',
  );
const gridWithProduct =
  'grid gap-3 lg:grid-cols-[minmax(12rem,2fr)_minmax(8rem,1fr)_4.25rem_4.75rem_4.5rem_minmax(7.5rem,1fr)_minmax(7.5rem,1fr)_5.5rem]';
const workspaceGrid =
  'grid gap-3 lg:grid-cols-[minmax(10rem,2fr)_4.25rem_4.75rem_4.5rem_minmax(8rem,1.2fr)_minmax(8rem,1.2fr)_5.5rem]';
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

function DescriptionDialog({
  onClose,
  onChange,
  rowNumber,
  value,
}: {
  readonly onClose: () => void;
  readonly onChange: (value: string) => void;
  readonly rowNumber: number;
  readonly value: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      aria-labelledby="policy-description-title"
      className="m-auto w-[min(92vw,36rem)] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/85"
      onCancel={onClose}
      onClose={onClose}
      ref={ref}
    >
      <h2 className="text-xl font-bold" id="policy-description-title">
        Descrição opcional
      </h2>
      <textarea
        aria-label={`Descrição da linha ${rowNumber}`}
        autoComplete="off"
        autoFocus
        className={`${input} mt-4 min-h-32 py-3`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      <div className="mt-5 flex justify-end">
        <button
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          onClick={() => ref.current?.close()}
          type="button"
        >
          Concluir
        </button>
      </div>
    </dialog>
  );
}

export function AdminPolicyBatchGrid({
  action,
  products,
  prices,
  references,
  productId,
  onDirty,
  onSaved,
  periodStart,
  periodEnd,
  periodKind,
  competence,
  policies,
  initialRows = [],
  copiedFromPrevious = false,
  baseOffers = [],
  affectedOffers = [],
}: {
  readonly action: Action;
  readonly products: readonly ManualPriceBatchProductOptionDto[];
  readonly prices: readonly ManualPolicyBasePriceDto[];
  readonly references: readonly ManualPolicyFinancialReferenceDto[];
  readonly productId?: string;
  readonly onDirty?: () => void;
  readonly onSaved?: () => void;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly periodKind: CommercialPeriodKind;
  readonly competence: string;
  readonly policies: readonly OfferBuilderPolicyDto[];
  readonly initialRows?: readonly ManualPolicyBatchGridRowDto[];
  readonly copiedFromPrevious?: boolean;
  readonly baseOffers?: readonly OfferBuilderDraftDto[];
  readonly affectedOffers?: readonly OfferBuilderDraftDto[];
}) {
  const initialGridRows = initialRows.length
    ? [...initialRows, empty(`row-${initialRows.length + 1}`)]
    : [EMPTY_MANUAL_POLICY_BATCH_ROW];
  const initial: ManualPolicyBatchActionStateDto = {
    status: 'idle',
    rows: initialGridRows,
    rowErrors: {},
  };
  const [state, formAction, pending] = useActionState(action, initial);
  const [rows, setRows] = useState(initial.rows);
  const [descriptionRowId, setDescriptionRowId] = useState<string | null>(null);
  const next = useRef(initialRows.length + 2);

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
    setRows(
      initialRows.length
        ? [...initialRows, empty(`row-${next.current++}`)]
        : [empty(`row-${next.current++}`)],
    );
  }, [initialRows, periodEnd, periodStart, productId]);

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

  function updateMoney(
    row: ManualPolicyBatchGridRowDto,
    field: 'amount' | 'rebateAmount',
    element: HTMLInputElement,
  ) {
    const raw = element.value;
    const formatted = formatPtBrMoneyInput(raw);
    const caret = ptBrMoneyCaretPosition(raw, formatted, element.selectionStart);
    update(row.clientRowId, { [field]: formatted });
    requestAnimationFrame(() => {
      if (document.activeElement !== element || caret === null) return;
      element.setSelectionRange(caret, caret);
    });
  }

  function changeType(row: ManualPolicyBatchGridRowDto, policyType: string) {
    update(row.clientRowId, {
      ...empty(row.clientRowId),
      sourcePolicyId: row.sourcePolicyId,
      productId: row.productId,
      policyType,
      title: MANUAL_POLICY_TITLES[policyType] ?? '',
      startsOn: row.startsOn,
      description: row.description,
      rebateAmount: row.rebateAmount,
      termMonths: policyType === 'free_insurance' ? '12' : '',
      voucherType: policyType === 'fuel_or_recharge_voucher' ? 'unspecified' : '',
    });
  }

  const filled = rows.filter((row) => !isEmpty(row)).length;
  const predecessorFor = (row: ManualPolicyBatchGridRowDto) =>
    resolveManualPolicyPredecessor(row, policies, productId ?? row.productId, periodStart);
  const grid = productId === undefined ? gridWithProduct : workspaceGrid;
  const rolloverCount = rows.filter((row) => !isEmpty(row) && predecessorFor(row)).length;
  const validPeriod =
    periodStart.startsWith(`${competence}-`) && periodEnd.startsWith(`${competence}-`);
  const submittedRows = rows
    .filter((row) => !isEmpty(row))
    .map((row) => {
      const predecessor = predecessorFor(row);
      return {
        ...row,
        productId: productId ?? row.productId,
        startsOn: periodStart,
        endsOn: periodEnd,
        expectedPredecessorId: predecessor?.id ?? '',
        expectedPredecessorLockVersion: predecessor ? String(predecessor.lockVersion) : '',
      };
    });
  const { rows: offerRows, unresolvedMembershipCount } = buildCopiedCommercialPeriodOffers(
    baseOffers,
    policies,
    submittedRows,
    periodStart,
    periodEnd,
  );
  return (
    <form action={formAction} autoComplete="off" className="space-y-5">
      <input type="hidden" name="competence" value={competence} />
      <input type="hidden" name="periodKind" value={periodKind} />
      <input type="hidden" name="periodStart" value={periodStart} />
      <input type="hidden" name="periodEnd" value={periodEnd} />
      <input type="hidden" name="offerRows" value={JSON.stringify(offerRows)} />
      <input
        type="hidden"
        name="expectedOffers"
        value={JSON.stringify(
          affectedOffers.map((offer) => ({
            offerId: offer.id,
            expectedLockVersion: offer.lockVersion,
          })),
        )}
      />
      <input name="rows" type="hidden" value={JSON.stringify(submittedRows)} />
      {state.status !== 'idle' ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm ${state.status === 'success' ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
          role={state.status === 'success' ? 'status' : 'alert'}
        >
          {state.message}
        </div>
      ) : null}

      {copiedFromPrevious && initialRows.length ? (
        <p className="rounded-xl border border-sky-900 bg-sky-950/30 px-4 py-3 text-sm text-sky-200">
          Valores copiados do período anterior. Revise antes de salvar; nada foi persistido.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50 lg:overflow-x-visible">
        <div
          className={`${grid} admin-table-header hidden border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 lg:grid`}
        >
          {productId === undefined ? <span>Veículo</span> : null}
          <span>Tipo</span>
          <span>Prazo</span>
          <span>Taxa</span>
          <span>Entrada</span>
          <span>Valor</span>
          <span>Rebate</span>
          <span className="text-center">Ações</span>
        </div>
        <fieldset disabled={pending}>
          {rows.map((row, index) => {
            const errors = state.rowErrors[row.clientRowId] ?? {};
            const { benefit: preview } = buildManualPolicyPreview(
              row,
              productId,
              periodStart,
              prices,
              references,
            );
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
                  ) : null}
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
                  {row.policyType === 'subsidized_financing' ? (
                    <label>
                      <CellLabel>Prazo</CellLabel>
                      <input
                        aria-label={`Prazo da linha ${index + 1}`}
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
                        className={input}
                        inputMode="decimal"
                        onChange={(event) => updateMoney(row, 'amount', event.currentTarget)}
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
                    <CellLabel>Rebate</CellLabel>
                    <input
                      aria-label={`Rebate da linha ${index + 1}`}
                      autoComplete="off"
                      className={input}
                      inputMode="decimal"
                      onChange={(event) => updateMoney(row, 'rebateAmount', event.currentTarget)}
                      placeholder="0,00"
                      value={row.rebateAmount}
                    />
                    {row.policyType === 'fuel_or_recharge_voucher' ? (
                      <select
                        aria-label={`Tipo de voucher da linha ${index + 1}`}
                        className={`${input} mt-2`}
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
                  </div>
                  <div className="flex min-h-11 items-center justify-center gap-2">
                    <button
                      aria-label={`Editar descrição da política ${index + 1}`}
                      className={`inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${row.description.trim() ? 'border-sky-500 bg-sky-950 text-sky-200' : 'border-slate-700 text-slate-300'}`}
                      onClick={() => setDescriptionRowId(row.clientRowId)}
                      title={
                        row.description.trim()
                          ? 'Editar descrição preenchida'
                          : 'Adicionar descrição'
                      }
                      type="button"
                    >
                      +
                    </button>
                    <button
                      className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rose-800 text-lg font-semibold text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:opacity-40"
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
                      aria-label={`Remover política ${index + 1}`}
                      title="Remover política"
                    >
                      ⊖
                    </button>
                  </div>
                </div>
                {messages.length ? (
                  <p className="mt-2 text-xs text-rose-300">{messages.join(' ')}</p>
                ) : null}
                {descriptionRowId === row.clientRowId ? (
                  <DescriptionDialog
                    onChange={(description) => update(row.clientRowId, { description })}
                    onClose={() => setDescriptionRowId(null)}
                    rowNumber={index + 1}
                    value={row.description}
                  />
                ) : null}
              </div>
            );
          })}
        </fieldset>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-slate-400">
          <p>{filled}/10 políticas</p>
          {rolloverCount ? (
            <p className="mt-1 text-amber-300">
              {rolloverCount} política(s) anterior(es) será(ão) encerrada(s) no dia anterior.
            </p>
          ) : null}
          {unresolvedMembershipCount ? (
            <p className="mt-1 text-rose-300" role="alert">
              Não foi possível relacionar {unresolvedMembershipCount} Policy(s) da Offer anterior às
              linhas copiadas.
            </p>
          ) : null}
        </div>
        <button
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-bold text-slate-950 disabled:opacity-50"
          disabled={
            pending ||
            filled === 0 ||
            !productId ||
            filled > 10 ||
            !validPeriod ||
            unresolvedMembershipCount > 0
          }
        >
          {pending ? 'Salvando…' : 'Salvar políticas'}
        </button>
      </div>
    </form>
  );
}
