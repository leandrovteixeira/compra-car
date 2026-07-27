export const PRICING_WORKFLOW_STATUSES = [
  'draft',
  'needs_review',
  'published',
  'rejected',
  'archived',
] as const;

export type PricingWorkflowStatus = (typeof PRICING_WORKFLOW_STATUSES)[number];

export interface ProductPublicPriceProduct {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
}

export interface ProductPublicPriceMoney {
  readonly amount: string;
  readonly currencyCode: 'BRL';
}

export interface ProductPublicPrice {
  readonly id: string;
  readonly product: ProductPublicPriceProduct;
  readonly money: ProductPublicPriceMoney;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly status: PricingWorkflowStatus;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
