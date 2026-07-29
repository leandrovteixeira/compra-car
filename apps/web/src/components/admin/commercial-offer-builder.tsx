'use client';
import type {
  ManualPriceBatchProductOptionDto,
  OfferBuilderActionStateDto,
  OfferBuilderDraftDto,
  OfferBuilderFormDto,
  OfferBuilderPolicyDto,
  OfferBuilderPriceDto,
} from '@compra-car/contracts';
import { calculateCommercialOfferBenefit, calculateTransactionalPrice } from '@compra-car/core';
import { useActionState, useEffect, useState } from 'react';
import { EMPTY_OFFER_BUILDER_FORM } from '@/application/admin/commercial-offer-builder';
type Action = (
  state: OfferBuilderActionStateDto,
  data: FormData,
) => Promise<OfferBuilderActionStateDto>;
const brl = (value: string) => {
  const [integer, fraction] = value.split('.');
  return `R$ ${BigInt(integer!).toLocaleString('pt-BR')},${fraction}`;
};
const labels: Readonly<Record<string, string>> = {
  retail_bonus: 'Bônus varejo',
  trade_in_bonus: 'Bônus trade-in',
  subsidized_financing: 'Financiamento subsidiado',
  free_ipva: 'IPVA grátis',
  free_insurance: 'Seguro grátis',
  free_wallbox: 'Wallbox grátis',
  free_registration: 'Emplacamento grátis',
  free_maintenance: 'Manutenção grátis',
  fuel_or_recharge_voucher: 'Voucher combustível/recarga',
  other: 'Outro benefício',
};
export function CommercialOfferBuilder({
  action,
  products,
  prices,
  policies,
  drafts,
}: {
  action: Action;
  products: readonly ManualPriceBatchProductOptionDto[];
  prices: readonly OfferBuilderPriceDto[];
  policies: readonly OfferBuilderPolicyDto[];
  drafts: readonly OfferBuilderDraftDto[];
}) {
  const initial: OfferBuilderActionStateDto = {
    status: 'idle',
    values: EMPTY_OFFER_BUILDER_FORM,
    errors: [],
  };
  const [state, formAction, pending] = useActionState(action, initial);
  const [values, setValues] = useState<OfferBuilderFormDto>(initial.values);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (state.status === 'success') setValues(EMPTY_OFFER_BUILDER_FORM);
    else if (state.status === 'error') setValues(state.values);
  }, [state]);
  const productPrices = prices.filter((p) => p.productId === values.productId);
  const productPolicies = policies.filter((p) => p.productId === values.productId);
  const selected = productPolicies.filter((p) => values.policyIds.includes(p.id));
  let benefit = '0.00',
    transactional: string | null = null;
  const price = productPrices.find((p) => p.id === values.publicPriceId);
  try {
    if (selected.length) benefit = calculateCommercialOfferBenefit(selected, values.productId);
    if (price && selected.length)
      transactional = calculateTransactionalPrice(price.amount, selected, values.productId);
  } catch {
    transactional = null;
  }
  const compatible = (p: OfferBuilderPolicyDto) =>
    Boolean(
      values.validFrom &&
      values.validTo &&
      p.startsOn <= values.validFrom &&
      (p.endsOn === null || p.endsOn >= values.validTo) &&
      p.status !== 'rejected' &&
      p.status !== 'archived' &&
      p.policyType !== 'registration',
    );
  const update = (change: Partial<OfferBuilderFormDto>) =>
    setValues((current) => ({ ...current, ...change }));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="productId" value={values.productId} />
        <input type="hidden" name="publicPriceId" value={values.publicPriceId} />
        <input type="hidden" name="validFrom" value={values.validFrom} />
        <input type="hidden" name="validTo" value={values.validTo} />
        <input type="hidden" name="policyIds" value={JSON.stringify(values.policyIds)} />
        {state.status !== 'idle' && (
          <div
            role={state.status === 'success' ? 'status' : 'alert'}
            aria-live="polite"
            className={`rounded-xl border p-4 text-sm ${state.status === 'success' ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
          >
            {state.message}
            {state.errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        <fieldset disabled={pending} className="space-y-5">
          <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Buscar veículo
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-300">
              Veículo
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                value={values.productId}
                onChange={(e) =>
                  update({ productId: e.target.value, publicPriceId: '', policyIds: [] })
                }
              >
                <option value="">Selecione</option>
                {products
                  .filter((p) =>
                    p.displayName
                      .toLocaleLowerCase('pt-BR')
                      .includes(search.toLocaleLowerCase('pt-BR')),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              MSRP-base
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                value={values.publicPriceId}
                onChange={(e) => {
                  const next = productPrices.find((p) => p.id === e.target.value);
                  update({
                    publicPriceId: e.target.value,
                    validFrom: next?.startsOn ?? values.validFrom,
                    validTo: next?.endsOn ?? values.validTo,
                    policyIds: [],
                  });
                }}
              >
                <option value="">Selecione</option>
                {productPrices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {brl(p.amount)} — {p.startsOn} a {p.endsOn ?? 'sem fim'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Início
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                type="date"
                value={values.validFrom}
                onChange={(e) => update({ validFrom: e.target.value, policyIds: [] })}
              />
            </label>
            <label className="text-sm text-slate-300">
              Fim
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                type="date"
                value={values.validTo}
                onChange={(e) => update({ validTo: e.target.value, policyIds: [] })}
              />
            </label>
          </div>
          <section className="space-y-3" aria-label="Políticas disponíveis">
            <h2 className="text-lg font-semibold text-slate-100">Políticas disponíveis</h2>
            {values.productId && productPolicies.length === 0 ? (
              <p className="rounded-xl border border-slate-800 p-5 text-slate-400">
                Nenhuma política disponível para este veículo.
              </p>
            ) : (
              productPolicies.map((policy) => {
                const enabled = compatible(policy);
                return (
                  <label
                    key={policy.id}
                    className={`flex min-h-11 gap-3 rounded-xl border p-4 ${enabled ? 'border-slate-700 bg-slate-900/50' : 'border-slate-800 opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      disabled={!enabled}
                      checked={values.policyIds.includes(policy.id)}
                      onChange={(e) =>
                        update({
                          policyIds: e.target.checked
                            ? [...values.policyIds, policy.id]
                            : values.policyIds.filter((id) => id !== policy.id),
                        })
                      }
                    />
                    <span>
                      <strong className="block text-slate-100">{policy.title}</strong>
                      <span className="text-sm text-slate-300">
                        {labels[policy.policyType] ?? policy.policyType} ·{' '}
                        {brl(policy.customerBenefitAmount)} ·{' '}
                        {policy.status === 'draft' ? 'Rascunho' : 'Publicado'}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {policy.startsOn} → {policy.endsOn ?? 'sem fim'}
                      </span>
                      {!enabled && (
                        <span className="block text-xs text-amber-300">
                          Não cobre a vigência da oferta ou não pode compor nova oferta.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </section>
        </fieldset>
        <button
          disabled={pending || !transactional || values.policyIds.length === 0}
          className="min-h-11 w-full rounded-xl bg-sky-500 px-5 font-bold text-slate-950 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar oferta em rascunho'}
        </button>
      </form>
      <aside className="space-y-5">
        <section className="sticky top-24 rounded-2xl border border-sky-900 bg-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">Resumo da oferta</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Preço público</dt>
              <dd>{price ? brl(price.amount) : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Benefícios selecionados</dt>
              <dd>{brl(benefit)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-3 text-base font-bold">
              <dt>Preço transacional</dt>
              <dd>{transactional ? brl(transactional) : '—'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            {values.policyIds.length} política(s) explicitamente selecionada(s).
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Rascunhos recentes</h2>
          {drafts.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma oferta em rascunho.</p>
          ) : (
            drafts.map((d) => (
              <article key={d.id} className="mb-3 rounded-xl border border-slate-800 p-4 text-sm">
                <strong>Oferta #{d.id} · Rascunho</strong>
                <p>
                  {d.policyCount} políticas · {brl(d.benefitAmount)}
                </p>
                <p>Transacional: {brl(d.transactionalPrice)}</p>
              </article>
            ))
          )}
        </section>
      </aside>
    </div>
  );
}
