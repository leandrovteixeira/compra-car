'use client';

import type {
  ManualPriceBatchProductOptionDto,
  OfferBuilderActionStateDto,
  OfferBuilderDraftDto,
  OfferBuilderPolicyDto,
  PolicyCombinationGridRowDto,
} from '@compra-car/contracts';
import {
  calculatePolicyCombinationTotal,
  POLICY_COMBINATION_COLUMNS,
  POLICY_COMBINATION_MAX_ROWS,
  resolvePolicyCombinationCells,
} from '@compra-car/core';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  buildLiveOfferSelections,
  EMPTY_POLICY_COMBINATION_ROW,
} from '@/application/admin/commercial-offer-builder';

type Action = (
  state: OfferBuilderActionStateDto,
  data: FormData,
) => Promise<OfferBuilderActionStateDto>;
type MutationAction = (
  data: FormData,
) => Promise<{ readonly ok: boolean; readonly message: string }>;

const brl = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
const OFFER_STATUS_LABELS = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
} as const;
const sameIds = (left: readonly string[], right: readonly string[]) =>
  [...left].sort().join(',') === [...right].sort().join(',');

function withTrailingEmpty(
  rows: readonly PolicyCombinationGridRowDto[],
  productId: string,
  nextId: () => string,
): readonly PolicyCombinationGridRowDto[] {
  const filled = rows.filter((row) => row.policyIds.length > 0);
  if (filled.length >= POLICY_COMBINATION_MAX_ROWS) return filled;
  return [...filled, { clientRowId: nextId(), productId, policyIds: [] }];
}

