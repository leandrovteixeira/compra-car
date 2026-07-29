'use client';
import type {
  ManualPolicyBasePriceDto,
  ManualPolicyBatchActionStateDto,
  ManualPolicyBatchGridRowDto,
  ManualPriceBatchProductOptionDto,
  ManualPolicyFinancialReferenceDto,
} from '@compra-car/contracts';
import { calculateManualPolicyBenefit } from '@compra-car/core';
import { useActionState, useEffect, useRef, useState } from 'react';
import { EMPTY_MANUAL_POLICY_BATCH_ROW } from '@/application/admin/manual-policy-batch';
const TYPES = [
  ['retail_bonus', 'Bônus varejo'],
  ['trade_in_bonus', 'Bônus trade-in'],
  ['subsidized_financing', 'Financiamento subsidiado'],
  ['free_ipva', 'IPVA grátis'],
  ['free_insurance', 'Seguro grátis'],
  ['free_wallbox', 'Wallbox grátis'],
  ['free_registration', 'Emplacamento grátis'],
  ['free_maintenance', 'Manutenção grátis'],
  ['fuel_or_recharge_voucher', 'Voucher combustível/recarga'],
  ['other', 'Outro benefício'],
] as const;
const FIXED = new Set([
  'retail_bonus',
  'trade_in_bonus',
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
const isEmpty = (r: ManualPolicyBatchGridRowDto) =>
  !r.productId && !r.policyType && !r.title && !r.startsOn;
export function AdminPolicyBatchGrid({
  action,
  products,
  prices,
  references,
}: {
  action: Action;
  products: readonly ManualPriceBatchProductOptionDto[];
  prices: readonly ManualPolicyBasePriceDto[];
  references: readonly ManualPolicyFinancialReferenceDto[];
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
    if (state.status === 'success') setRows([empty(`row-${next.current++}`)]);
    else {
      const submitted = [...state.rows];
      if (!isEmpty(submitted.at(-1)!)) submitted.push(empty(`row-${next.current++}`));
      setRows(submitted);
    }
  }, [state]);
  const update = (id: string, change: Partial<ManualPolicyBatchGridRowDto>) =>
    setRows((current) => {
      const result = current.map((r) => (r.clientRowId === id ? { ...r, ...change } : r));
      if (!isEmpty(result.at(-1)!) && result.filter((r) => !isEmpty(r)).length <= 100)
        result.push(empty(`row-${next.current++}`));
      return result;
    });
  const changeType = (id: string, policyType: string) =>
    update(id, {
      ...empty(id),
      policyType,
      productId: rows.find((r) => r.clientRowId === id)?.productId ?? '',
      title: rows.find((r) => r.clientRowId === id)?.title ?? '',
      description: '',
      startsOn: rows.find((r) => r.clientRowId === id)?.startsOn ?? '',
      endsOn: rows.find((r) => r.clientRowId === id)?.endsOn ?? '',
    });
  const input =
    'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-sky-500';
  const filled = rows.filter((r) => !isEmpty(r)).length;
  return (
    <form action={formAction} className="space-y-5">
      <input name="rows" type="hidden" value={JSON.stringify(rows)} />
      {state.status !== 'idle' && (
        <div
          aria-live="polite"
          role={state.status === 'success' ? 'status' : 'alert'}
          className={`rounded-xl border p-4 text-sm ${state.status === 'success' ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
        >
          {state.message}
        </div>
      )}
      <fieldset disabled={pending} className="space-y-4">
        {rows.map((row, index) => {
          const errors = state.rowErrors[row.clientRowId] ?? {};
          const applicable = prices.filter((p) => p.productId === row.productId);
          const selectedPrice = applicable.find((price) => price.id === row.calculationBasePriceId);
          const selectedReference = references.find(
            (reference) =>
              reference.effectiveFrom <= row.startsOn &&
              (reference.validTo === null ||
                Boolean(row.endsOn && reference.validTo >= row.endsOn)),
          );
          const preview = calculateManualPolicyBenefit(
            { ...row, endsOn: row.endsOn || null },
            {
              basePriceAmount: selectedPrice?.amount,
              financialParameterSetId: selectedReference?.id,
              monthlyReferenceRate: selectedReference?.monthlyReferenceRate,
            },
          );
          return (
            <article
              key={row.clientRowId}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-slate-400">
                  Veículo
                  <select
                    className={input}
                    value={row.productId}
                    onChange={(e) =>
                      update(row.clientRowId, {
                        productId: e.target.value,
                        calculationBasePriceId: '',
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Tipo
                  <select
                    className={input}
                    value={row.policyType}
                    onChange={(e) => changeType(row.clientRowId, e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {TYPES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Título
                  <input
                    className={input}
                    value={row.title}
                    onChange={(e) => update(row.clientRowId, { title: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Início
                  <input
                    type="date"
                    className={input}
                    value={row.startsOn}
                    onChange={(e) => update(row.clientRowId, { startsOn: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Fim (opcional)
                  <input
                    type="date"
                    className={input}
                    value={row.endsOn}
                    onChange={(e) => update(row.clientRowId, { endsOn: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Descrição{row.policyType === 'other' ? ' *' : ''}
                  <input
                    className={input}
                    value={row.description}
                    onChange={(e) => update(row.clientRowId, { description: e.target.value })}
                  />
                </label>
                {FIXED.has(row.policyType) && (
                  <label className="text-xs text-slate-400">
                    Benefício (BRL)
                    <input
                      inputMode="decimal"
                      className={input}
                      value={row.amount}
                      onChange={(e) => update(row.clientRowId, { amount: e.target.value })}
                    />
                  </label>
                )}
                {[
                  'free_registration',
                  'free_ipva',
                  'free_insurance',
                  'subsidized_financing',
                ].includes(row.policyType) && (
                  <label className="text-xs text-slate-400">
                    MSRP publicado
                    <select
                      className={input}
                      value={row.calculationBasePriceId}
                      onChange={(e) =>
                        update(row.clientRowId, { calculationBasePriceId: e.target.value })
                      }
                    >
                      <option value="">Selecione</option>
                      {applicable.map((p) => (
                        <option key={p.id} value={p.id}>
                          R$ {p.amount} — {p.startsOn}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {row.policyType === 'free_ipva' && (
                  <>
                    <label className="text-xs text-slate-400">
                      Alíquota anual
                      <input
                        className={input}
                        inputMode="decimal"
                        value={row.annualRate}
                        onChange={(e) => update(row.clientRowId, { annualRate: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Mês da oferta
                      <input
                        className={input}
                        type="number"
                        min="1"
                        max="12"
                        value={row.offerMonth}
                        onChange={(e) => update(row.clientRowId, { offerMonth: e.target.value })}
                      />
                    </label>
                    <p className="self-end text-sm text-slate-300">
                      Meses restantes: {row.offerMonth ? 13 - Number(row.offerMonth) : '—'}
                    </p>
                  </>
                )}
                {row.policyType === 'free_insurance' && (
                  <>
                    <label className="text-xs text-slate-400">
                      Taxa anual
                      <input
                        className={input}
                        value={row.annualRate}
                        onChange={(e) => update(row.clientRowId, { annualRate: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Anos de cobertura
                      <input
                        className={input}
                        value={row.coverageYears}
                        onChange={(e) => update(row.clientRowId, { coverageYears: e.target.value })}
                      />
                    </label>
                  </>
                )}
                {row.policyType === 'subsidized_financing' && (
                  <>
                    <label className="text-xs text-slate-400">
                      Prazo (meses)
                      <input
                        className={input}
                        type="number"
                        value={row.termMonths}
                        onChange={(e) => update(row.clientRowId, { termMonths: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Taxa cliente % a.m.
                      <input
                        className={input}
                        value={row.customerInterestRateMonthly}
                        onChange={(e) =>
                          update(row.clientRowId, { customerInterestRateMonthly: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Entrada %
                      <input
                        className={input}
                        value={row.downPaymentPercentage}
                        onChange={(e) =>
                          update(row.clientRowId, { downPaymentPercentage: e.target.value })
                        }
                      />
                    </label>
                    <p className="self-end text-xs text-slate-300">
                      Referência:{' '}
                      {references.find(
                        (r) =>
                          r.effectiveFrom <= row.startsOn &&
                          (r.validTo === null || Boolean(row.endsOn && r.validTo >= row.endsOn)),
                      )?.label ?? 'não disponível'}
                    </p>
                  </>
                )}
                {row.policyType === 'fuel_or_recharge_voucher' && (
                  <label className="text-xs text-slate-400">
                    Voucher
                    <select
                      className={input}
                      value={row.voucherType}
                      onChange={(e) => update(row.clientRowId, { voucherType: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      <option value="fuel">Combustível</option>
                      <option value="electric_recharge">Recarga elétrica</option>
                      <option value="unspecified">Não especificado</option>
                    </select>
                  </label>
                )}
                {row.policyType === 'free_maintenance' && (
                  <>
                    <label className="text-xs text-slate-400">
                      Revisões
                      <input
                        className={input}
                        type="number"
                        value={row.maintenanceCount}
                        onChange={(e) =>
                          update(row.clientRowId, { maintenanceCount: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Meses
                      <input
                        className={input}
                        type="number"
                        value={row.coverageMonths}
                        onChange={(e) =>
                          update(row.clientRowId, { coverageMonths: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Quilômetros
                      <input
                        className={input}
                        value={row.coverageKm}
                        onChange={(e) => update(row.clientRowId, { coverageKm: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
              {!isEmpty(row) ? (
                <p className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-sm text-slate-300">
                  Benefício calculado:{' '}
                  <strong className="text-sky-300">
                    {preview?.customerBenefitAmount
                      ? `R$ ${preview.customerBenefitAmount}`
                      : 'aguardando parâmetros válidos'}
                  </strong>
                  {preview?.financedPrincipal
                    ? ` · Principal financiado: R$ ${preview.financedPrincipal}`
                    : ''}
                </p>
              ) : null}
              {Object.values(errors)
                .flat()
                .map((message) => (
                  <p key={message} className="mt-2 text-xs text-rose-300">
                    {message}
                  </p>
                ))}
              <button
                type="button"
                disabled={index === rows.length - 1 && isEmpty(row)}
                onClick={() =>
                  setRows((current) => current.filter((r) => r.clientRowId !== row.clientRowId))
                }
                className="mt-3 min-h-11 text-sm text-rose-300"
              >
                Remover linha
              </button>
            </article>
          );
        })}
      </fieldset>
      <div className="flex justify-between">
        <p className="text-sm text-slate-400">{filled}/100 policies</p>
        <button
          disabled={pending || filled === 0}
          className="min-h-11 rounded-xl bg-sky-500 px-5 font-bold text-slate-950"
        >
          {pending ? 'Salvando lote…' : 'Salvar lote de policies'}
        </button>
      </div>
    </form>
  );
}
