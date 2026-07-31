'use client';

import type {
  ManualPolicyBasePriceDto,
  ManualPolicyBatchActionStateDto,
  ManualPolicyFinancialReferenceDto,
  ManualPriceBatchProductOptionDto,
  OfferBuilderActionStateDto,
  OfferBuilderDraftDto,
  OfferBuilderPolicyDto,
} from '@compra-car/contracts';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { AdminProductCombobox } from './admin-product-combobox';
import { AdminPolicyBatchGrid } from './admin-policy-batch-grid';
import { CommercialOfferBuilder } from './commercial-offer-builder';
import { MANUAL_POLICY_DISPLAY_LABELS } from '@compra-car/core';

const POLICY_STATUS_LABELS = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
  needs_review: 'Em revisão',
  rejected: 'Rejeitado',
} as const;
const badge = 'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold';

type PolicyAction = (
  state: ManualPolicyBatchActionStateDto,
  data: FormData,
) => Promise<ManualPolicyBatchActionStateDto>;
type OfferAction = (
  state: OfferBuilderActionStateDto,
  data: FormData,
) => Promise<OfferBuilderActionStateDto>;
type MutationAction = (
  data: FormData,
) => Promise<{ readonly ok: boolean; readonly message: string }>;

export function CommercialPolicyWorkspace(props: {
  readonly policyAction: PolicyAction;
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
}) {
  const router = useRouter();
  const [productId, setProductId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<OfferBuilderPolicyDto | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedPolicies = props.policies.filter((policy) => policy.productId === productId);
  const markDirty = useCallback(() => setDirty(true), []);
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
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <AdminProductCombobox
          label="Marca, modelo, versão, ano modelo e ano produção"
          onChange={select}
          options={props.products}
          value={productId}
        />
      </section>
      {feedback ? (
        <p
          role={feedback.ok ? 'status' : 'alert'}
          className={`rounded-xl border p-3 text-sm ${feedback.ok ? 'border-emerald-800 text-emerald-200' : 'border-rose-800 text-rose-200'}`}
        >
          {feedback.message}
        </p>
      ) : null}
      {!productId ? (
        <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
          Selecione um veículo para carregar o workspace comercial.
        </p>
      ) : (
        <>
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Políticas</h2>
              <p className="mt-1 text-sm text-slate-400">
                O banco é a fonte da verdade. Após salvar, os dados são recarregados.
              </p>
            </div>
            {selectedPolicies.length ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 lg:overflow-visible">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="admin-table-header bg-slate-900 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Vigência</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Uso</th>
                      <th className="p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selectedPolicies.map((policy) => {
                      const offerIds = props.drafts
                        .filter(
                          (offer) =>
                            offer.productId === productId &&
                            offer.status !== 'archived' &&
                            offer.policyIds?.includes(policy.id),
                        )
                        .map((offer) => offer.id);
                      return (
                        <tr key={policy.id}>
                          <td className="p-3">
                            <span className="font-semibold">
                              {MANUAL_POLICY_DISPLAY_LABELS[policy.policyType] ?? policy.policyType}
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
                              className={`${badge} ${policy.status === 'published' ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300' : policy.status === 'needs_review' ? 'border-amber-800 bg-amber-950/50 text-amber-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                            >
                              {POLICY_STATUS_LABELS[policy.status]}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`${badge} ${offerIds.length ? 'border-sky-800 bg-sky-950/50 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                            >
                              {offerIds.length ? 'Em uso' : 'Livre'}
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
                                  disabled={pending || offerIds.length > 0}
                                  title={
                                    offerIds.length
                                      ? 'Esta política está sendo usada por uma combinação. Altere ou arquive a combinação antes de modificar esta política.'
                                      : undefined
                                  }
                                  onClick={() => setEditingPolicy(policy)}
                                  className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                                >
                                  Editar
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500">Somente leitura</span>
                              )}
                              {policy.status === 'draft' || policy.status === 'published' ? (
                                <button
                                  type="button"
                                  disabled={pending || offerIds.length > 0}
                                  onClick={() => {
                                    if (!window.confirm('Arquivar política?')) return;
                                    const data = new FormData();
                                    data.set('policyId', policy.id);
                                    data.set('lockVersion', String(policy.lockVersion));
                                    mutate(props.archivePolicyAction, data);
                                  }}
                                  className="rounded border border-rose-800 px-2 py-1 text-rose-200 disabled:opacity-40"
                                >
                                  Arquivar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
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
              onDirty={markDirty}
              onSaved={saved}
            />
          </section>
          <section className="space-y-5 border-t border-slate-800 pt-8">
            <h2 className="text-xl font-bold">Combinação de políticas</h2>
            <CommercialOfferBuilder
              action={props.offerAction}
              products={props.products}
              policies={props.policies}
              drafts={props.drafts}
              productId={productId}
              onDirty={markDirty}
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
        </>
      )}
      {editingPolicy ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-policy-title"
          className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/80 p-4"
        >
          <form
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
                className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                name="title"
                defaultValue={editingPolicy.title}
                required
              />
            </label>
            <label className="block">
              Descrição
              <input
                className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                name="description"
                defaultValue={editingPolicy.description ?? ''}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                Início
                <input
                  className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                  type="date"
                  name="startsOn"
                  defaultValue={editingPolicy.startsOn}
                  required
                />
              </label>
              <label>
                Fim
                <input
                  className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3"
                  type="date"
                  name="endsOn"
                  defaultValue={editingPolicy.endsOn ?? ''}
                />
              </label>
            </div>
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
