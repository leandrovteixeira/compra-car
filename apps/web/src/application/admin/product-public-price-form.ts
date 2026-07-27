import type {
  ProductPublicPriceFormValuesDto,
  ProductPublicPriceWriteFieldErrors,
  ProductPublicPriceWriteInput,
  UpdateProductPublicPriceInput,
} from '@compra-car/contracts';

export const EMPTY_PRODUCT_PUBLIC_PRICE_VALUES: ProductPublicPriceFormValuesDto = {
  id: '',
  productId: '',
  amount: '',
  startsOn: '',
  endsOn: '',
  lockVersion: '',
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function canonicalAmountFromPtBr(value: string): string {
  const compact = value
    .trim()
    .replace(/^R\$\s*/u, '')
    .replace(/[\s\u00a0]/gu, '');
  if (compact.includes(',')) return compact.replace(/\./gu, '').replace(',', '.');
  return /^\d{1,3}(?:\.\d{3})+$/u.test(compact) ? compact.replace(/\./gu, '') : compact;
}

export function amountToPtBrInput(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/u.exec(value);
  if (!match) return value;
  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
  return match[2] ? `${integer},${match[2].padEnd(2, '0')}` : integer;
}

export function readProductPublicPriceForm(formData: FormData): ProductPublicPriceFormValuesDto {
  return {
    id: field(formData, 'id'),
    productId: field(formData, 'productId'),
    amount: field(formData, 'amount'),
    startsOn: field(formData, 'startsOn'),
    endsOn: field(formData, 'endsOn'),
    lockVersion: field(formData, 'lockVersion'),
  };
}

export function toCreateProductPublicPriceInput(
  values: ProductPublicPriceFormValuesDto,
): ProductPublicPriceWriteInput {
  return {
    productId: values.productId,
    amount: canonicalAmountFromPtBr(values.amount),
    startsOn: values.startsOn,
    endsOn: values.endsOn || null,
  };
}

export function toUpdateProductPublicPriceInput(
  values: ProductPublicPriceFormValuesDto,
): UpdateProductPublicPriceInput {
  return {
    id: values.id,
    productId: values.productId,
    amount: canonicalAmountFromPtBr(values.amount),
    startsOn: values.startsOn,
    endsOn: values.endsOn || null,
    lockVersion: Number(values.lockVersion),
  };
}

export function toActionFieldErrors(
  errors: ProductPublicPriceWriteFieldErrors,
): ProductPublicPriceWriteFieldErrors {
  return errors;
}
