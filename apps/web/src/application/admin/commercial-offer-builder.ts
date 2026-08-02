import type {
  OfferBuilderDraftDto,
  OfferBuilderActionStateDto,
  PolicyCombinationGridRowDto,
} from '@compra-car/contracts';
import {
  CreatePolicyCombinationBatch,
  POLICY_COMBINATION_MAX_ROWS,
  type CommercialOfferBuilderRepository,
} from '@compra-car/core';

export const EMPTY_POLICY_COMBINATION_ROW: PolicyCombinationGridRowDto = Object.freeze({
  clientRowId: 'row-1',
  productId: '',
  policyIds: [],
});

export function buildLiveOfferSelections(
  drafts: readonly OfferBuilderDraftDto[],
  existingSelections: Readonly<Record<string, readonly string[]>>,
  rows: readonly PolicyCombinationGridRowDto[],
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries([
    ...drafts.map((draft) => [draft.id, existingSelections[draft.id] ?? draft.policyIds] as const),
    ...rows
      .filter((row) => row.policyIds.length > 0)
      .map((row) => [`new:${row.clientRowId}`, row.policyIds] as const),
  ]);
}

function read(formData: FormData): readonly PolicyCombinationGridRowDto[] | null {
  const raw = formData.get('rows');
  if (typeof raw !== 'string') return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > POLICY_COMBINATION_MAX_ROWS + 1) return null;
    return value.every((row) => {
      if (typeof row !== 'object' || row === null) return false;
      const item = row as Record<string, unknown>;
      return (
        typeof item.clientRowId === 'string' &&
        typeof item.productId === 'string' &&
        Array.isArray(item.policyIds) &&
        item.policyIds.every((id) => typeof id === 'string')
      );
    })
      ? (value as PolicyCombinationGridRowDto[])
      : null;
  } catch {
    return null;
  }
}

export async function executePolicyCombinationBatchCreation(
  formData: FormData,
  deps: {
    authorize: () => Promise<{ actorId: string }>;
    repository: () => CommercialOfferBuilderRepository;
    correlationId: () => string;
    revalidate: (path: string) => void;
  },
): Promise<OfferBuilderActionStateDto> {
  const { actorId } = await deps.authorize();
  const rows = read(formData);
  if (!rows)
    return {
      status: 'error',
      rows: [EMPTY_POLICY_COMBINATION_ROW],
      rowErrors: {},
      message: 'Os dados do lote de combinações são inválidos.',
    };
  const correlationId = deps.correlationId();
  try {
    const result = await new CreatePolicyCombinationBatch(deps.repository()).execute(rows, {
      actorId,
      correlationId,
    });
    if (!result.ok) {
      const rowErrors = result.issues.reduce<Record<string, string[]>>((all, issue) => {
        (all[issue.clientRowId] ??= []).push(issue.message);
        return all;
      }, {});
      return {
        status: 'error',
        rows,
        rowErrors,
        message: `Revise as combinações. Nenhuma oferta foi criada. Referência: ${correlationId}`,
      };
    }
    deps.revalidate('/admin/prices/offers');
    return {
      status: 'success',
      rows: [EMPTY_POLICY_COMBINATION_ROW],
      rowErrors: {},
      message: 'Ofertas salvas com sucesso.',
      createdCount: result.batch.createdCount,
    };
  } catch (error) {
    console.error('Policy combination batch failed.', {
      correlationId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return {
      status: 'error',
      rows,
      rowErrors: {},
      message: `Não foi possível salvar as ofertas. Nenhuma oferta foi criada. Referência: ${correlationId}`,
    };
  }
}
