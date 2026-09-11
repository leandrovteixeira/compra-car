export interface SellerEligibleProductLike {
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: number | string;
  readonly productionYear: number | string;
}

function normalizedIdentity(product: SellerEligibleProductLike): string {
  return [product.brand, product.model, product.version]
    .map((value) => value.trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

function numericYear(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function keepLatestSellerProducts<T extends SellerEligibleProductLike>(
  products: readonly T[],
): readonly T[] {
  const latestByIdentity = new Map<string, { modelYear: number; productionYear: number }>();

  for (const product of products) {
    const key = normalizedIdentity(product);
    const modelYear = numericYear(product.modelYear);
    const productionYear = numericYear(product.productionYear);
    const current = latestByIdentity.get(key);

    if (
      current === undefined ||
      modelYear > current.modelYear ||
      (modelYear === current.modelYear && productionYear > current.productionYear)
    ) {
      latestByIdentity.set(key, { modelYear, productionYear });
    }
  }

  return products.filter((product) => {
    const latest = latestByIdentity.get(normalizedIdentity(product));
    return (
      numericYear(product.modelYear) === latest?.modelYear &&
      numericYear(product.productionYear) === latest.productionYear
    );
  });
}
