import 'server-only';
import { ManualPolicyBatchSupabaseAdapter } from '@compra-car/adapter-supabase';
import type { ManualPolicyBatchActionStateDto } from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { executeManualPolicyBatchCreation } from '@/application/admin/manual-policy-batch';
import { requireRole } from '@/auth/authorization';
const authorize = async () => {
  const identity = await requireRole('admin');
  return { actorId: identity.profile.id };
};
export async function loadManualPolicyBatchOptions() {
  await authorize();
  const repository = new ManualPolicyBatchSupabaseAdapter();
  const [products, prices, references] = await Promise.all([
    repository.listProductOptions(),
    repository.listBasePrices(),
    repository.listFinancialReferences(),
  ]);
  return {
    products: products.map((p) => ({
      id: p.id,
      displayName: `${p.brand} — ${p.model} — ${p.version} — ${p.modelYear}/${p.productionYear}`,
      isActive: p.isActive,
      isPublic: p.isPublic,
    })),
    prices,
    references: references.map((r) => ({
      id: r.id,
      effectiveFrom: r.effectiveFrom,
      validTo: r.validTo,
      label: `v${r.version}: CDI ${r.cdiMonthlyPercentage}% + spread ${r.spreadMonthlyPercentage}% = ${(Number(r.monthlyReferenceRate) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}% a.m.`,
      monthlyReferenceRate: r.monthlyReferenceRate,
    })),
  };
}
export function saveManualPolicyBatch(
  formData: FormData,
): Promise<ManualPolicyBatchActionStateDto> {
  return executeManualPolicyBatchCreation(formData, {
    authorize,
    createRepository: () => new ManualPolicyBatchSupabaseAdapter(),
    createCorrelationId: randomUUID,
    revalidate: revalidatePath,
  });
}
