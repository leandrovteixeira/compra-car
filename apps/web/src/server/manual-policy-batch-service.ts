import 'server-only';
import { ManualPolicyBatchSupabaseAdapter } from '@compra-car/adapter-supabase';
import { formatAdministrativeVehicleName } from '@compra-car/core';
import type { ManualPolicyBatchActionStateDto } from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { executeManualPolicyBatchCreation } from '@/application/admin/manual-policy-batch';
import { requireRole } from '@/auth/authorization';
import { withDevTiming } from '@/server/dev-timing';
const authorize = async () => {
  const identity = await requireRole('admin');
  return { actorId: identity.profile.id };
};
export async function loadManualPolicyBatchOptions() {
  const repository = new ManualPolicyBatchSupabaseAdapter();
  const [products, prices, references] = await Promise.all([
    withDevTiming('pricing.listProductOptions', () => repository.listProductOptions()),
    withDevTiming('pricing.listBasePrices', () => repository.listBasePrices()),
    withDevTiming('pricing.listFinancialReferences', () => repository.listFinancialReferences()),
  ]);
  return {
    products: products.map((p) => ({
      id: p.id,
      displayName: formatAdministrativeVehicleName(p),
      isActive: p.isActive,
      isPublic: p.isPublic,
    })),
    prices,
    references: references.map((r) => ({
      id: r.id,
      effectiveFrom: r.effectiveFrom,
      validTo: r.validTo,
      label: `v${r.version}: CDI ${r.cdiMonthlyPercentage}% + spread ${r.spreadMonthlyPercentage}% = ${percentageFromRate(r.monthlyReferenceRate)}% a.m.`,
      monthlyReferenceRate: r.monthlyReferenceRate,
    })),
  };
}
function percentageFromRate(rate: string): string {
  const [integer, fraction = ''] = rate.split('.');
  const digits = `${integer}${fraction}`.padEnd(integer.length + 6, '0');
  const point = integer.length + 2;
  return `${digits.slice(0, point)}.${digits.slice(point, point + 4)}`.replace(/^0+(?=\d)/u, '');
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
