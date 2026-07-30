import type {
  CommercialOffer,
  CommercialOfferPolicyMembership,
  CommercialPolicy,
  CommercialPolicyType,
  CommercialPricingRepository,
  PricingMutationContext,
  PricingWorkflowStatus,
} from '@compra-car/core';
import { COMMERCIAL_POLICY_TYPES, PRICING_WORKFLOW_STATUSES } from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterMappingError, PricingAdapterQueryError } from './errors';
import { moneyDecimalString } from './pricing-decimal';

interface CommercialPolicyRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly policy_type: unknown;
  readonly title: unknown;
  readonly description: unknown;
  readonly starts_on: unknown;
  readonly ends_on: unknown;
  readonly customer_benefit_amount: unknown;
  readonly status: unknown;
  readonly lock_version: unknown;
}

interface CommercialOfferMembershipRow {
  readonly commercial_offer_id: unknown;
  readonly commercial_policy_id: unknown;
  readonly created_at: unknown;
  readonly created_by: unknown;
}

interface CommercialOfferRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly public_price_id: unknown;
  readonly valid_from: unknown;
  readonly valid_to: unknown;
  readonly status: unknown;
  readonly lock_version: unknown;
  readonly public_price:
    { readonly amount: unknown } | readonly { readonly amount: unknown }[] | null;
  readonly memberships: readonly { readonly commercial_policy_id: unknown }[] | null;
}

const POLICY_COLUMNS =
  'id,product_id,policy_type,title,description,starts_on,ends_on,customer_benefit_amount,status,lock_version';
const OFFER_COLUMNS =
  'id,product_id,public_price_id,valid_from,valid_to,status,lock_version,public_price:product_public_prices!commercial_offers_public_price_id_fkey(amount),memberships:commercial_offer_policies!commercial_offer_policies_offer_id_fkey(commercial_policy_id)';

function queryError(error: PostgrestError): PricingAdapterQueryError {
  return new PricingAdapterQueryError('Falha ao consultar o domínio comercial de Pricing.', {
    cause: error,
  });
}

function identifier(value: unknown, field: string): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    throw new PricingAdapterMappingError(`Identificador inválido em Pricing: ${field}.`);
  }
  return String(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PricingAdapterMappingError(`Campo obrigatório inválido em Pricing: ${field}.`);
  }
  return value.trim();
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : requiredString(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new PricingAdapterMappingError(`Inteiro positivo inválido em Pricing: ${field}.`);
  }
  return parsed;
}

function policyType(value: unknown): CommercialPolicyType {
  if (
    typeof value !== 'string' ||
    !COMMERCIAL_POLICY_TYPES.includes(value as CommercialPolicyType)
  ) {
    throw new PricingAdapterMappingError('Tipo de CommercialPolicy inválido.');
  }
  return value as CommercialPolicyType;
}

function workflowStatus(value: unknown): PricingWorkflowStatus {
  if (
    typeof value !== 'string' ||
    !PRICING_WORKFLOW_STATUSES.includes(value as PricingWorkflowStatus)
  ) {
    throw new PricingAdapterMappingError('Status de Pricing inválido.');
  }
  return value as PricingWorkflowStatus;
}

function amount(value: unknown): string {
  const parsed = moneyDecimalString(value, 'CommercialPolicy.amount');
  if (!/^(?:0|[1-9]\d*)\.\d{2}$/u.test(parsed) || parsed === '0.00') {
    throw new PricingAdapterMappingError('Benefício monetário inválido em CommercialPolicy.');
  }
  return parsed;
}

function relatedPriceAmount(row: CommercialOfferRow): string | null {
  const price = Array.isArray(row.public_price) ? row.public_price[0] : row.public_price;
  if (!price) return null;
  return amount(price.amount);
}

export function mapCommercialPolicyRow(row: CommercialPolicyRow): CommercialPolicy {
  return Object.freeze({
    id: identifier(row.id, 'policy.id'),
    productId: identifier(row.product_id, 'policy.product_id'),
    policyType: policyType(row.policy_type),
    title: requiredString(row.title, 'policy.title'),
    description: nullableString(row.description, 'policy.description'),
    startsOn: requiredString(row.starts_on, 'policy.starts_on'),
    endsOn: nullableString(row.ends_on, 'policy.ends_on'),
    customerBenefitAmount: amount(row.customer_benefit_amount),
    status: workflowStatus(row.status),
    lockVersion: positiveInteger(row.lock_version, 'policy.lock_version'),
  });
}

export function mapCommercialOfferMembershipRow(
  row: CommercialOfferMembershipRow,
): CommercialOfferPolicyMembership {
  return Object.freeze({
    commercialOfferId: identifier(row.commercial_offer_id, 'membership.commercial_offer_id'),
    commercialPolicyId: identifier(row.commercial_policy_id, 'membership.commercial_policy_id'),
    createdAt: requiredString(row.created_at, 'membership.created_at'),
    createdBy: nullableString(row.created_by, 'membership.created_by'),
  });
}

