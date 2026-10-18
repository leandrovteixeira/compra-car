'use client';

import type {
  ManualPolicyBasePriceDto,
  ManualPolicyBatchActionStateDto,
  ManualPolicyFinancialReferenceDto,
  ManualPriceBatchProductOptionDto,
  OfferBuilderActionStateDto,
  OfferBuilderDraftDto,
  OfferBuilderPolicyDto,
  ProductPublicPriceActionStateDto,
} from '@compra-car/contracts';
import { Fragment, useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { AdminProductCombobox } from './admin-product-combobox';
import { ComparisonLoadingOverlay } from './comparison-loading-overlay';
import { AdminPolicyBatchGrid } from './admin-policy-batch-grid';
import { PriceDialog } from './admin-price-manager';
import { CommercialOfferBuilder } from './commercial-offer-builder';
import {
  MANUAL_POLICY_DISPLAY_LABELS,
  resolveCommercialPeriod,
  type CommercialPeriod,
} from '@compra-car/core';
import { monthlyCompetenceOptions } from '@/application/admin/monthly-pricing-context';
import { buildInitialManualPolicyRows } from '@/application/admin/manual-policy-batch';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';

const POLICY_STATUS_LABELS = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
  needs_review: 'Em revisão',
  rejected: 'Rejeitado',
} as const;
const badge = 'inline-flex h-6 items-center justify-center rounded-full border px-2.5 text-xs font-medium';

function previousDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

type PolicyAction = (
  state: ManualPolicyBatchActionStateDto,
  data: FormData,
) => Promise<ManualPolicyBatchActionStateDto>;
type OfferAction = (
  state: OfferBuilderActionStateDto,
  data: FormData,
) => Promise<OfferBuilderActionStateDto>;
type PriceAction = (
  state: ProductPublicPriceActionStateDto,
  data: FormData,
) => Promise<ProductPublicPriceActionStateDto>;
type PublishPriceAction = (
  data: FormData,
) => Promise<{ readonly ok: boolean; readonly message: string }>;
type MutationAction = (
  data: FormData,
) => Promise<{ readonly ok: boolean; readonly message: string }>;

