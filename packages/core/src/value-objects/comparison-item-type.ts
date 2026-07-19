import { DomainValidationError } from '../errors/domain-errors';

export const comparisonItemTypes = ['binary', 'numeric', 'scale'] as const;

export type ComparisonItemType = (typeof comparisonItemTypes)[number];

export function assertComparisonItemType(value: string): asserts value is ComparisonItemType {
  if (!comparisonItemTypes.some((itemType) => itemType === value)) {
    throw new DomainValidationError(`Tipo de item de comparação inválido: ${value}.`);
  }
}
