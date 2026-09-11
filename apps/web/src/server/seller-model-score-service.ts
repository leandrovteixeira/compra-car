import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';

const MONETARY_CATEGORIES = [
  'Acabamento',
  'Audio & Conectividade',
  'Conforto',
  'Design',
  'Dirigibilidade',
  'Ownership',
  'Performance',
  'Seguranca',
  'Tecnologia',
] as const;

const SPACE_CODES = ['DM_0001', 'DM_0002', 'DM_0003', 'DM_0004', 'DM_0006', 'DM_0007'] as const;

export type SellerScoreRadius = 3 | 5 | 10;

export interface SellerModelOption {
  readonly id: number;
  readonly label: string;
}

export interface SellerCategoryScore {
  readonly key: string;
  readonly label: string;
  readonly score: number | null;
}

export interface SellerModelScoreResult {
  readonly options: readonly SellerModelOption[];
  readonly selected: {
    readonly id: number;
    readonly label: string;
    readonly price: number;
  } | null;
  readonly radius: SellerScoreRadius;
  readonly peerCount: number;
  readonly overallScore: number | null;
  readonly categories: readonly SellerCategoryScore[];
}

interface CurrentPriceRow {
  readonly product_id: number;
  readonly amount: number | string;
}

interface ProductRow {
  readonly id: number;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly model_year: number;
}

interface ValueRow {
  readonly product_id: number;
  readonly category: string;
  readonly perceived_value: number | string | null;
}

interface SpecRow {
  readonly id: number;
  readonly code: string;
}

interface ProductSpecRow {
  readonly product_id: number;
  readonly equipment_id: number;
  readonly value: number | string | null;
  readonly is_present: boolean | null;
}

function labelFor(product: ProductRow): string {
  return `${product.brand} ${product.model} ${product.version} — ${product.model_year}`;
}

function displayCategory(category: string): string {
  return {
    'Audio & Conectividade': 'Áudio & Conectividade',
    Seguranca: 'Segurança',
  }[category] ?? category;
}

function scoreRatio(value: number | null, max: number): number | null {
  if (value === null || !Number.isFinite(value) || max <= 0) return null;
  return Math.max(0, Math.min(10, (value / max) * 10));
}

export async function loadSellerModelScore(
  productId: number | null,
  radius: SellerScoreRadius,
): Promise<SellerModelScoreResult> {
  const client = createLegacySupabaseClientFromEnv();
  const [{ data: priceData, error: priceError }, { data: productData, error: productError }] =
    await Promise.all([
      client.from('vw_current_product_public_prices').select('product_id,amount'),
      client
        .from('products')
        .select('id,brand,model,version,model_year')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('brand')
        .order('model')
        .order('version'),
    ]);

  if (priceError) throw priceError;
  if (productError) throw productError;

  const prices = (priceData ?? []) as CurrentPriceRow[];
  const priceByProduct = new Map(prices.map((row) => [Number(row.product_id), Number(row.amount)]));
  const products = ((productData ?? []) as ProductRow[]).filter((product) =>
    priceByProduct.has(Number(product.id)),
  );
  const options = Object.freeze(products.map((product) => ({ id: product.id, label: labelFor(product) })));

  const selectedProduct = productId === null ? null : products.find((product) => product.id === productId) ?? null;
  if (!selectedProduct) {
    return {
      options,
      selected: null,
      radius,
      peerCount: 0,
      overallScore: null,
      categories: Object.freeze([]),
    };
  }

  const selectedPrice = priceByProduct.get(selectedProduct.id)!;
  const minPrice = selectedPrice * (1 - radius / 100);
  const maxPrice = selectedPrice * (1 + radius / 100);
  const peerIds = products
    .filter((product) => {
      const price = priceByProduct.get(product.id)!;
      return price >= minPrice && price <= maxPrice;
    })
    .map((product) => product.id);

  const [{ data: valueData, error: valueError }, { data: specData, error: specError }] =
    await Promise.all([
      client
        .from('vw_product_value_by_category')
        .select('product_id,category,perceived_value')
        .in('product_id', peerIds)
        .in('category', [...MONETARY_CATEGORIES]),
      client.from('specs').select('id,code').in('code', [...SPACE_CODES]),
    ]);

  if (valueError) throw valueError;
  if (specError) throw specError;

  const values = (valueData ?? []) as ValueRow[];
  const monetaryScores: SellerCategoryScore[] = MONETARY_CATEGORIES.map((category) => {
    const peerValues = values
      .filter((row) => row.category === category)
      .map((row) => Number(row.perceived_value ?? 0));
    const best = Math.max(0, ...peerValues);
    const selectedValueRow = values.find(
      (row) => row.category === category && Number(row.product_id) === selectedProduct.id,
    );
    const selectedValue = selectedValueRow ? Number(selectedValueRow.perceived_value ?? 0) : null;
    return {
      key: category,
      label: displayCategory(category),
      score: scoreRatio(selectedValue, best),
    };
  });

  const specs = (specData ?? []) as SpecRow[];
  const specIds = specs.map((spec) => spec.id);
  let spaceScore: number | null = null;

  if (specIds.length) {
    const { data: productSpecData, error: productSpecError } = await client
      .from('product_specs')
      .select('product_id,equipment_id,value,is_present')
      .in('product_id', peerIds)
      .in('equipment_id', specIds);
    if (productSpecError) throw productSpecError;

    const productSpecs = (productSpecData ?? []) as ProductSpecRow[];
    const ratios: number[] = [];
    for (const spec of specs) {
      const rowsForSpec = productSpecs.filter(
        (row) => Number(row.equipment_id) === spec.id && row.is_present !== false,
      );
      const best = Math.max(0, ...rowsForSpec.map((row) => Number(row.value ?? 0)));
      if (best <= 0) continue;
      const selectedRow = rowsForSpec.find((row) => Number(row.product_id) === selectedProduct.id);
      if (!selectedRow) continue;
      const value = Number(selectedRow.value ?? 0);
      if (Number.isFinite(value)) ratios.push(Math.max(0, Math.min(1, value / best)));
    }
    if (ratios.length) spaceScore = (ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 10;
  }

  const categories = Object.freeze([
    ...monetaryScores,
    { key: 'Espaco + Carga', label: 'Espaço + Carga', score: spaceScore },
  ]);
  const validScores = categories.flatMap((category) => (category.score === null ? [] : [category.score]));
  const overallScore = validScores.length
    ? validScores.reduce((sum, value) => sum + value, 0) / validScores.length
    : null;

  return {
    options,
    selected: { id: selectedProduct.id, label: labelFor(selectedProduct), price: selectedPrice },
    radius,
    peerCount: peerIds.length,
    overallScore,
    categories,
  };
}
