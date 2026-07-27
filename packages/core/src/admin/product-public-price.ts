export interface ProductPublicPriceWriteInput {
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface UpdateProductPublicPriceInput extends ProductPublicPriceWriteInput {
  readonly id: string;
  readonly lockVersion: number;
}

export type ProductPublicPriceWriteField =
  'productId' | 'amount' | 'startsOn' | 'endsOn' | 'lockVersion';

export type ProductPublicPriceWriteFieldErrors = Partial<
  Readonly<Record<ProductPublicPriceWriteField, readonly string[]>>
>;

export type ProductPublicPriceWriteValidationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly fieldErrors: ProductPublicPriceWriteFieldErrors };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/u;

function validDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addError(
  errors: Partial<Record<ProductPublicPriceWriteField, string[]>>,
  field: ProductPublicPriceWriteField,
  message: string,
): void {
  (errors[field] ??= []).push(message);
}

export function canonicalProductPublicPriceAmount(value: string): string | null {
  const normalized = value.trim();
  if (!AMOUNT_PATTERN.test(normalized) || /^0(?:\.0{1,2})?$/u.test(normalized)) return null;
  const [integer, fraction = ''] = normalized.split('.');
  return `${integer}.${fraction.padEnd(2, '0')}`;
}

export function validateProductPublicPriceWriteInput(
  input: ProductPublicPriceWriteInput,
): ProductPublicPriceWriteValidationResult<ProductPublicPriceWriteInput> {
  const errors: Partial<Record<ProductPublicPriceWriteField, string[]>> = {};
  const productId = input.productId.trim();
  const parsedProductId = Number(productId);
  const amount = canonicalProductPublicPriceAmount(input.amount);
  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn?.trim() || null;

  if (!Number.isSafeInteger(parsedProductId) || parsedProductId <= 0) {
    addError(errors, 'productId', 'Selecione um produto válido.');
  }
  if (!amount) {
    addError(errors, 'amount', 'Informe um preço positivo com no máximo duas casas decimais.');
  }
  if (!validDate(startsOn)) addError(errors, 'startsOn', 'Informe uma data inicial válida.');
  if (endsOn && !validDate(endsOn)) addError(errors, 'endsOn', 'Informe uma data final válida.');
  if (endsOn && validDate(startsOn) && validDate(endsOn) && endsOn < startsOn) {
    addError(errors, 'endsOn', 'A data final deve ser igual ou posterior à data inicial.');
  }

  return Object.keys(errors).length
    ? { ok: false, fieldErrors: errors }
    : { ok: true, data: { productId, amount: amount!, startsOn, endsOn } };
}

export function validateUpdateProductPublicPriceInput(
  input: UpdateProductPublicPriceInput,
): ProductPublicPriceWriteValidationResult<UpdateProductPublicPriceInput> {
  const write = validateProductPublicPriceWriteInput(input);
  const errors: Partial<Record<ProductPublicPriceWriteField, readonly string[]>> = write.ok
    ? {}
    : { ...write.fieldErrors };
  if (!Number.isSafeInteger(input.lockVersion) || input.lockVersion < 1) {
    errors.lockVersion = ['A versão do registro é inválida. Recarregue os dados.'];
  }
  if (!input.id.trim()) errors.lockVersion = ['O preço informado é inválido.'];
  const normalizedWrite = write.ok
    ? write.data
    : {
        productId: input.productId.trim(),
        amount: input.amount.trim(),
        startsOn: input.startsOn.trim(),
        endsOn: input.endsOn?.trim() || null,
      };
  return Object.keys(errors).length
    ? { ok: false, fieldErrors: errors }
    : {
        ok: true,
        data: { id: input.id.trim(), lockVersion: input.lockVersion, ...normalizedWrite },
      };
}
