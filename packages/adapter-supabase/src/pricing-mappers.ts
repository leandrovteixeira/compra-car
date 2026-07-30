import {
  PRICING_WORKFLOW_STATUSES,
  type PricingWorkflowStatus,
  type ProductPublicPrice,
} from '@compra-car/core';

import { PricingAdapterMappingError } from './errors';
import { moneyDecimalString } from './pricing-decimal';
import type { ProductPublicPriceProductRow, ProductPublicPriceRow } from './pricing-dtos';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PricingAdapterMappingError(
      `Campo obrigatório inválido em ProductPublicPrice: ${field}.`,
    );
  }
  return value.trim();
}

function identifier(value: unknown, field: string): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    throw new PricingAdapterMappingError(`Identificador inválido em ProductPublicPrice: ${field}.`);
  }
  return String(value);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new PricingAdapterMappingError(
      `Inteiro positivo inválido em ProductPublicPrice: ${field}.`,
    );
  }
  return parsed;
}

function date(value: unknown, field: string): string {
  const parsed = requiredString(value, field);
  if (!DATE_PATTERN.test(parsed)) {
    throw new PricingAdapterMappingError(`Data inválida em ProductPublicPrice: ${field}.`);
  }
  return parsed;
}

function nullableDate(value: unknown, field: string): string | null {
  return value === null ? null : date(value, field);
}

function timestamp(value: unknown, field: string): string {
  const parsed = requiredString(value, field);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new PricingAdapterMappingError(`Timestamp inválido em ProductPublicPrice: ${field}.`);
  }
  return parsed;
}

function nullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : timestamp(value, field);
}

function amount(value: unknown): string {
  return moneyDecimalString(value, 'ProductPublicPrice.amount');
}

function status(value: unknown): PricingWorkflowStatus {
  if (
    typeof value !== 'string' ||
    !PRICING_WORKFLOW_STATUSES.includes(value as PricingWorkflowStatus)
  ) {
    throw new PricingAdapterMappingError('Status inválido em ProductPublicPrice.');
  }
  return value as PricingWorkflowStatus;
}

function relatedProduct(row: ProductPublicPriceRow): ProductPublicPriceProductRow {
  const product = Array.isArray(row.product) ? row.product[0] : row.product;
  if (!product) {
    throw new PricingAdapterMappingError(
      `ProductPublicPrice ${String(row.id)} não possui Product relacionado válido.`,
    );
  }
  return product;
}

export function mapProductPublicPriceRow(row: ProductPublicPriceRow): ProductPublicPrice {
  const product = relatedProduct(row);
  if (row.currency_code !== 'BRL') {
    throw new PricingAdapterMappingError('Moeda inválida em ProductPublicPrice; esperado BRL.');
  }

  return Object.freeze({
    id: identifier(row.id, 'id'),
    product: Object.freeze({
      id: identifier(product.id, 'product.id'),
      brand: requiredString(product.brand, 'product.brand'),
      model: requiredString(product.model, 'product.model'),
      version: requiredString(product.version, 'product.version'),
      modelYear: identifier(product.model_year, 'product.model_year'),
    }),
    money: Object.freeze({ amount: amount(row.amount), currencyCode: 'BRL' as const }),
    startsOn: date(row.starts_on, 'starts_on'),
    endsOn: nullableDate(row.ends_on, 'ends_on'),
    status: status(row.status),
    publishedAt: nullableTimestamp(row.published_at, 'published_at'),
    createdAt: timestamp(row.created_at, 'created_at'),
    updatedAt: timestamp(row.updated_at, 'updated_at'),
    lockVersion: positiveInteger(row.lock_version, 'lock_version'),
  });
}
