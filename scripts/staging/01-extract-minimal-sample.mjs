import { operationalGet, saveSample } from './common.mjs';

const products = await operationalGet('/rest/v1/products?select=*&id=in.(608,609)&order=id');
const productSpecs = await operationalGet(
  '/rest/v1/product_specs?select=*&product_id=in.(608,609)&limit=1000',
);
const specIds = [...new Set(productSpecs.map((row) => row.equipment_id))].sort((a, b) => a - b);
const specs = await operationalGet(
  `/rest/v1/specs?select=*&id=in.(${specIds.join(',')})&limit=500`,
);
await saveSample({
  extractedAt: new Date().toISOString(),
  sourceProjectRef: 'ltbeykzccckdwpzyeywu',
  products,
  specs,
  productSpecs,
});
console.log(
  JSON.stringify({
    products: products.length,
    specs: specs.length,
    productSpecs: productSpecs.length,
  }),
);
