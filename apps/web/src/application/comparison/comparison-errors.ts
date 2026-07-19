import type { ComparisonPageErrorDto } from '@compra-car/contracts';
import { VehicleNotEligibleError, VehicleNotFoundError } from '@compra-car/core';

const VEHICLES_UNAVAILABLE_ERROR = Object.freeze({
  code: 'VEHICLES_UNAVAILABLE',
  message: 'Um ou mais veículos selecionados não estão disponíveis para comparação.',
}) satisfies ComparisonPageErrorDto;

const COMPARISON_UNAVAILABLE_ERROR = Object.freeze({
  code: 'COMPARISON_UNAVAILABLE',
  message: 'Não foi possível carregar a comparação agora. Tente novamente.',
}) satisfies ComparisonPageErrorDto;

export function toPublicComparisonError(error: unknown): ComparisonPageErrorDto {
  if (error instanceof VehicleNotFoundError || error instanceof VehicleNotEligibleError) {
    return VEHICLES_UNAVAILABLE_ERROR;
  }

  return COMPARISON_UNAVAILABLE_ERROR;
}
