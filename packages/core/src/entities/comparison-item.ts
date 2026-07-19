import { DomainValidationError } from '../errors/domain-errors';
import {
  createComparisonItemCode,
  type ComparisonItemCode,
} from '../value-objects/comparison-item-code';
import {
  assertComparisonItemType,
  type ComparisonItemType,
} from '../value-objects/comparison-item-type';

export interface ComparisonItem {
  readonly id: string;
  readonly code: ComparisonItemCode;
  readonly type: ComparisonItemType;
  readonly category: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly label: string;
  readonly unit: string | null;
  readonly sortOrder: number | null;
}

export interface CreateComparisonItemInput {
  readonly id: string;
  readonly code: string;
  readonly type: string;
  readonly category: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly label: string;
  readonly unit: string | null;
  readonly sortOrder?: number | null;
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError(`${field} não pode ser vazio.`);
  }

  return normalized;
}

export function createComparisonItem(input: CreateComparisonItemInput): ComparisonItem {
  assertComparisonItemType(input.type);

  const sortOrder = input.sortOrder ?? null;
  if (sortOrder !== null && !Number.isFinite(sortOrder)) {
    throw new DomainValidationError('sortOrder deve ser um número finito ou null.');
  }

  const unit = input.unit === null ? null : requiredText(input.unit, 'unit');
  if (input.type !== 'numeric' && unit !== null) {
    throw new DomainValidationError('Itens binary e scale não podem possuir unidade.');
  }

  return Object.freeze({
    id: requiredText(input.id, 'id'),
    code: createComparisonItemCode(input.code),
    type: input.type,
    category: requiredText(input.category, 'category'),
    equipmentGroup: requiredText(input.equipmentGroup, 'equipmentGroup'),
    specSet: requiredText(input.specSet, 'specSet'),
    label: requiredText(input.label, 'label'),
    unit,
    sortOrder,
  });
}
