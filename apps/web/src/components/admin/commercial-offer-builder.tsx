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
import { useActionState, useEffect, useRef, useState } from 'react';
import { EMPTY_POLICY_COMBINATION_ROW } from '@/application/admin/commercial-offer-builder';

type Action = (
  state: OfferBuilderActionStateDto,
  data: FormData,
) => Promise<OfferBuilderActionStateDto>;
const brl = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

export function CommercialOfferBuilder({
  action,
  products,
  policies,
  drafts,
}: {
  action: Action;
  products: readonly ManualPriceBatchProductOptionDto[];
  policies: readonly OfferBuilderPolicyDto[];
  drafts: readonly OfferBuilderDraftDto[];
}) {
  const initial: OfferBuilderActionStateDto = {
    status: 'idle',
    rows: [EMPTY_POLICY_COMBINATION_ROW],
    rowErrors: {},
  };
  const [state, formAction, pending] = useActionState(action, initial);
  const [rows, setRows] = useState<readonly PolicyCombinationGridRowDto[]>(initial.rows);
  const sequence = useRef(1);
  useEffect(() => {
    setRows(state.rows);
  }, [state]);
  const change = (clientRowId: string, update: Partial<PolicyCombinationGridRowDto>) => {
    setRows((current) => {
      let next = current.map((row) =>
        row.clientRowId === clientRowId ? { ...row, ...update } : row,
      );
      const last = next.at(-1);
      if (
        last?.productId &&
        last.policyIds.length > 0 &&
        next.length < POLICY_COMBINATION_MAX_ROWS
      ) {
        sequence.current += 1;
        next = [...next, { clientRowId: `row-${sequence.current}`, productId: '', policyIds: [] }];
      }
      return next;
    });
  };
  const filledCount = rows.filter((row) => row.productId || row.policyIds.length).length;
  const hasConflict = rows.some(
    (row) =>
      row.productId &&
      Object.values(resolvePolicyCombinationCells(row.productId, policies)).some(
        (cell) => cell.state === 'conflict',
      ),
  );
  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />
        {state.status !== 'idle' && (
          <div
            role={state.status === 'success' ? 'status' : 'alert'}
            aria-live="polite"
            className={`rounded-xl border p-4 text-sm ${state.status === 'success' ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
          >
            {state.message}
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-300">
            {filledCount}/{POLICY_COMBINATION_MAX_ROWS} combinações preenchidas
          </p>
          <p className="text-xs text-slate-400">MSRP e vigência são derivados ao salvar.</p>
        </div>
        <fieldset
          disabled={pending}
          className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 2xl:overflow-visible"
        >
          <table className="w-full min-w-[76rem] table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="w-52 p-2 text-left">Veículo</th>
                {POLICY_COMBINATION_COLUMNS.map((column) => (
                  <th key={column.policyType} className="w-20 p-2 text-center">
                    {column.label}
                  </th>
                ))}
                <th className="w-28 p-2 text-right">Total</th>
                <th className="w-10">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const cells = resolvePolicyCombinationCells(row.productId, policies);
                const selected = policies.filter((policy) => row.policyIds.includes(policy.id));
                const errors = state.rowErrors[row.clientRowId] ?? [];
                return (
                  <tr
                    key={row.clientRowId}
                    className="border-b border-slate-800 align-middle last:border-0"
                  >
                    <td className="align-middle p-2">
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
                        <p key={error} className="mt-1 text-xs text-rose-300">
                          {error}
                        </p>
                      ))}
                    </td>
                    {POLICY_COMBINATION_COLUMNS.map(({ policyType, label }) => {
                      const cell = cells[policyType];
                      if (cell.state === 'unavailable')
                        return (
                          <td
                            key={policyType}
                            className="align-middle p-2 text-center text-slate-600"
                            title={`${label} indisponível`}
                          >
                            <span aria-hidden>—</span>
                            <span className="sr-only">{label} indisponível</span>
                          </td>
                        );
                      if (cell.state === 'conflict')
                        return (
                          <td
                            key={policyType}
                            className="align-middle p-2 text-center font-semibold text-rose-300"
                            title={`${cell.policies.length} políticas do tipo ${label}`}
                          >
                            Conflito
                          </td>
                        );
                      const checked = row.policyIds.includes(cell.policy.id);
                      return (
                        <td
                          key={policyType}
                          className="align-middle p-2 text-center"
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
                    <td className="align-middle p-2 text-right font-semibold text-slate-100">
                      {brl(calculatePolicyCombinationTotal(selected))}
                    </td>
                    <td className="align-middle p-2 text-center">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remover combinação ${index + 1}`}
                          onClick={() =>
                            setRows((current) =>
                              current.filter((item) => item.clientRowId !== row.clientRowId),
                            )
                          }
                          className="min-h-10 px-2 text-slate-400 hover:text-rose-300"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </fieldset>
        {hasConflict && (
          <p role="alert" className="text-sm text-rose-300">
            Resolva os conflitos de políticas antes de salvar.
          </p>
        )}
        <button
          disabled={pending || filledCount === 0 || hasConflict}
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-bold text-slate-950 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar lote de combinações'}
        </button>
      </form>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Rascunhos recentes</h2>
        {drafts.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma oferta em rascunho.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft) => (
              <article key={draft.id} className="rounded-xl border border-slate-800 p-4 text-sm">
                <strong>Oferta #{draft.id} · Rascunho</strong>
                <p>
                  {draft.policyCount} políticas · {brl(draft.benefitAmount)}
                </p>
                <p>Transacional: {brl(draft.transactionalPrice)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
