import { assert, loadSample } from './common.mjs';

const sample = await loadSample();
assert(sample.sourceProjectRef === 'ltbeykzccckdwpzyeywu', 'Unexpected sample source.');
assert(sample.products.length === 2, 'Expected 2 products.');
const [dolphin, song] = [...sample.products].sort((a, b) => a.id - b.id);
assert(
  dolphin.id === 608 &&
    dolphin.brand === 'BYD' &&
    dolphin.model === 'Dolphin' &&
    dolphin.version === 'GS EV',
  'Product 608 identity mismatch.',
);
assert(
  song.id === 609 &&
    song.brand === 'BYD' &&
    song.model === 'Song Plus' &&
    song.version === 'GS 1.5 TGDI PHEV DHT',
  'Product 609 identity mismatch.',
);
for (const product of [dolphin, song])
  assert(
    product.model_year === 2027 &&
      product.production_year === 2026 &&
      product.is_active === true &&
      product.is_public === true,
    `Product ${product.id} eligibility mismatch.`,
  );
assert(sample.productSpecs.length === 306, 'Expected 306 product_specs.');
assert(
  sample.productSpecs.filter((row) => row.product_id === 608).length === 124,
  'Expected 124 links for product 608.',
);
assert(
  sample.productSpecs.filter((row) => row.product_id === 609).length === 182,
  'Expected 182 links for product 609.',
);
assert(
  sample.productSpecs.every((row) => [608, 609].includes(row.product_id)),
  'Unexpected product reference.',
);
const specIds = new Set(sample.specs.map((row) => row.id));
assert(specIds.size === 190 && sample.specs.length === 190, 'Expected 190 distinct specs.');
assert(
  sample.productSpecs.every((row) => specIds.has(row.equipment_id)),
  'Missing referenced spec.',
);
assert(
  sample.specs.every((row) => ['numeric', 'binary', 'scale'].includes(row.type)),
  'Invalid spec type.',
);
assert(
  sample.productSpecs.every((row) => (row.value === null) !== (row.is_present === null)),
  'Invalid product_spec value shape.',
);
console.log(
  JSON.stringify({
    valid: true,
    products: 2,
    specs: 190,
    productSpecs: 306,
    product608: 124,
    product609: 182,
  }),
);
