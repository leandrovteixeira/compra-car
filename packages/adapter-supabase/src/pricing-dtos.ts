export interface ProductPublicPriceProductRow {
  readonly id: unknown;
  readonly brand: unknown;
  readonly model: unknown;
  readonly version: unknown;
  readonly model_year: unknown;
}

export interface ProductPublicPriceRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly amount: unknown;
  readonly currency_code: unknown;
  readonly starts_on: unknown;
  readonly ends_on: unknown;
  readonly status: unknown;
  readonly published_at: unknown;
  readonly created_at: unknown;
  readonly updated_at: unknown;
  readonly lock_version: unknown;
  readonly product: ProductPublicPriceProductRow | readonly ProductPublicPriceProductRow[] | null;
}

export interface ProductPublicPriceStateRow {
  readonly status: unknown;
  readonly lock_version: unknown;
}
