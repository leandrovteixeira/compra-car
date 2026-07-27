import type { ProductPublicPriceActionStateDto } from '@compra-car/contracts';
import {
  CreateProductPublicPrice,
  UpdateProductPublicPrice,
  type ProductPublicPriceRepository,
} from '@compra-car/core';

import {
  readProductPublicPriceForm,
  toActionFieldErrors,
  toCreateProductPublicPriceInput,
  toUpdateProductPublicPriceInput,
} from './product-public-price-form';

const SAFE_FAILURE = 'Não foi possível salvar o preço público. Revise os dados e tente novamente.';

export interface SaveProductPublicPriceDependencies {
  readonly authorize: () => Promise<{ readonly actorId: string }>;
  readonly createRepository: () => ProductPublicPriceRepository;
  readonly revalidate: (path: string) => void;
}

export async function executeProductPublicPriceCreation(
  formData: FormData,
  dependencies: SaveProductPublicPriceDependencies,
): Promise<ProductPublicPriceActionStateDto> {
  const values = readProductPublicPriceForm(formData);
  const { actorId } = await dependencies.authorize();
  try {
    const result = await new CreateProductPublicPrice(dependencies.createRepository()).execute(
      toCreateProductPublicPriceInput(values),
      actorId,
    );
    if (!result.ok) {
      return {
        status: 'error',
        values,
        fieldErrors: toActionFieldErrors(result.fieldErrors),
        message: 'Revise os campos destacados.',
      };
    }
    dependencies.revalidate('/admin/prices');
    return {
      status: 'success',
      values,
      fieldErrors: {},
      message: 'Preço público criado como rascunho.',
    };
  } catch {
    console.error('Product public price creation failed.');
    return { status: 'error', values, fieldErrors: {}, message: SAFE_FAILURE };
  }
}

export async function executeProductPublicPriceUpdate(
  formData: FormData,
  dependencies: SaveProductPublicPriceDependencies,
): Promise<ProductPublicPriceActionStateDto> {
  const values = readProductPublicPriceForm(formData);
  const { actorId } = await dependencies.authorize();
  try {
    const result = await new UpdateProductPublicPrice(dependencies.createRepository()).execute(
      toUpdateProductPublicPriceInput(values),
      actorId,
    );
    if (!result.ok) {
      if (result.code === 'VALIDATION_ERROR') {
        return {
          status: 'error',
          values,
          fieldErrors: toActionFieldErrors(result.fieldErrors),
          message: 'Revise os campos destacados.',
        };
      }
      const messages = {
        NOT_FOUND: 'Preço público não encontrado.',
        NOT_EDITABLE: 'Este preço não pode mais ser editado no status atual.',
        CONFLICT:
          'Este preço foi alterado por outro usuário. Recarregue os dados e tente novamente.',
      } as const;
      return {
        status: result.code === 'CONFLICT' ? 'conflict' : 'error',
        values,
        fieldErrors: {},
        message: messages[result.code],
      };
    }
    dependencies.revalidate('/admin/prices');
    return { status: 'success', values, fieldErrors: {}, message: 'Preço público atualizado.' };
  } catch {
    console.error('Product public price update failed.');
    return { status: 'error', values, fieldErrors: {}, message: SAFE_FAILURE };
  }
}
