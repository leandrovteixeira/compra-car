import { assert, assertStaging, exactCount, loadSample, request } from './common.mjs';

const { url, key } = assertStaging();
const sample = await loadSample();
const expected = {
  products: 2,
  specs: 190,
  product_specs: 306,
  product_public_prices: 2,
  commercial_offers: 1,
  commercial_policies: 1,
  commercial_offer_policies: 1,
  profiles: 1,
};
for (const [table, count] of Object.entries(expected))
  assert((await exactCount(url, key, table)) === count, `${table} count mismatch.`);
for (const table of [
  'product_price_offers',
  'price_offers_staging',
  'pricing_import_batches',
  'pricing_import_rows',
  'pricing_import_row_outputs',
  'pricing_import_row_reviews',
  'commercial_policy_applications',
])
  assert((await exactCount(url, key, table)) === 0, `${table} must remain empty.`);
const actorRows = (
  await request(
    url,
    key,
    '/rest/v1/profiles?select=id,role,status,full_name,accepted_at,disabled_at,disabled_by',
  )
).data;
assert(
  actorRows.length === 1 &&
    actorRows[0].role === 'admin' &&
    actorRows[0].status === 'active' &&
    actorRows[0].full_name === 'Compra Car Staging Admin' &&
    actorRows[0].accepted_at &&
    !actorRows[0].disabled_at &&
    !actorRows[0].disabled_by,
  'Staging actor mismatch.',
);
const actor = actorRows[0];
const products = (
  await request(
    url,
    key,
    '/rest/v1/products?select=id,brand,model,version,model_year,production_year,is_active,is_public&order=id',
  )
).data;
assert(
  JSON.stringify(products) ===
    JSON.stringify(
      sample.products
        .map(
          ({ id, brand, model, version, model_year, production_year, is_active, is_public }) => ({
            id,
            brand,
            model,
            version,
            model_year,
            production_year,
            is_active,
            is_public,
          }),
        )
        .sort((a, b) => a.id - b.id),
    ),
  'Products do not exactly match the sample.',
);
const specs = (await request(url, key, '/rest/v1/specs?select=id&order=id&limit=500')).data;
const expectedSpecIds = sample.specs.map((row) => row.id).sort((a, b) => a - b);
assert(
  JSON.stringify(specs.map((row) => row.id)) === JSON.stringify(expectedSpecIds),
  'Spec IDs do not exactly match the sample.',
);
const productSpecs = (
  await request(
    url,
    key,
    '/rest/v1/product_specs?select=product_id,equipment_id,value,is_present,input_unit&order=product_id&limit=1000',
  )
).data;
const canonicalLink = (row) =>
  JSON.stringify([
    row.product_id,
    row.equipment_id,
    row.value === null ? null : Number(row.value),
    row.is_present,
    row.input_unit,
  ]);
