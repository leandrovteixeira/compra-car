export interface SellerEligibleProductLike {
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear?: number | string;
  readonly productionYear?: number | string;
  readonly model_year?: number | string;
  readonly production_year?: number | string;
}

function normalizedIdentity(product: SellerEligibleProductLike): string {
  return [product.brand, product.model, product.version]
    .map((value) => value.trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

function numericYear(value: number | string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function modelYear(product: SellerEligibleProductLike): number {
  return numericYear(product.modelYear ?? product.model_year);
}

function productionYear(product: SellerEligibleProductLike): number {
  return numericYear(product.productionYear ?? product.production_year);
}

export function keepLatestSellerProducts<T extends SellerEligibleProductLike>(
  products: readonly T[],
): readonly T[] {
  const latestByIdentity = new Map<string, { modelYear: number; productionYear: number }>();

  for (const product of products) {
    const key = normalizedIdentity(product);
    const candidateModelYear = modelYear(product);
    const candidateProductionYear = productionYear(product);
    const current = latestByIdentity.get(key);

    if (
      current === undefined ||
      candidateModelYear > current.modelYear ||
      (candidateModelYear === current.modelYear && candidateProductionYear > current.productionYear)
    ) {
      latestByIdentity.set(key, {
        modelYear: candidateModelYear,
        productionYear: candidateProductionYear,
      });
    }
  }

  return products.filter((product) => {
    const latest = latestByIdentity.get(normalizedIdentity(product));
    return modelYear(product) === latest?.modelYear && productionYear(product) === latest.productionYear;
  });
}
