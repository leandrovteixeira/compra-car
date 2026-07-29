import { assert, assertStaging, exactCount, request, todayWindow } from './common.mjs';
import { randomUUID } from 'node:crypto';

const { url, key } = assertStaging();
assert((await exactCount(url, key, 'products')) === 2, 'Expected loaded products.');
const [actor] = (
  await request(
    url,
    key,
    '/rest/v1/profiles?select=id&role=eq.admin&status=eq.active&full_name=eq.Compra%20Car%20Staging%20Admin',
  )
).data;
assert(actor, 'Admin actor not found.');
const { start, end } = todayWindow();
const insert = async (table, body) =>
  (
    await request(url, key, `/rest/v1/${table}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    })
  ).data;
const priceColumns =
  'id,product_id,amount,currency_code,starts_on,ends_on,status,source_type,source_reference,created_by,updated_by,published_by,lock_version';
const priceFixtures = [
  { product_id: 608, amount: 159990, source_reference: 'staging-minimal-608' },
  { product_id: 609, amount: 249990, source_reference: 'staging-minimal-609' },
];
const validatePrice = (price, fixture) => {
  assert(
    price?.product_id === fixture.product_id &&
      Number(price.amount) === fixture.amount &&
      price.source_reference === fixture.source_reference &&
      price.source_type === 'manual' &&
      price.currency_code === 'BRL' &&
      price.created_by === actor.id &&
      price.updated_by === actor.id &&
      (price.status !== 'published' || price.published_by === actor.id) &&
      price.starts_on <= new Date().toISOString().slice(0, 10) &&
      price.ends_on >= new Date().toISOString().slice(0, 10) &&
      ['draft', 'published'].includes(price.status),
    `Price fixture conflict for ${fixture.source_reference}.`,
  );
};
let prices = (
  await request(
    url,
    key,
    `/rest/v1/product_public_prices?select=${priceColumns}&source_reference=in.(staging-minimal-608,staging-minimal-609)&order=product_id`,
  )
).data;
assert(
  (await exactCount(url, key, 'product_public_prices')) === prices.length,
  'Unexpected public price outside the staging fixture.',
);
assert(prices.length <= priceFixtures.length, 'Duplicate public price in the staging fixture.');
for (const fixture of priceFixtures) {
  const matches = prices.filter((price) => price.source_reference === fixture.source_reference);
  assert(matches.length <= 1, `Duplicate public price for ${fixture.source_reference}.`);
  if (matches[0]) validatePrice(matches[0], fixture);
}
const missingPriceFixtures = priceFixtures.filter(
  (fixture) => !prices.some((price) => price.source_reference === fixture.source_reference),
);
if (missingPriceFixtures.length > 0) {
  const createdPrices = await insert(
    'product_public_prices',
    missingPriceFixtures.map((fixture) => ({
      product_id: fixture.product_id,
      amount: fixture.amount,
      currency_code: 'BRL',
      starts_on: start,
      ends_on: end,
      status: 'draft',
      source_type: 'manual',
      source_snapshot: { environment: 'staging', fixture: true },
      created_by: actor.id,
      updated_by: actor.id,
      price_type: 'msrp',
      source_reference: fixture.source_reference,
    })),
  );
  prices = [...prices, ...createdPrices];
}
assert(prices.length === 2, 'Price count mismatch.');
for (const fixture of priceFixtures)
  validatePrice(
    prices.find((price) => price.source_reference === fixture.source_reference),
    fixture,
  );
for (const price of prices.filter((item) => item.status === 'draft'))
  await request(url, key, '/rest/v1/rpc/publish_product_public_price', {
    method: 'POST',
    body: JSON.stringify({
      p_price_id: price.id,
      p_actor_id: actor.id,
      p_expected_lock_version: price.lock_version,
      p_correlation_id: randomUUID(),
    }),
  });
const songPrice = prices.find((price) => price.product_id === 609);
let offers = (
  await request(
    url,
    key,
    '/rest/v1/commercial_offers?select=id,product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,created_by,updated_by,published_by,lock_version&source_system=eq.staging_fixture&source_reference=eq.offer-staging-song-plus',
  )
).data;
assert(
  (await exactCount(url, key, 'commercial_offers')) === offers.length && offers.length <= 1,
  'Unexpected or duplicate commercial offer outside the staging fixture.',
);
let [offer] = offers;
if (!offer)
  [offer] = await insert('commercial_offers', {
    product_id: 609,
    public_price_id: songPrice.id,
    source_system: 'staging_fixture',
    source_reference: 'offer-staging-song-plus',
    valid_from: start,
    valid_to: end,
    status: 'draft',
    blocking_issues: [],
    created_by: actor.id,
    updated_by: actor.id,
  });
let policies = (
  await request(
    url,
    key,
    '/rest/v1/commercial_policies?select=id,product_id,calculation_base_price_id,title,policy_type,calculation_method,customer_benefit_amount,fixed_amount,starts_on,ends_on,status,created_by,updated_by,published_by,lock_version&title=eq.B%C3%B4nus%20fict%C3%ADcio%20Staging%20Song%20Plus',
  )
).data;
assert(
  (await exactCount(url, key, 'commercial_policies')) === policies.length && policies.length <= 1,
  'Unexpected or duplicate commercial policy outside the staging fixture.',
);
let [policy] = policies;
if (!policy)
  [policy] = await insert('commercial_policies', {
    policy_type: 'retail_bonus',
    product_id: 609,
    scope_type: 'model',
    model_brand: 'BYD',
    model_name: 'Song Plus',
    scope_snapshot: { brand: 'BYD', model: 'Song Plus', environment: 'staging' },
    title: 'Bônus fictício Staging Song Plus',
    description: 'Dado fictício exclusivo para validação do Staging.',
    starts_on: start,
    ends_on: end,
    calculation_method: 'fixed_amount',
    status: 'draft',
    source_type: 'manual',
    calculation_base_price_id: songPrice.id,
    customer_benefit_amount: 10000,
    fixed_amount: 10000,
    policy_parameters: {},
    created_by: actor.id,
    updated_by: actor.id,
  });
assert(
  offer.product_id === 609 &&
    offer.public_price_id === songPrice.id &&
    offer.source_system === 'staging_fixture' &&
    offer.source_reference === 'offer-staging-song-plus' &&
    offer.created_by === actor.id &&
    offer.updated_by === actor.id &&
    (offer.status !== 'published' || offer.published_by === actor.id) &&
    offer.valid_from === songPrice.starts_on &&
    offer.valid_to === songPrice.ends_on &&
    ['draft', 'published'].includes(offer.status) &&
    policy.product_id === offer.product_id &&
    policy.calculation_base_price_id === songPrice.id &&
    policy.title === 'Bônus fictício Staging Song Plus' &&
    policy.policy_type === 'retail_bonus' &&
    policy.calculation_method === 'fixed_amount' &&
    Number(policy.customer_benefit_amount) === 10000 &&
    Number(policy.fixed_amount) === 10000 &&
    policy.created_by === actor.id &&
    policy.updated_by === actor.id &&
    (policy.status !== 'published' || policy.published_by === actor.id) &&
    policy.starts_on === offer.valid_from &&
    policy.ends_on === offer.valid_to &&
    ['draft', 'published'].includes(policy.status),
  'Unexpected existing pricing fixture.',
);
const memberships = (
  await request(
    url,
    key,
    `/rest/v1/commercial_offer_policies?select=commercial_offer_id,commercial_policy_id&commercial_offer_id=eq.${offer.id}&commercial_policy_id=eq.${policy.id}`,
  )
).data;
assert(memberships.length <= 1, 'Duplicate Offer/Policy membership.');
if (memberships.length === 0) {
  assert(offer.status === 'draft', 'Published fixture is missing its immutable membership.');
  await request(url, key, '/rest/v1/rpc/link_commercial_offer_policy', {
    method: 'POST',
    body: JSON.stringify({
      p_offer_id: offer.id,
      p_policy_id: policy.id,
      p_actor_id: actor.id,
      p_expected_offer_lock_version: offer.lock_version,
      p_correlation_id: randomUUID(),
    }),
  });
}
if (policy.status === 'draft')
  await request(url, key, '/rest/v1/rpc/publish_commercial_policy', {
    method: 'POST',
    body: JSON.stringify({
      p_policy_id: policy.id,
      p_actor_id: actor.id,
      p_expected_lock_version: policy.lock_version,
      p_correlation_id: randomUUID(),
    }),
  });
if (offer.status === 'draft') {
  [offer] = (
    await request(
      url,
      key,
      '/rest/v1/commercial_offers?select=id,lock_version&source_system=eq.staging_fixture&source_reference=eq.offer-staging-song-plus',
    )
  ).data;
  await request(url, key, '/rest/v1/rpc/publish_commercial_offer', {
    method: 'POST',
    body: JSON.stringify({
      p_offer_id: offer.id,
      p_actor_id: actor.id,
      p_expected_lock_version: offer.lock_version,
      p_correlation_id: randomUUID(),
    }),
  });
}
prices = (
  await request(
    url,
    key,
    `/rest/v1/product_public_prices?select=${priceColumns}&source_reference=in.(staging-minimal-608,staging-minimal-609)&order=product_id`,
  )
).data;
assert(prices.length === 2, 'Final price count mismatch.');
for (const fixture of priceFixtures) {
  const matches = prices.filter((price) => price.source_reference === fixture.source_reference);
  assert(matches.length === 1, `Final price mismatch for ${fixture.source_reference}.`);
  validatePrice(matches[0], fixture);
}
[offer] = (
  await request(
    url,
    key,
    '/rest/v1/commercial_offers?select=id,product_id,public_price_id,source_system,source_reference,valid_from,valid_to,status,created_by,updated_by,published_by,lock_version&source_system=eq.staging_fixture&source_reference=eq.offer-staging-song-plus',
  )
).data;
[policy] = (
  await request(
    url,
    key,
    '/rest/v1/commercial_policies?select=id,product_id,calculation_base_price_id,title,policy_type,calculation_method,customer_benefit_amount,fixed_amount,starts_on,ends_on,status,created_by,updated_by,published_by&title=eq.B%C3%B4nus%20fict%C3%ADcio%20Staging%20Song%20Plus',
  )
).data;
assert(
  prices.every((price) => price.status === 'published') &&
    offer.status === 'published' &&
    policy.status === 'published',
  'Fixture publication did not reach the expected final state.',
);
console.log(
  JSON.stringify({
    prices: prices.map((p) => ({ productId: p.product_id, amount: p.amount })),
    offerId: offer.id,
    policyId: policy.id,
    publicationFunctions: [
      'publish_product_public_price',
      'publish_commercial_policy',
      'publish_commercial_offer',
    ],
  }),
);
