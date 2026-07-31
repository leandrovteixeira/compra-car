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
export async function loadCommercialOfferBuilder() {
  const repository = new CommercialOfferBuilderSupabaseAdapter();
  const [products, policies, drafts] = await Promise.all([
    withDevTiming('pricing.listProductOptions', () => repository.listProductOptions()),
    withDevTiming('pricing.listPolicies', () => repository.listAvailablePolicies()),
    withDevTiming('pricing.listRecentDrafts', () => repository.listRecentDrafts()),
  ]);
  return {
    products: products.map((p) => ({
      id: p.id,
      displayName: formatAdministrativeVehicleName(p),
      isActive: p.isActive,
      isPublic: p.isPublic,
    })),
    policies,
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
