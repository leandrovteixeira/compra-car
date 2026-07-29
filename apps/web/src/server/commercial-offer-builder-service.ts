import 'server-only';
import { CommercialOfferBuilderSupabaseAdapter } from '@compra-car/adapter-supabase';
import type { OfferBuilderActionStateDto } from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { executeCommercialOfferDraftCreation } from '@/application/admin/commercial-offer-builder';
import { requireRole } from '@/auth/authorization';
const authorize = async () => {
  const identity = await requireRole('admin');
  return { actorId: identity.profile.id };
};
export async function loadCommercialOfferBuilder() {
  await authorize();
  const repository = new CommercialOfferBuilderSupabaseAdapter();
  const [products, prices, policies, drafts] = await Promise.all([
    repository.listProductOptions(),
    repository.listPublishedPrices(),
    repository.listAvailablePolicies(),
    repository.listRecentDrafts(),
  ]);
  return {
    products: products.map((p) => ({
      id: p.id,
      displayName: `${p.brand} — ${p.model} — ${p.version} — ${p.modelYear}/${p.productionYear}`,
      isActive: p.isActive,
      isPublic: p.isPublic,
    })),
    prices: prices.map((price) => ({
      id: price.id,
      productId: price.productId,
      amount: price.amount,
      startsOn: price.startsOn,
      endsOn: price.endsOn,
    })),
    policies,
    drafts: drafts.map((d) => ({
      id: d.id,
      productId: d.productId,
      publicPriceAmount: d.publicPriceAmount!,
      validFrom: d.validFrom,
      validTo: d.validTo,
      status: 'draft' as const,
      policyCount: d.policyIds.length,
      benefitAmount: d.benefitAmount,
      transactionalPrice: d.transactionalPrice,
    })),
  };
}
export function saveCommercialOfferDraft(formData: FormData): Promise<OfferBuilderActionStateDto> {
  return executeCommercialOfferDraftCreation(formData, {
    authorize,
    repository: () => new CommercialOfferBuilderSupabaseAdapter(),
    correlationId: randomUUID,
    revalidate: revalidatePath,
  });
}
