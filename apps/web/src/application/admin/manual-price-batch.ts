import type {
  ManualPriceBatchActionStateDto,
  ManualPriceBatchGridRowDto,
  ManualPriceBatchRowFieldErrorsDto,
} from '@compra-car/contracts';
import {
  CreateManualPriceBatch,
  type ManualPriceBatchRepository,
  type ManualPriceBatchValidationIssue,
} from '@compra-car/core';

const SAFE_FAILURE = 'Não foi possível salvar o lote. Nenhum preço foi criado. Tente novamente.';
const INVALID_PAYLOAD = 'O lote enviado é inválido. Recarregue a página e tente novamente.';
const MAX_PAYLOAD_LENGTH = 96_000;

export const EMPTY_MANUAL_PRICE_BATCH_ROW: ManualPriceBatchGridRowDto = Object.freeze({
  clientRowId: 'row-1',
  productId: '',
  amount: '',
  startsOn: '',
  endsOn: '',
});

export interface SaveManualPriceBatchDependencies {
  readonly authorize: () => Promise<{ readonly actorId: string }>;
  readonly createRepository: () => ManualPriceBatchRepository;
  readonly createCorrelationId: () => string;
  readonly conflictRowIds: (error: unknown) => readonly string[] | null;
  readonly revalidate: (path: string) => void;
}

function isGridRow(value: unknown): value is ManualPriceBatchGridRowDto {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.clientRowId === 'string' &&
    typeof row.productId === 'string' &&
    typeof row.amount === 'string' &&
    typeof row.startsOn === 'string' &&
    typeof row.endsOn === 'string'
  );
}

export function readManualPriceBatchRows(
  formData: FormData,
): readonly ManualPriceBatchGridRowDto[] | null {
  const payload = formData.get('rows');
  if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length > 101 || !parsed.every(isGridRow)) return null;
    return Object.freeze(parsed.map((row) => Object.freeze({ ...row })));
  } catch {
    return null;
  }
}

export function toManualPriceBatchRowErrors(
  issues: readonly ManualPriceBatchValidationIssue[],
): Readonly<Record<string, ManualPriceBatchRowFieldErrorsDto>> {
  const errors: Record<string, Record<string, readonly string[]>> = Object.create(null) as Record<
    string,
    Record<string, readonly string[]>
  >;
  for (const issue of issues) {
    const row =
      errors[issue.clientRowId] ?? (Object.create(null) as Record<string, readonly string[]>);
    row[issue.field] = Object.freeze([...(row[issue.field] ?? []), issue.message]);
    errors[issue.clientRowId] = row;
  }
  return Object.freeze(errors);
}

export async function executeManualPriceBatchCreation(
  formData: FormData,
  dependencies: SaveManualPriceBatchDependencies,
): Promise<ManualPriceBatchActionStateDto> {
  const { actorId } = await dependencies.authorize();
  const rows = readManualPriceBatchRows(formData);
  if (!rows) {
    return {
      status: 'error',
      rows: [EMPTY_MANUAL_PRICE_BATCH_ROW],
      rowErrors: {},
      message: INVALID_PAYLOAD,
    };
  }

  try {
    const result = await new CreateManualPriceBatch(dependencies.createRepository()).execute(
      {
        rows: rows.map((row) => ({
          ...row,
          endsOn: row.endsOn || null,
        })),
      },
      { actorId, correlationId: dependencies.createCorrelationId() },
    );
    if (!result.ok) {
      const messages = {
        EMPTY_BATCH: 'Preencha pelo menos uma linha antes de salvar.',
        BATCH_LIMIT_EXCEEDED: 'O lote aceita no máximo 100 linhas preenchidas.',
        INVALID_ROWS: 'Revise as linhas destacadas. Nenhum preço foi criado.',
      } as const;
      return {
        status: 'error',
        rows,
        rowErrors: toManualPriceBatchRowErrors(result.issues),
        message: messages[result.code],
      };
    }

    dependencies.revalidate('/admin/prices');
    dependencies.revalidate('/admin/prices/input');
    return {
      status: 'success',
      rows: [EMPTY_MANUAL_PRICE_BATCH_ROW],
      rowErrors: {},
      message: `${result.batch.createdCount} preço(s) criado(s) como rascunho.`,
      batchId: result.batch.batchId,
      createdCount: result.batch.createdCount,
    };
  } catch (error) {
    const conflictingRows = dependencies.conflictRowIds(error);
    if (conflictingRows) {
      const rowErrors = Object.fromEntries(
        conflictingRows.map((clientRowId) => [
          clientRowId,
          { row: ['Já existe preço para este veículo e início.'] },
        ]),
      );
      return {
        status: 'conflict',
        rows,
        rowErrors,
        message:
          'Já existe preço para pelo menos um veículo e início informados. Nenhum preço foi criado.',
      };
    }
    console.error('Manual price batch creation failed.');
    return { status: 'error', rows, rowErrors: {}, message: SAFE_FAILURE };
  }
}
