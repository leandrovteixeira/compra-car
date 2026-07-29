import type {
  ManualPolicyBatchActionStateDto,
  ManualPolicyBatchGridRowDto,
} from '@compra-car/contracts';
import { CreateManualPolicyBatch, type ManualPolicyBatchRepository } from '@compra-car/core';

export const EMPTY_MANUAL_POLICY_BATCH_ROW: ManualPolicyBatchGridRowDto = Object.freeze({
  clientRowId: 'row-1',
  productId: '',
  policyType: '',
  title: '',
  description: '',
  startsOn: '',
  endsOn: '',
  amount: '',
  maintenanceCount: '',
  coverageMonths: '',
  coverageKm: '',
  voucherType: '',
  calculationBasePriceId: '',
  annualRate: '',
  offerMonth: '',
  coverageYears: '',
  termMonths: '',
  customerInterestRateMonthly: '',
  downPaymentPercentage: '',
});
const fields = Object.keys(EMPTY_MANUAL_POLICY_BATCH_ROW);
function validRow(value: unknown): value is ManualPolicyBatchGridRowDto {
  return Boolean(
    value &&
    typeof value === 'object' &&
    fields.every((field) => typeof (value as Record<string, unknown>)[field] === 'string'),
  );
}
export function readManualPolicyBatchRows(
  formData: FormData,
): readonly ManualPolicyBatchGridRowDto[] | null {
  const payload = formData.get('rows');
  if (typeof payload !== 'string' || payload.length > 250000) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return Array.isArray(parsed) && parsed.length <= 101 && parsed.every(validRow) ? parsed : null;
  } catch {
    return null;
  }
}
export async function executeManualPolicyBatchCreation(
  formData: FormData,
  deps: {
    authorize: () => Promise<{ actorId: string }>;
    createRepository: () => ManualPolicyBatchRepository;
    createCorrelationId: () => string;
    revalidate: (path: string) => void;
  },
): Promise<ManualPolicyBatchActionStateDto> {
  const { actorId } = await deps.authorize();
  const rows = readManualPolicyBatchRows(formData);
  if (!rows)
    return {
      status: 'error',
      rows: [EMPTY_MANUAL_POLICY_BATCH_ROW],
      rowErrors: {},
      message: 'O lote enviado é inválido.',
    };
  try {
    const result = await new CreateManualPolicyBatch(deps.createRepository()).execute(
      rows.map((row) => ({ ...row, endsOn: row.endsOn || null })),
      { actorId, correlationId: deps.createCorrelationId() },
    );
    if (!result.ok) {
      const rowErrors: Record<string, Record<string, readonly string[]>> = {};
      for (const issue of result.issues) {
        const current = rowErrors[issue.clientRowId] ?? {};
        current[issue.field] = [...(current[issue.field] ?? []), issue.message];
        rowErrors[issue.clientRowId] = current;
      }
      return {
        status: 'error',
        rows,
        rowErrors,
        message: 'Revise as linhas destacadas. Nenhuma policy foi criada.',
      };
    }
    deps.revalidate('/admin/prices');
    deps.revalidate('/admin/prices/policies/input');
    return {
      status: 'success',
      rows: [EMPTY_MANUAL_POLICY_BATCH_ROW],
      rowErrors: {},
      message: `${result.batch.createdCount} policy(s) criada(s) como rascunho.`,
      batchId: result.batch.batchId,
      createdCount: result.batch.createdCount,
    };
  } catch {
    console.error('Manual policy batch creation failed.');
    return {
      status: 'error',
      rows,
      rowErrors: {},
      message: 'Não foi possível salvar o lote. Nenhuma policy foi criada.',
    };
  }
}
