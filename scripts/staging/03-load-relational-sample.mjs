import { assert, assertStaging, exactCount, loadSample, request } from './common.mjs';

const dryRun = process.argv.includes('--dry-run');
const { url, key } = assertStaging();
const sample = await loadSample();
for (const table of [
  'products',
  'specs',
  'product_specs',
  'product_public_prices',
  'commercial_offers',
  'commercial_policies',
])
  assert((await exactCount(url, key, table)) === 0, `${table} is not empty.`);
const profile = (
  await request(
    url,
    key,
    '/rest/v1/profiles?select=id,role,status,full_name,accepted_at,disabled_at,disabled_by',
  )
).data;
assert(
  profile.length === 1 && profile[0].role === 'admin' && profile[0].status === 'active',
  'Staging admin profile is invalid.',
);
if (dryRun) {
  console.log(
    JSON.stringify({
      dryRun: true,
      order: ['specs', 'products', 'product_specs'],
      counts: {
        specs: sample.specs.length,
        products: sample.products.length,
        productSpecs: sample.productSpecs.length,
      },
    }),
  );
  process.exit(0);
}
const post = (table, rows) =>
  request(url, key, `/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
assert((await post('specs', sample.specs)).data.length === 190, 'Specs insert count mismatch.');
assert(
  (await post('products', sample.products)).data.length === 2,
  'Products insert count mismatch.',
);
assert(
  (await post('product_specs', sample.productSpecs)).data.length === 306,
  'Product specs insert count mismatch.',
);
console.log(
  JSON.stringify({
    loaded: true,
    specs: 190,
    products: 2,
    productSpecs: 306,
    profileId: `${profile[0].id.slice(0, 8)}…${profile[0].id.slice(-4)}`,
  }),
);