assert(
  productSpecs.filter((row) => row.product_id === 608).length === 124,
  'Product 608 association count mismatch.',
);
assert(
  productSpecs.filter((row) => row.product_id === 609).length === 182,
  'Product 609 association count mismatch.',
);
assert(
  productSpecs.every((row) => [608, 609].includes(row.product_id)),
  'Unexpected product_specs owner.',
);
assert(
  JSON.stringify(productSpecs.map(canonicalLink).sort()) ===
    JSON.stringify(sample.productSpecs.map(canonicalLink).sort()),
  'Product Specs do not exactly match the sample.',
);
const prices = (
  await request(
    url,
    key,
    '/rest/v1/product_public_prices?select=id,product_id,amount,currency_code,starts_on,ends_on,status,source_type,source_reference,created_by,updated_by,published_at,published_by,product:products!product_public_prices_product_id_fkey(id,brand,model,version)&source_reference=in.(staging-minimal-608,staging-minimal-609)&order=product_id',
  )
).data;
assert(
  prices.length === 2 &&
    prices.every(
      (p) =>
        p.status === 'published' &&
        p.currency_code === 'BRL' &&
        p.source_type === 'manual' &&
        p.source_reference === `staging-minimal-${p.product_id}` &&
        Number(p.amount) === (p.product_id === 608 ? 159990 : 249990) &&
        p.created_by === actor.id &&
        p.updated_by === actor.id &&
        p.published_at &&
        p.published_by === actor.id &&
        p.product?.id === p.product_id,
    ),
  'Published price validation failed.',
);
const offers = (
  await request(
    url,
    key,
    '/rest/v1/commercial_offers?select=*&source_system=eq.staging_fixture&source_reference=eq.offer-staging-song-plus',
  )
).data;
const policies = (
  await request(
    url,
    key,
    '/rest/v1/commercial_policies?select=*&title=eq.B%C3%B4nus%20fict%C3%ADcio%20Staging%20Song%20Plus',
  )
).data;
assert(offers.length === 1 && policies.length === 1, 'Fixture Offer/Policy identity mismatch.');
const [offer] = offers;
const [policy] = policies;
const memberships = (
  await request(
    url,
    key,
    `/rest/v1/commercial_offer_policies?select=commercial_offer_id,commercial_policy_id&commercial_offer_id=eq.${offer.id}&commercial_policy_id=eq.${policy.id}`,
  )
).data;
const songPrice = prices.find((price) => price.product_id === 609);
assert(
  offer.product_id === 609 &&
    offer.public_price_id === songPrice.id &&
    offer.status === 'published' &&
    offer.created_by === actor.id &&
    offer.updated_by === actor.id &&
    offer.published_by === actor.id,
  'Offer validation failed.',
);
assert(
  memberships.length === 1 &&
    policy.product_id === offer.product_id &&
    policy.calculation_base_price_id === songPrice.id &&
    policy.policy_type === 'retail_bonus' &&
    policy.calculation_method === 'fixed_amount' &&
    Number(policy.customer_benefit_amount) === 10000 &&
    Number(policy.fixed_amount) === 10000 &&
    policy.status === 'published' &&
    policy.created_by === actor.id &&
    policy.updated_by === actor.id &&
    policy.published_by === actor.id,
  'Policy validation failed.',
);
const currentPrices = (
  await request(
    url,
    key,
    '/rest/v1/vw_current_product_public_prices?select=product_id,amount,currency_code,starts_on&product_id=in.(608,609)&order=product_id',
  )
).data;
const periods = (
  await request(
    url,
    key,
    '/rest/v1/vw_product_public_price_periods?select=product_id,amount,currency_code,starts_on&product_id=in.(608,609)&order=product_id',
  )
).data;
const values = (
  await request(
    url,
    key,
    '/rest/v1/vw_product_value_current_v2?select=product_id,brand,model,version,model_year,public_price&product_id=in.(608,609)&order=product_id',
  )
).data;
for (const rows of [currentPrices, periods])
  assert(
    rows.length === 2 &&
      rows.every(
        (row) =>
          row.currency_code === 'BRL' &&
          Number(row.amount) === (row.product_id === 608 ? 159990 : 249990),
      ),
    'Price view content mismatch.',
  );
assert(
  values.length === 2 &&
    values.every(
      (row) =>
        Number(row.public_price) === (row.product_id === 608 ? 159990 : 249990) &&
        row.brand === 'BYD',
    ),
  'Product value view content mismatch.',
);
const audit = (
  await request(
    url,
    key,
    '/rest/v1/pricing_audit_events?select=id,aggregate_type,aggregate_id,action,actor_id,correlation_id,before_snapshot,after_snapshot&order=id',
  )
).data;
assert(
  audit.length === 3 &&
    audit.every(
      (event) =>
        event.action === 'publish' &&
        event.actor_id === actor.id &&
        event.correlation_id &&
        event.before_snapshot &&
        event.after_snapshot,
    ),
  'Audit event contract mismatch.',
);
assert(
  audit.filter(
    (event) =>
      event.aggregate_type === 'product_public_price' &&
      prices.some((price) => price.id === event.aggregate_id),
  ).length === 2,
  'Price publication audit mismatch.',
);
assert(
  audit.filter(
    (event) => event.aggregate_type === 'commercial_offer' && event.aggregate_id === offer.id,
  ).length === 1,
  'Offer publication audit mismatch.',
);
const views = {
  vw_current_product_public_prices: currentPrices.length,
  vw_product_public_price_periods: periods.length,
  vw_product_value_current_v2: values.length,
};
const maskedActor = (value) => `${value.slice(0, 8)}…${value.slice(-4)}`;
const reportedPrices = prices.map(({ created_by, updated_by, published_by, ...price }) => ({
  ...price,
  created_by: maskedActor(created_by),
  updated_by: maskedActor(updated_by),
  published_by: maskedActor(published_by),
}));
console.log(
  JSON.stringify({
    valid: true,
    expected,
    auditEvents: audit.map(({ aggregate_type, aggregate_id, action }) => ({
      aggregate_type,
      aggregate_id,
      action,
    })),
    prices: reportedPrices,
    offerId: offer.id,
    policyId: policy.id,
    views,
  }),
);
