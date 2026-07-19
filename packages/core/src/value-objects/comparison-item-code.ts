import { DomainValidationError } from '../errors/domain-errors';

declare const comparisonItemCodeBrand: unique symbol;

export type ComparisonItemCode = string & {
  readonly [comparisonItemCodeBrand]: 'ComparisonItemCode';
};

export function createComparisonItemCode(value: string): ComparisonItemCode {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError('ComparisonItemCode não pode ser vazio.');
  }

  return normalized as ComparisonItemCode;
}
