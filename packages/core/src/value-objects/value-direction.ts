import { DomainValidationError } from '../errors/domain-errors';

export const valueDirections = ['positive', 'negative'] as const;

export type ValueDirection = (typeof valueDirections)[number];

export function assertValueDirection(value: string): asserts value is ValueDirection {
  if (!valueDirections.some((direction) => direction === value)) {
    throw new DomainValidationError(`Direção de valor inválida: ${value}.`);
  }
}
