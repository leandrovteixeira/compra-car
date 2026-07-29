export const MANUAL_PRICE_BATCH_MAX_ROWS = 100;

export interface ManualPriceBatchRowInput {
  readonly clientRowId: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface CreateManualPriceBatchInput {
  readonly rows: readonly ManualPriceBatchRowInput[];
}

export type ManualPriceBatchField = 'productId' | 'amount' | 'startsOn' | 'endsOn' | 'row';

export interface ManualPriceBatchValidationIssue {
  readonly clientRowId: string;
  readonly rowNumber: number;
  readonly field: ManualPriceBatchField;
  readonly code:
    | 'INVALID_CLIENT_ROW_ID'
    | 'PARTIAL_ROW'
    | 'INVALID_PRODUCT'
    | 'INVALID_AMOUNT'
    | 'INVALID_START_DATE'
    | 'INVALID_END_DATE'
    | 'INVALID_PERIOD'
    | 'DUPLICATE_ROW';
  readonly message: string;
}

export interface NormalizedManualPriceBatchRow {
  readonly clientRowId: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export type ValidateManualPriceBatchResult =
  | { readonly ok: true; readonly rows: readonly NormalizedManualPriceBatchRow[] }
  | {
      readonly ok: false;
      readonly code: 'EMPTY_BATCH' | 'BATCH_LIMIT_EXCEEDED' | 'INVALID_ROWS';
      readonly issues: readonly ManualPriceBatchValidationIssue[];
    };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const CANONICAL_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/u;
const PT_BR_INTEGER_PATTERN = /^(?:0|[1-9]\d{0,11})$/u;
const PT_BR_GROUPED_PATTERN = /^(?:[1-9]\d{0,2})(?:\.\d{3})+$/u;
const PT_BR_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,11}),\d{1,2}$/u;
const PT_BR_GROUPED_DECIMAL_PATTERN = /^(?:[1-9]\d{0,2})(?:\.\d{3})+,\d{1,2}$/u;

export function canonicalManualPriceAmount(value: string): string | null {
  const compact = value
    .trim()
    .replace(/^R\$\s*/u, '')
    .replace(/[\s\u00a0]/gu, '');
  let decimal: string;
  if (PT_BR_INTEGER_PATTERN.test(compact)) decimal = compact;
  else if (PT_BR_GROUPED_PATTERN.test(compact)) decimal = compact.replace(/\./gu, '');
  else if (PT_BR_DECIMAL_PATTERN.test(compact)) decimal = compact.replace(',', '.');
  else if (PT_BR_GROUPED_DECIMAL_PATTERN.test(compact)) {
    decimal = compact.replace(/\./gu, '').replace(',', '.');
  } else if (CANONICAL_DECIMAL_PATTERN.test(compact) && compact.includes('.')) decimal = compact;
  else return null;

  const [integer, fraction = ''] = decimal.split('.');
  if (/^0+$/u.test(integer!) && /^0*$/u.test(fraction)) return null;
  return `${integer}.${fraction.padEnd(2, '0')}`;
}

export function isValidManualPriceDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isOperationallyEmpty(row: ManualPriceBatchRowInput): boolean {
  return !row.productId.trim() && !row.amount.trim() && !row.startsOn.trim() && !row.endsOn?.trim();
}

export function validateManualPriceBatch(
  input: CreateManualPriceBatchInput,
): ValidateManualPriceBatchResult {
  const candidates = input.rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .filter(({ row }) => !isOperationallyEmpty(row));
  if (candidates.length === 0) return { ok: false, code: 'EMPTY_BATCH', issues: [] };
  if (candidates.length > MANUAL_PRICE_BATCH_MAX_ROWS) {
    return { ok: false, code: 'BATCH_LIMIT_EXCEEDED', issues: [] };
  }

  const issues: ManualPriceBatchValidationIssue[] = [];
  const normalized: NormalizedManualPriceBatchRow[] = [];
  const identities = new Map<string, { clientRowId: string; rowNumber: number }>();
  const clientRowIds = new Set<string>();
  for (const { row, rowNumber } of candidates) {
    const clientRowId = row.clientRowId.trim() || `row-${rowNumber}`;
    const productId = row.productId.trim();
    const amount = canonicalManualPriceAmount(row.amount);
    const startsOn = row.startsOn.trim();
    const endsOn = row.endsOn?.trim() || null;
    const missingRequired = !productId || !row.amount.trim() || !startsOn;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(clientRowId) || clientRowIds.has(clientRowId)) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'row',
        code: 'INVALID_CLIENT_ROW_ID',
        message: `Linha ${rowNumber}: identificador local inválido ou repetido.`,
      });
    } else {
      clientRowIds.add(clientRowId);
    }
    if (missingRequired) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'row',
        code: 'PARTIAL_ROW',
        message: `Linha ${rowNumber}: preencha veículo, preço público e início da vigência.`,
      });
    }
    const numericProductId = Number(productId);
    if (
      productId &&
      (!/^\d+$/u.test(productId) ||
        !Number.isSafeInteger(numericProductId) ||
        numericProductId <= 0 ||
        numericProductId > 2_147_483_647)
    ) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'productId',
        code: 'INVALID_PRODUCT',
        message: `Linha ${rowNumber}: selecione um veículo válido.`,
      });
    }
    if (row.amount.trim() && !amount) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'amount',
        code: 'INVALID_AMOUNT',
        message: `Linha ${rowNumber}: informe um preço BRL positivo e não ambíguo.`,
      });
    }
    if (startsOn && !isValidManualPriceDate(startsOn)) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'startsOn',
        code: 'INVALID_START_DATE',
        message: `Linha ${rowNumber}: informe uma data inicial válida.`,
      });
    }
    if (endsOn && !isValidManualPriceDate(endsOn)) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'endsOn',
        code: 'INVALID_END_DATE',
        message: `Linha ${rowNumber}: informe uma data final válida.`,
      });
    }
    if (
      endsOn &&
      isValidManualPriceDate(startsOn) &&
      isValidManualPriceDate(endsOn) &&
      endsOn < startsOn
    ) {
      issues.push({
        clientRowId,
        rowNumber,
        field: 'endsOn',
        code: 'INVALID_PERIOD',
        message: `Linha ${rowNumber}: o fim deve ser igual ou posterior ao início.`,
      });
    }

    if (
      !missingRequired &&
      amount &&
      /^\d+$/u.test(productId) &&
      Number.isSafeInteger(numericProductId) &&
      numericProductId > 0 &&
      numericProductId <= 2_147_483_647 &&
      isValidManualPriceDate(startsOn)
    ) {
      const identity = `${productId}\u001f${startsOn}`;
      const previous = identities.get(identity);
      if (previous) {
        issues.push({
          clientRowId,
          rowNumber,
          field: 'row',
          code: 'DUPLICATE_ROW',
          message: `Linha ${rowNumber}: veículo e início repetem a linha ${previous.rowNumber}.`,
        });
      } else {
        identities.set(identity, { clientRowId, rowNumber });
      }
      normalized.push({ clientRowId, productId, amount, startsOn, endsOn });
    }
  }

  return issues.length
    ? { ok: false, code: 'INVALID_ROWS', issues: Object.freeze(issues) }
    : { ok: true, rows: Object.freeze(normalized) };
}