export function mapCommercialOfferRow(row: CommercialOfferRow): CommercialOffer {
  const status = requiredString(row.status, 'offer.status');
  if (status !== 'draft' && status !== 'published' && status !== 'archived') {
    throw new PricingAdapterMappingError('Status de CommercialOffer inválido.');
  }
  return Object.freeze({
    id: identifier(row.id, 'offer.id'),
    productId: identifier(row.product_id, 'offer.product_id'),
    publicPriceId:
      row.public_price_id === null
        ? null
        : identifier(row.public_price_id, 'offer.public_price_id'),
    publicPriceAmount: relatedPriceAmount(row),
    validFrom: requiredString(row.valid_from, 'offer.valid_from'),
    validTo: requiredString(row.valid_to, 'offer.valid_to'),
    status,
    policyIds: Object.freeze(
      (row.memberships ?? [])
        .map((membership) => identifier(membership.commercial_policy_id, 'membership.policy_id'))
        .sort((left, right) => Number(left) - Number(right)),
    ),
    lockVersion: positiveInteger(row.lock_version, 'offer.lock_version'),
  });
}

export class CommercialPricingSupabaseAdapter implements CommercialPricingRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }

  async listCommercialPoliciesByProduct(productId: string): Promise<readonly CommercialPolicy[]> {
    const { data, error } = await this.client
      .from('commercial_policies')
      .select(POLICY_COLUMNS)
      .eq('product_id', Number(productId))
      .order('starts_on', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw queryError(error);
    return Object.freeze(
      ((data ?? []) as unknown as CommercialPolicyRow[]).map(mapCommercialPolicyRow),
    );
  }

  async getCommercialOffer(id: string): Promise<CommercialOffer | null> {
    const { data, error } = await this.client
      .from('commercial_offers')
      .select(OFFER_COLUMNS)
      .eq('id', Number(id))
      .maybeSingle();
    if (error) throw queryError(error);
    return data ? mapCommercialOfferRow(data as unknown as CommercialOfferRow) : null;
  }

  async linkPolicyToOffer(input: {
    readonly offerId: string;
    readonly policyId: string;
    readonly expectedOfferLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<CommercialOfferPolicyMembership> {
    const { data, error } = await this.client.rpc('link_commercial_offer_policy', {
      p_offer_id: Number(input.offerId),
      p_policy_id: Number(input.policyId),
      p_actor_id: input.context.actorId,
      p_expected_offer_lock_version: input.expectedOfferLockVersion,
      p_correlation_id: input.context.correlationId,
    });
    if (error) throw queryError(error);
    return mapCommercialOfferMembershipRow(data as unknown as CommercialOfferMembershipRow);
  }

  async unlinkPolicyFromOffer(input: {
    readonly offerId: string;
    readonly policyId: string;
    readonly expectedOfferLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<boolean> {
    const { data, error } = await this.client.rpc('unlink_commercial_offer_policy', {
      p_offer_id: Number(input.offerId),
      p_policy_id: Number(input.policyId),
      p_actor_id: input.context.actorId,
      p_expected_offer_lock_version: input.expectedOfferLockVersion,
      p_correlation_id: input.context.correlationId,
    });
    if (error) throw queryError(error);
    return data === true;
  }

  async publishCommercialPolicy(input: {
    readonly policyId: string;
    readonly expectedLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<CommercialPolicy> {
    const { data, error } = await this.client.rpc('publish_commercial_policy', {
      p_policy_id: Number(input.policyId),
      p_actor_id: input.context.actorId,
      p_expected_lock_version: input.expectedLockVersion,
      p_correlation_id: input.context.correlationId,
    });
    if (error) throw queryError(error);
    const result = data as unknown as { readonly policy?: CommercialPolicyRow };
    if (!result?.policy) throw new PricingAdapterMappingError('Publicação não retornou a Policy.');
    return mapCommercialPolicyRow(result.policy);
  }

  async publishCommercialOffer(input: {
    readonly offerId: string;
    readonly expectedLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<CommercialOffer> {
    const { error } = await this.client.rpc('publish_commercial_offer', {
      p_offer_id: Number(input.offerId),
      p_actor_id: input.context.actorId,
      p_expected_lock_version: input.expectedLockVersion,
      p_correlation_id: input.context.correlationId,
    });
    if (error) throw queryError(error);
    const offer = await this.getCommercialOffer(input.offerId);
    if (!offer) throw new PricingAdapterMappingError('Publicação não retornou a Offer.');
    return offer;
  }
}