export function CommercialOfferBuilder({
  action,
  products,
  policies,
  allPolicies = policies,
  drafts,
  productId,
  onDirty,
  onSaved,
  replaceAction,
  archiveAction,
  onMutation,
  onSelectionChange,
  referenceDate,
  periodEnd,
  periodKind,
}: {
  action: Action;
  products: readonly ManualPriceBatchProductOptionDto[];
  policies: readonly OfferBuilderPolicyDto[];
  allPolicies?: readonly OfferBuilderPolicyDto[];
  drafts: readonly OfferBuilderDraftDto[];
  productId?: string;
  onDirty?: () => void;
  onSaved?: () => void;
  replaceAction?: MutationAction;
  archiveAction?: MutationAction;
  onMutation?: (result: { readonly ok: boolean; readonly message: string }) => void;
  onSelectionChange?: (selections: Readonly<Record<string, readonly string[]>>) => void;
  referenceDate?: string;
  periodEnd?: string;
  periodKind?: 'monthly' | 'special';
}) {
  const initial: OfferBuilderActionStateDto = {
    status: 'idle',
    rows: [EMPTY_POLICY_COMBINATION_ROW],
    rowErrors: {},
  };
  const [state, formAction, pending] = useActionState(action, initial);
  const [rows, setRows] = useState<readonly PolicyCombinationGridRowDto[]>(initial.rows);
  const [existingSelections, setExistingSelections] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});
  const [managementPending, startManagement] = useTransition();
  const sequence = useRef(1);

  useEffect(() => {
    if (state.status === 'success') {
      setRows([{ ...EMPTY_POLICY_COMBINATION_ROW, productId: productId ?? '' }]);
      onSaved?.();
      return;
    }
    setRows(state.rows);
  }, [onSaved, productId, state]);
  useEffect(() => {
    if (productId === undefined) return;
    setRows([{ ...EMPTY_POLICY_COMBINATION_ROW, productId }]);
  }, [productId]);
  useEffect(() => {
    setExistingSelections(
      Object.fromEntries(drafts.map((draft) => [draft.id, [...draft.policyIds]])),
    );
  }, [drafts]);

  const liveSelections = useMemo(
    () => buildLiveOfferSelections(drafts, existingSelections, rows),
    [drafts, existingSelections, rows],
  );
  useEffect(() => {
    onSelectionChange?.(liveSelections);
  }, [liveSelections, onSelectionChange]);

  const change = (clientRowId: string, update: Partial<PolicyCombinationGridRowDto>) => {
    onDirty?.();
    setRows((current) => {
      const next = current.map((row) =>
        row.clientRowId === clientRowId ? { ...row, ...update } : row,
      );
      return withTrailingEmpty(next, productId ?? '', () => `row-${++sequence.current}`);
    });
  };
  const existing = drafts.filter((draft) => !productId || draft.productId === productId);
  const filledCount = rows.filter(
    (row) => row.policyIds.length > 0 || (productId === undefined && Boolean(row.productId)),
  ).length;
  const hasConflict = rows.some(
    (row) =>
      row.productId &&
      Object.values(resolvePolicyCombinationCells(row.productId, policies)).some(
        (cell) => cell.state === 'conflict',
      ),
  );
  const manage = (mutation: MutationAction, data: FormData) =>
    startManagement(async () => {
      const result = await mutation(data);
      onMutation?.(result);
    });

  function changeExisting(
    draft: OfferBuilderDraftDto,
    policyType: OfferBuilderPolicyDto['policyType'],
    checked: boolean,
  ) {
    if (draft.status !== 'draft') return;
    const current = existingSelections[draft.id] ?? draft.policyIds;
    const idsOfType = allPolicies
      .filter((policy) => policy.productId === draft.productId && policy.policyType === policyType)
      .map((policy) => policy.id);
    const withoutType = current.filter((id) => !idsOfType.includes(id));
    const active = policies.filter(
      (policy) => policy.productId === draft.productId && policy.policyType === policyType,
    );
    const persisted = allPolicies.find(
      (policy) => draft.policyIds.includes(policy.id) && policy.policyType === policyType,
    );
    const selected = active.length === 1 ? active[0] : persisted;
    const next = checked && selected ? [...withoutType, selected.id] : withoutType;
    onDirty?.();
    setExistingSelections((selections) => ({ ...selections, [draft.id]: next }));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify(
          rows
            .filter((row) => row.policyIds.length > 0)
            .map((row) => ({ ...row, referenceDate, periodEnd, periodKind })),
        )}
      />
      {state.status !== 'idle' ? (
        <div
          role={state.status === 'success' ? 'status' : 'alert'}
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm ${state.status === 'success' ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
        >
          {state.message}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">
          {existing.length} oferta(s) existente(s) · {filledCount} nova(s) não salva(s)
        </p>
        <p className="text-xs text-slate-400">
          MSRP é resolvido ao salvar; a vigência segue o período comercial.
        </p>
      </div>
      <fieldset
        disabled={pending}
        className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 xl:overflow-visible"
      >
        <table className="w-full min-w-[64rem] table-fixed border-collapse text-xs">
          <thead className="admin-table-header">
            <tr className="border-b border-slate-700 text-slate-300">
              {productId === undefined ? <th className="w-44 p-1.5 text-left">Veículo</th> : null}
              {POLICY_COMBINATION_COLUMNS.map((column) => (
                <th key={column.policyType} className="w-16 p-1.5 text-center">
                  {column.label}
                </th>
              ))}
              <th className="w-28 p-1.5 text-right">Total</th>
              <th className="w-32 p-1.5 text-right">Status / ações</th>
            </tr>
          </thead>
          <tbody>
            {existing.map((draft) => {
              const selection = existingSelections[draft.id] ?? draft.policyIds;
              const selected = allPolicies.filter((policy) => selection.includes(policy.id));
              const editable = draft.status === 'draft';
              const changed = !sameIds(selection, draft.policyIds);
              return (
                <tr
                  key={`offer-${draft.id}`}
                  data-offer-kind="existing"
                  className={`border-b border-slate-700 bg-slate-950/60 align-middle ${draft.status === 'archived' ? 'opacity-65' : ''}`}
                >
                  {productId === undefined ? (
                    <td className="p-2 font-semibold">
                      {products.find((p) => p.id === draft.productId)?.displayName}
                    </td>
                  ) : null}
                  {POLICY_COMBINATION_COLUMNS.map(({ policyType, label }) => {
                    const persisted = allPolicies.find(
                      (policy) =>
                        draft.policyIds.includes(policy.id) && policy.policyType === policyType,
                    );
                    const selectedPolicy = selected.find(
                      (policy) => policy.policyType === policyType,
                    );
                    const active = policies.filter(
                      (policy) =>
                        policy.productId === draft.productId && policy.policyType === policyType,
                    );
                    const selectable = active.length === 1 || Boolean(persisted);
                    return (
                      <td
                        key={policyType}
                        className="p-2 text-center"
                        title={(selectedPolicy ?? persisted)?.title ?? `${label} indisponível`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedPolicy)}
                          disabled={!editable || !selectable || managementPending}
                          aria-label={`${label} da Offer #${draft.id}`}
                          onChange={(event) =>
                            changeExisting(draft, policyType, event.target.checked)
                          }
                          className="h-5 w-5 accent-sky-500 disabled:opacity-60"
                        />
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold text-slate-100">
                    <span>{brl(calculatePolicyCombinationTotal(selected))}</span>
                    <details className="relative ml-2 inline-block text-left font-normal">
                      <summary
                        aria-label={`Informações da Offer #${draft.id}`}
                        className="inline-grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-slate-700 text-sky-200"
                      >
                        i
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 shadow-xl">
                        <strong>Offer #{draft.id}</strong>
                        <p>
                          Vigência: {draft.validFrom} — {draft.validTo ?? 'aberta'}
                        </p>
                        <p>Status: {OFFER_STATUS_LABELS[draft.status]}</p>
                        <p>MSRP: {brl(draft.publicPriceAmount)}</p>
                        <p>Transacional: {brl(draft.transactionalPrice)}</p>
                      </div>
                    </details>
                  </td>
                  <td className="p-2 text-right">
                    <span className="mb-1 block text-xs text-slate-400">
                      {OFFER_STATUS_LABELS[draft.status]}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {editable && changed && replaceAction ? (
                        <button
                          type="button"
                          disabled={managementPending || !selection.length}
                          className="rounded border border-sky-700 px-2 py-1 text-sky-200 disabled:opacity-40"
                          onClick={() => {
                            const data = new FormData();
                            data.set('offerId', draft.id);
                            data.set('lockVersion', String(draft.lockVersion));
                            data.set('policyIds', JSON.stringify(selection));
                            manage(replaceAction, data);
                          }}
                        >
                          Salvar
                        </button>
                      ) : null}
                      {draft.status !== 'archived' && archiveAction ? (
                        <button
                          type="button"
                          disabled={managementPending}
                          className="rounded border border-rose-800 px-2 py-1 text-rose-200 disabled:opacity-40"
                          onClick={() => {
                            if (!window.confirm(`Arquivar Offer #${draft.id}?`)) return;
                            const data = new FormData();
                            data.set('offerId', draft.id);
                            data.set('lockVersion', String(draft.lockVersion));
                            manage(archiveAction, data);
                          }}
                        >
                          Arquivar
                        </button>
                      ) : null}
                      {!editable ? (
                        <span className="text-xs text-slate-500">Somente leitura</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.map((row, index) => {
              const cells = resolvePolicyCombinationCells(row.productId, policies);
              const selected = policies.filter((policy) => row.policyIds.includes(policy.id));
              const errors = state.rowErrors[row.clientRowId] ?? [];
              return (
                <tr
                  key={row.clientRowId}
                  data-offer-kind={row.policyIds.length ? 'new' : 'trailing'}
                  className={`border-b align-middle last:border-0 ${errors.length ? 'border-rose-800 bg-rose-950/20' : 'border-slate-800'}`}
                >
                  {productId === undefined ? (
                    <td className="p-2">
                      <label className="sr-only" htmlFor={`product-${row.clientRowId}`}>
                        Veículo da combinação {index + 1}
                      </label>
                      <select
                        id={`product-${row.clientRowId}`}
                        value={row.productId}
                        onChange={(event) =>
                          change(row.clientRowId, { productId: event.target.value, policyIds: [] })
                        }
                        className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm"
                      >
                        <option value="">Selecione</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.displayName}
                          </option>
                        ))}
                      </select>
                      {errors.map((error) => (
                        <p key={error} className="mt-1 text-rose-300">
                          {error}
                        </p>
                      ))}
                    </td>
                  ) : null}
                  {POLICY_COMBINATION_COLUMNS.map(({ policyType, label }) => {
                    const cell = cells[policyType];
                    if (cell.state !== 'available')
                      return (
                        <td
                          key={policyType}
                          className={`p-2 text-center ${cell.state === 'conflict' ? 'font-semibold text-rose-300' : 'text-slate-600'}`}
                        >
                          {cell.state === 'conflict' ? 'Conflito' : '—'}
                        </td>
                      );
                    const checked = row.policyIds.includes(cell.policy.id);
                    return (
                      <td
                        key={policyType}
                        className="p-2 text-center"
                        title={`${cell.policy.title}${cell.policy.customerBenefitAmount ? ` — ${brl(cell.policy.customerBenefitAmount)}` : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-sky-500"
                          aria-label={`Selecionar ${label} para ${products.find((p) => p.id === row.productId)?.displayName ?? 'veículo'}`}
                          checked={checked}
                          onChange={(event) =>
                            change(row.clientRowId, {
                              policyIds: event.target.checked
                                ? [...row.policyIds, cell.policy.id]
                                : row.policyIds.filter((id) => id !== cell.policy.id),
                            })
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold text-slate-100">
                    {brl(calculatePolicyCombinationTotal(selected))}
                  </td>
                  <td className="p-2 text-right">
                    {errors.map((error) => (
                      <p key={error} className="mb-1 text-xs text-rose-300">
                        {error}
                      </p>
                    ))}
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remover combinação ${index + 1}`}
                        onClick={() =>
                          setRows((current) =>
                            withTrailingEmpty(
                              current.filter((item) => item.clientRowId !== row.clientRowId),
                              productId ?? '',
                              () => `row-${++sequence.current}`,
                            ),
                          )
                        }
                        className="min-h-10 px-2 text-slate-400 hover:text-rose-300"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>
      {hasConflict ? (
        <p role="alert" className="text-sm text-rose-300">
          Resolva os conflitos de políticas antes de salvar.
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          disabled={pending || filledCount === 0 || hasConflict}
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-bold text-slate-950 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar ofertas'}
        </button>
      </div>
    </form>
  );
}
