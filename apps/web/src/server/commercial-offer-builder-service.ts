import 'server-only';
import { CommercialOfferBuilderSupabaseAdapter } from '@compra-car/adapter-supabase';
import { formatAdministrativeVehicleName } from '@compra-car/core';
import type { OfferBuilderActionStateDto } from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { executePolicyCombinationBatchCreation } from '@/application/admin/commercial-offer-builder';
import { requireRole } from '@/auth/authorization';
import { withDevTiming } from '@/server/dev-timing';
const authorize = async () => {
  const identity = await requireRole('admin');
  return { actorId: identity.profile.id };
};
export async function loadCommercialOfferBuilder(period?: {
  readonly productId: string;
  readonly firstDay: string;
  readonly lastDay: string;
}) {
  const repository = new CommercialOfferBuilderSupabaseAdapter();
  const [products, policies, drafts] = await Promise.all([
    withDevTiming('pricing.listProductOptions', () => repository.listProductOptions()),
    withDevTiming('pricing.listPolicies', () => repository.listAvailablePolicies(period)),
    withDevTiming('pricing.listRecentDrafts', () => repository.listRecentDrafts(period)),
  ]);
  const loadedPolicyIds = new Set(policies.map((policy) => policy.id));
  const missingMembershipPolicyIds = [
    ...new Set(drafts.flatMap((draft) => draft.policyIds).filter((id) => !loadedPolicyIds.has(id))),
  ];
  const linkedPolicies = missingMembershipPolicyIds.length
    ? await withDevTiming('pricing.listMembershipPolicies', () =>
        repository.getPolicyDetails(missingMembershipPolicyIds),
      )
    : [];
  return {
    products: products.map((p) => ({
      id: p.id,
      displayName: formatAdministrativeVehicleName(p),
      isActive: p.isActive,
      isPublic: p.isPublic,
    })),
    policies: [...policies, ...linkedPolicies],
    drafts: drafts.map((d) => ({
      id: d.id,
      productId: d.productId,
      publicPriceAmount: d.publicPriceAmount!,
      validFrom: d.validFrom,
      validTo: d.validTo,
      status: d.status,
      policyCount: d.policyIds.length,
      benefitAmount: d.benefitAmount,
      transactionalPrice: d.transactionalPrice,
      policyIds: d.policyIds,
      lockVersion: d.lockVersion,
    })),
  };
}
export function saveCommercialOfferDraft(formData: FormData): Promise<OfferBuilderActionStateDto> {
  return executePolicyCombinationBatchCreation(formData, {
    authorize,
    repository: () => new CommercialOfferBuilderSupabaseAdapter(),
    correlationId: randomUUID,
    revalidate: revalidatePath,
  });
}