export function CommercialPolicyWorkspace(props: {
  readonly policyAction: PolicyAction;
  readonly priceAction: PriceAction;
  readonly publishPriceAction: PublishPriceAction;
  readonly offerAction: OfferAction;
  readonly products: readonly ManualPriceBatchProductOptionDto[];
  readonly prices: readonly ManualPolicyBasePriceDto[];
  readonly references: readonly ManualPolicyFinancialReferenceDto[];
  readonly policies: readonly OfferBuilderPolicyDto[];
  readonly drafts: readonly OfferBuilderDraftDto[];
  readonly updatePolicyAction: MutationAction;
  readonly archivePolicyAction: MutationAction;
  readonly replaceOfferAction: MutationAction;
  readonly archiveOfferAction: MutationAction;
  readonly initialProductId: string;
  readonly competence: string;
  readonly competenceLabel: string;
  readonly periodFirstDay: string;
  readonly periodLastDay: string;
  readonly commercialPeriod: CommercialPeriod;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(props.initialProductId);
  const [dirty, setDirty] = useState(false);
  const [specialDialogOpen, setSpecialDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [specialStart, setSpecialStart] = useState(props.commercialPeriod.start);
  const [specialEnd, setSpecialEnd] = useState(props.commercialPeriod.end);
  const [specialError, setSpecialError] = useState('');
  const [editingPolicy, setEditingPolicy] = useState<OfferBuilderPolicyDto | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [offerSelectionOverrides, setOfferSelectionOverrides] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});
  const [pending, startTransition] = useTransition();
  const period = props.commercialPeriod;
  const selectedPolicies = props.policies.filter((policy) => policy.productId === productId);
  const periodPolicies = selectedPolicies.filter(
    (policy) =>
      policy.status !== 'archived' &&
      policy.status !== 'rejected' &&
      policy.startsOn <= period.start &&
      (policy.endsOn === null || policy.endsOn >= period.end),
  );
  const historicalPolicies = selectedPolicies.filter(
    (policy) =>
      policy.status !== 'archived' &&
      policy.status !== 'rejected' &&
      policy.endsOn !== null &&
      policy.endsOn < props.periodFirstDay,
  );
  const periodOffers = useMemo(
    () =>
      props.drafts.filter(
        (offer) =>
          offer.productId === productId &&
          offer.validFrom === period.start &&
          offer.validTo === period.end,
      ),
    [period.end, period.start, productId, props.drafts],
  );
  const historicalOffers = props.drafts.filter(
    (offer) =>
      offer.productId === productId &&
      offer.validTo !== null &&
      offer.validTo < props.periodFirstDay,
  );
  const referenceDate = previousDay(period.start);
  const hasOwnPolicies = selectedPolicies.some(
    (policy) => policy.startsOn === period.start && policy.endsOn === period.end,
  );
  const hasOwnOffers = props.drafts.some(
    (offer) =>
      offer.productId === productId &&
      offer.validFrom === period.start &&
      offer.validTo === period.end,
  );
  const basePolicies = useMemo(() => {
    if (hasOwnPolicies) return [];
    const latest = new Map<string, OfferBuilderPolicyDto>();
    for (const policy of props.policies) {
      if (
        policy.productId !== productId ||
        policy.status === 'archived' ||
        policy.status === 'rejected' ||
        policy.startsOn > referenceDate ||
        (policy.endsOn !== null && policy.endsOn < referenceDate)
      )
        continue;
      const current = latest.get(policy.policyType);
      if (!current || current.startsOn < policy.startsOn) latest.set(policy.policyType, policy);
    }
    return [...latest.values()];
  }, [hasOwnPolicies, productId, props.policies, referenceDate]);
  const baseOffers = hasOwnOffers
    ? []
    : props.drafts.filter(
        (offer) =>
          offer.productId === productId &&
          offer.status !== 'archived' &&
          offer.validFrom <= referenceDate &&
          (offer.validTo === null || offer.validTo >= referenceDate),
      );
  const affectedOffers = props.drafts.filter(
    (offer) =>
      offer.productId === productId &&
      offer.status !== 'archived' &&
      offer.validFrom < period.start &&
      (offer.validTo === null || offer.validTo >= period.start),
  );
  const publicPrices = props.prices.filter(
    (price) =>
      price.productId === productId &&
      price.startsOn <= period.start &&
      (price.endsOn === null || price.endsOn >= period.end),
  );
  const copiedRows = useMemo(
    () => buildInitialManualPolicyRows(basePolicies, period.kind),
    [basePolicies, period.kind],
  );
  const competenceOptions = monthlyCompetenceOptions();
  const markDirty = useCallback(() => setDirty(true), []);
  const updateOfferSelections = useCallback(
    (selections: Readonly<Record<string, readonly string[]>>) =>
      setOfferSelectionOverrides(selections),
    [],
  );
  const saved = useCallback(() => {
    setDirty(false);
    setFeedback({ ok: true, message: 'Políticas salvas com sucesso.' });
    router.refresh();
  }, [router]);

  function select(nextProductId: string) {
    if (
      dirty &&
      nextProductId !== productId &&
      !window.confirm('Existem alterações não salvas. Deseja trocar de veículo e descartá-las?')
    )
      return;
    setProductId(nextProductId);
    setDirty(false);
    const query = new URLSearchParams({ competence: props.competence });
    if (nextProductId) query.set('product', nextProductId);
    if (period.kind === 'special') {
      query.set('periodStart', period.start);
      query.set('periodEnd', period.end);
    }
    router.replace(`/admin/prices/policies/input?${query.toString()}`);
  }

  function changeCompetence(nextCompetence: string) {
    if (dirty && !window.confirm('Existem alterações não salvas. Deseja mudar a competência?'))
      return;
    const query = new URLSearchParams({ competence: nextCompetence });
    if (productId) query.set('product', productId);
    setDirty(false);
    router.replace(`/admin/prices/policies/input?${query.toString()}`);
  }

  function changeSpecialMode(checked: boolean) {
    if (checked) {
      setSpecialStart(period.kind === 'special' ? period.start : props.periodFirstDay);
      setSpecialEnd(period.kind === 'special' ? period.end : props.periodLastDay);
      setSpecialError('');
      setSpecialDialogOpen(true);
      return;
    }
    if (dirty && !window.confirm('Existem alterações não salvas. Deseja usar o mês completo?'))
      return;
    const query = new URLSearchParams({ competence: props.competence });
    if (productId) query.set('product', productId);
    setDirty(false);
    router.replace(`/admin/prices/policies/input?${query.toString()}`);
  }

  function confirmSpecialPeriod() {
    const resolution = resolveCommercialPeriod({
      competence: props.competence,
      kind: 'special',
      specialStart,
      specialEnd,
    });
    if (!resolution.ok) {
      setSpecialError(resolution.errors.join(' '));
      return;
    }
    if (dirty && !window.confirm('Existem alterações não salvas. Deseja mudar o período?')) return;
    const query = new URLSearchParams({
      competence: props.competence,
      periodStart: resolution.period.start,
      periodEnd: resolution.period.end,
    });
    if (productId) query.set('product', productId);
    setDirty(false);
    setSpecialDialogOpen(false);
    router.replace(`/admin/prices/policies/input?${query.toString()}`);
  }

  function mutate(action: MutationAction, data: FormData, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action(data);
      setFeedback(result);
      setDirty(false);
      if (result.ok) onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {pending && <ComparisonLoadingOverlay />}
      <section
        data-testid="monthly-operation-header"
        className="grid items-end gap-3 border-b border-[#D6DEE3] bg-transparent pb-3 lg:grid-cols-[minmax(18rem,11fr)_minmax(14rem,5fr)_minmax(13rem,4fr)]"
      >
        <div className="min-w-0">
          <AdminProductCombobox
            label="Modelo / versão"
            onChange={select}
            options={props.products}
            value={productId}
          />
        </div>
        <div>
          <span className={labelClassName}>Competência</span>
          <select
            aria-label="Competência mensal"
            className={`${fieldClassName} mt-1 !h-10 !min-h-10`}
            value={props.competence}
            onChange={(event) => changeCompetence(event.target.value)}
          >
            {competenceOptions.map((option) => (
              <option key={option.competence} value={option.competence}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="mt-1.5 flex min-h-6 items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={period.kind === 'special'}
              onChange={(event) => changeSpecialMode(event.target.checked)}
              className="h-4 w-4 accent-selection-strong"
            />
            Período especial
          </label>
          <p className="mt-0.5 text-xs text-text-muted">
            {period.kind === 'special'
              ? `${props.competenceLabel} · Especial ${period.start.slice(8, 10)}–${period.end.slice(8, 10)}/${period.end.slice(5, 7)}`
              : `${period.start} — ${period.end}`}
          </p>
        </div>
        <aside className="text-sm lg:border-l lg:border-[#D6DEE3] lg:pl-4">
          <span className={labelClassName}>Preço válido</span>
          {publicPrices.length === 1 ? (
            <div className="mt-1 flex min-h-9 items-center">
              <span className="text-sm font-semibold text-text-primary">
                {Number(publicPrices[0]!.amount).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>
          ) : (
            <div className="mt-1">
              {!publicPrices.length ? (
                <button
                  className={buttonClassName({ size: 'action', variant: 'interactive' })}
                  onClick={() => setPriceDialogOpen(true)}
                  type="button"
                >
                  Adicionar preço
                </button>
              ) : null}
              <p className={`${!publicPrices.length ? 'mt-1' : ''} text-xs text-status-warning`}>
                {publicPrices.length
                  ? 'Há mais de um preço público aplicável.'
                  : 'Nenhum preço público aplicável'}
              </p>
            </div>
          )}
        </aside>
      </section>
      {priceDialogOpen ? (
        <PriceDialog
          action={props.priceAction}
          initialValues={{
            id: '',
            productId,
            amount: '',
            startsOn: period.start,
            endsOn: period.end,
            lockVersion: '',
          }}
          key={`new-price-${productId}-${period.start}`}
          onClose={() => setPriceDialogOpen(false)}
          onSuccess={(message) => {
            setPriceDialogOpen(false);
            setFeedback({ ok: true, message });
            router.refresh();
          }}
          publishAction={props.publishPriceAction}
          products={props.products.map((product) => ({
            id: product.id,
            label: product.displayName,
          }))}
        />
      ) : null}
      {feedback ? (
        <p
          role={feedback.ok ? 'status' : 'alert'}
          className={`rounded-md border px-3 py-2 text-sm ${feedback.ok ? 'border-[#AFE3C3] bg-[#F1FAF5] text-[#16854A]' : 'border-[#F0C2BE] bg-[#FFF3F2] text-[#A93732]'}`}
        >
          {feedback.message}
        </p>
      ) : null}
      {!productId ? (
        <p className="border-y border-dashed border-border py-5 text-center text-text-muted">
          Selecione um veículo para carregar o workspace comercial.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-[#1A1D21]">Políticas</h2>
            </div>
            {periodPolicies.length ? (
              <div className="overflow-x-auto rounded-lg border border-[#D6DEE3]">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="admin-table-header bg-[#DCE8ED] text-xs uppercase text-[#61747B]">
                    <tr>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Vigência</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Uso</th>
                      <th className="p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6DEE3]">
                    {periodPolicies.map((policy) => {
                      const offerIds = props.drafts
                        .filter(
                          (offer) =>
                            offer.productId === productId &&
                            offer.status !== 'archived' &&
                            (offerSelectionOverrides[offer.id] ?? offer.policyIds)?.includes(
                              policy.id,
                            ),
                        )
                        .map((offer) => offer.id);
                      const usedByUnsavedOffer = Object.entries(offerSelectionOverrides).some(
                        ([offerId, policyIds]) =>
                          offerId.startsWith('new:') && policyIds.includes(policy.id),
                      );
                      const isUsed = offerIds.length > 0 || usedByUnsavedOffer;
                      return (
                        <Fragment key={policy.id}>
                          <tr>
                            <td className="p-3">
                              <span className="font-semibold">
                                {MANUAL_POLICY_DISPLAY_LABELS[policy.policyType] ??
                                  policy.policyType}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {policy.title}
                              </span>
                            </td>
                            <td className="p-3">
                              {policy.startsOn} — {policy.endsOn ?? 'aberta'}
                            </td>
                            <td className="p-3">
                              R${' '}
                              {Number(policy.customerBenefitAmount ?? 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="p-3">
                              <span
                                className={`${badge} ${policy.status === 'published' ? 'border-[#AFE3C3] bg-[#F1FAF5] text-[#16854A]' : policy.status === 'needs_review' ? 'border-[#EDD19A] bg-[#FFF8E8] text-[#9B6A19]' : 'border-[#D6DEE3] bg-[#F3F5F6] text-[#697786]'}`}
                              >
                                {POLICY_STATUS_LABELS[policy.status]}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`${badge} ${isUsed ? 'border-[#9ABCC8] bg-[#EAF1F4] text-[#357B97]' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                              >
                                {isUsed ? 'Em uso' : 'Livre'}
                              </span>
                              {offerIds.length ? (
                                <span className="mt-1 block text-xs text-slate-500">
                                  {offerIds.map((id) => `#${id}`).join(', ')}
                                </span>
                              ) : null}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {policy.status === 'draft' ? (
                                  <button
                                    type="button"
                                    disabled={pending || isUsed}
                                    title={
                                      isUsed
                                        ? 'Esta política está sendo usada por uma combinação. Altere ou arquive a combinação antes de modificar esta política.'
                                        : undefined
                                    }
                                    onClick={() => setEditingPolicy(policy)}
                                    className="cc-btn cc-btn--p cc-btn--secondary disabled:opacity-40"
                                  >
                                    Editar
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500">Somente leitura</span>
                                )}
                                {policy.status === 'draft' || policy.status === 'published' ? (
                                  <button
                                    type="button"
                                    disabled={pending || isUsed}
                                    onClick={() => {
                                      if (!window.confirm('Arquivar política?')) return;
                                      const data = new FormData();
                                      data.set('policyId', policy.id);
                                      data.set('lockVersion', String(policy.lockVersion));
                                      mutate(props.archivePolicyAction, data);
                                    }}
                                    className="cc-btn cc-btn--p cc-btn--secondary disabled:opacity-40"
                                  >
                                    Arquivar
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Nenhuma política existente. O workspace está pronto para entrada.
              </p>
            )}
            <AdminPolicyBatchGrid
              action={props.policyAction}
              products={props.products}
              prices={props.prices}
              references={props.references}
              productId={productId}
              periodStart={period.start}
              periodEnd={period.end}
              periodKind={period.kind}
              competence={props.competence}
              policies={selectedPolicies}
              initialRows={copiedRows}
              copiedFromPrevious={Boolean(copiedRows.length)}
              baseOffers={baseOffers}
              affectedOffers={affectedOffers}
              onDirty={markDirty}
              onSaved={saved}
            />
          </section>
          <section className="space-y-3 border-t border-[#D6DEE3] pt-4">
            <h2 className="text-base font-semibold text-[#1A1D21]">Ofertas</h2>
            <CommercialOfferBuilder
              action={props.offerAction}
              products={props.products}
              policies={periodPolicies}
              allPolicies={selectedPolicies}
              drafts={periodOffers}
              productId={productId}
              referenceDate={period.start}
              periodEnd={period.end}
              periodKind={period.kind}
              onDirty={markDirty}
              onSelectionChange={updateOfferSelections}
              onSaved={saved}
              replaceAction={props.replaceOfferAction}
              archiveAction={props.archiveOfferAction}
              onMutation={(result) => {
                setFeedback(result);
                setDirty(false);
                router.refresh();
              }}
            />
          </section>
          <details className="rounded-2xl border border-slate-800 p-4">
            <summary className="cursor-pointer font-bold">
              Histórico ({historicalPolicies.length + historicalOffers.length})
            </summary>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {historicalPolicies.map((policy) => (
                <p key={`policy-${policy.id}`}>
                  Policy #{policy.id} ·{' '}
                  {MANUAL_POLICY_DISPLAY_LABELS[policy.policyType] ?? policy.policyType} ·{' '}
                  {policy.startsOn} — {policy.endsOn}
                </p>
              ))}
              {historicalOffers.map((offer) => (
                <p key={`offer-${offer.id}`}>
                  Offer #{offer.id} · {offer.validFrom} — {offer.validTo} · {offer.status}
                </p>
              ))}
              {!historicalPolicies.length && !historicalOffers.length ? (
                <p>Nenhum item anterior carregado.</p>
              ) : null}
            </div>
          </details>
        </>
      )}
      {specialDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="special-period-title"
          className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/80 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 id="special-period-title" className="text-xl font-bold">
              Período especial
            </h2>
            <p className="text-sm text-slate-400">
              As duas datas devem permanecer dentro de {props.competenceLabel}.
            </p>
            <label className="block text-sm font-semibold text-slate-300">
              Início da vigência
              <input
                type="date"
                min={props.periodFirstDay}
                max={props.periodLastDay}
                value={specialStart}
                onChange={(event) => setSpecialStart(event.target.value)}
                className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-300">
              Fim da vigência
              <input
                type="date"
                min={props.periodFirstDay}
                max={props.periodLastDay}
                value={specialEnd}
                onChange={(event) => setSpecialEnd(event.target.value)}
                className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
              />
            </label>
            {specialError ? (
              <p role="alert" className="text-sm text-rose-300">
                {specialError}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="min-h-11 rounded border border-slate-700 px-4"
                onClick={() => setSpecialDialogOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-11 rounded bg-sky-500 px-4 font-bold text-slate-950"
                onClick={confirmSpecialPeriod}
              >
                Aplicar período
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editingPolicy ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-policy-title"
          className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/80 p-4"
        >
          <form
            autoComplete="off"
            className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6"
            action={(data) => mutate(props.updatePolicyAction, data, () => setEditingPolicy(null))}
            onChange={() => setDirty(true)}
          >
            <h2 id="edit-policy-title" className="text-xl font-bold">
              Editar política
            </h2>
            <input type="hidden" name="policyId" value={editingPolicy.id} />
            <input type="hidden" name="lockVersion" value={editingPolicy.lockVersion} />
            <label className="block">
              Título
              <input
                autoComplete="off"
                className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                name="title"
                defaultValue={editingPolicy.title}
                required
              />
            </label>
            <label className="block">
              Descrição
              <input
                autoComplete="off"
                className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                name="description"
                defaultValue={editingPolicy.description ?? ''}
              />
            </label>
            {[
              'retail_bonus',
              'trade_in_bonus',
              'loyalty_bonus',
              'free_wallbox',
              'free_maintenance',
              'fuel_or_recharge_voucher',
              'other',
            ].includes(editingPolicy.policyType) ? (
              <label className="block">
                Valor
                <input
                  autoComplete="off"
                  className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                  name="amount"
                  inputMode="decimal"
                  defaultValue={editingPolicy.customerBenefitAmount ?? ''}
                  required
                />
              </label>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="min-h-11 rounded border border-slate-700 px-4"
                onClick={() => setEditingPolicy(null)}
              >
                Cancelar
              </button>
              <button
                disabled={pending}
                className="min-h-11 rounded bg-sky-500 px-4 font-bold text-slate-950"
              >
                {pending ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
