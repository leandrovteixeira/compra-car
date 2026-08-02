import { describe, expect, it, vi } from 'vitest';
import {
  CreateCommercialOfferDraft,
  CreatePolicyCombinationBatch,
  CURRENT_COMMERCIAL_POLICY_TYPES,
  POLICY_COMBINATION_COLUMNS,
  calculatePolicyCombinationTotal,
  resolvePolicyCombinationCells,
  validatePolicyCombinationBatch,
  type CommercialOfferBuilderRepository,
  type CommercialOfferBuilderPrice,
  type CommercialPolicy,
  type PolicyCombinationPolicy,
  validateCommercialOfferDraft,
} from '../src';
const price: CommercialOfferBuilderPrice = {
  id: '10',
  productId: '42',
  amount: '200000.00',
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
  status: 'published',
};
const policy = (
  id: string,
  amount: string,
  overrides: Partial<CommercialPolicy> = {},
): CommercialPolicy => ({
  id,
  productId: '42',
  policyType: 'retail_bonus',
  title: `Policy ${id}`,
  description: null,
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
  customerBenefitAmount: amount,
  status: 'draft',
  lockVersion: 1,
  ...overrides,
});

describe('policy combination batch', () => {
  const combinationPolicy = (
    id: string,
    overrides: Partial<PolicyCombinationPolicy> = {},
  ): PolicyCombinationPolicy => ({
    id,
    productId: '42',
    policyType: 'retail_bonus',
    title: `Policy ${id}`,
    description: null,
    startsOn: '2026-08-01',
    endsOn: null,
    customerBenefitAmount: '1000.00',
    status: 'draft',
    lockVersion: 1,
    ...overrides,
  });
  const row = { clientRowId: 'row-1', productId: '42', policyIds: ['1'] };
  const finitePrice = { ...price, startsOn: '2026-01-01', endsOn: '2026-12-31' };

  it('keeps the exact matrix order and Loyalty as a distinct current category', () => {
    expect(POLICY_COMBINATION_COLUMNS.map((column) => column.label)).toEqual([
      'Varejo',
      'Desc. NF',
      'Trade-In',
      'Loyalty',
      'Taxa',
      'IPVA',
      'Seguro',
      'Wallbox',
      'Emplac.',
      'Manut.',
      'Voucher',
      'Outro',
    ]);
    expect(CURRENT_COMMERCIAL_POLICY_TYPES).toContain('loyalty_bonus');
  });

  it('represents unavailable, available and conflicting cells without choosing arbitrarily', () => {
    const cells = resolvePolicyCombinationCells('42', [
      combinationPolicy('1'),
      combinationPolicy('2'),
      combinationPolicy('3', { policyType: 'loyalty_bonus' }),
    ]);
    expect(cells.retail_bonus.state).toBe('conflict');
    expect(cells.loyalty_bonus.state).toBe('available');
    expect(cells.free_ipva.state).toBe('unavailable');
  });

  it('ignores non-monetized policies in the displayed total', () => {
    expect(
      calculatePolicyCombinationTotal([
        combinationPolicy('1'),
        combinationPolicy('2', { customerBenefitAmount: null }),
      ]),
    ).toBe('1000.00');
  });

  it('derives A: open policies plus finite MSRP', () => {
    expect(
      validatePolicyCombinationBatch([row], [finitePrice], [combinationPolicy('1')]),
    ).toMatchObject({ ok: true, rows: [{ validFrom: '2026-08-01', validTo: '2026-12-31' }] });
  });

  it('derives B: finite policy plus open MSRP', () => {
    expect(
      validatePolicyCombinationBatch(
        [row],
        [{ ...finitePrice, endsOn: null }],
        [combinationPolicy('1', { endsOn: '2026-10-15' })],
      ),
    ).toMatchObject({ ok: true, rows: [{ validTo: '2026-10-15' }] });
  });

  it('derives C: the earliest end among multiple policies', () => {
    expect(
      validatePolicyCombinationBatch(
        [{ ...row, policyIds: ['1', '2'] }],
        [{ ...finitePrice, endsOn: null }],
        [
          combinationPolicy('1', { endsOn: '2026-11-30' }),
          combinationPolicy('2', { policyType: 'loyalty_bonus', endsOn: '2026-09-30' }),
        ],
      ),
    ).toMatchObject({ ok: true, rows: [{ validTo: '2026-09-30' }] });
  });

  it('derives D: open policies plus open MSRP as an open draft', () => {
    const result = validatePolicyCombinationBatch(
      [row],
      [{ ...finitePrice, endsOn: null }],
      [combinationPolicy('1')],
    );
    expect(result).toMatchObject({ ok: true, rows: [{ validTo: null }] });
  });

  it('uses the exact commercial interval and requires full Policy/MSRP coverage', () => {
    const exactRow = {
      ...row,
      referenceDate: '2026-08-10',
      periodEnd: '2026-08-20',
      periodKind: 'special' as const,
    };
    expect(
      validatePolicyCombinationBatch([exactRow], [finitePrice], [combinationPolicy('1')]),
    ).toMatchObject({
      ok: true,
      rows: [{ validFrom: '2026-08-10', validTo: '2026-08-20' }],
    });
    expect(
      validatePolicyCombinationBatch(
        [exactRow],
        [finitePrice],
        [combinationPolicy('1', { endsOn: '2026-08-15' })],
      ),
    ).toMatchObject({ ok: false });
  });

  it('rejects E: a derived end before the latest component start', () => {
    expect(
      validatePolicyCombinationBatch(
        [row],
        [{ ...finitePrice, endsOn: '2026-07-31' }],
        [combinationPolicy('1')],
      ),
    ).toMatchObject({ ok: false });
  });

  it('rejects zero or ambiguous published MSRP and duplicate combinations', () => {
    expect(validatePolicyCombinationBatch([row], [], [combinationPolicy('1')]).ok).toBe(false);
    expect(
      validatePolicyCombinationBatch(
        [row],
        [finitePrice, { ...finitePrice, id: '11' }],
        [combinationPolicy('1')],
      ).ok,
    ).toBe(false);
    expect(
      validatePolicyCombinationBatch(
        [row, { ...row, clientRowId: 'row-2' }],
        [finitePrice],
        [combinationPolicy('1')],
      ).ok,
    ).toBe(false);
  });

  it('calls the atomic repository once only after every row passes', async () => {
    const createCombinationBatch = vi.fn(async ({ rows }) => ({
      createdCount: rows.length,
      offers: [],
    }));
    const repository = {
      listPublishedPrices: vi.fn(async () => [finitePrice]),
      listAvailablePolicies: vi.fn(async () => [combinationPolicy('1')]),
      listRecentDrafts: vi.fn(async () => []),
      createCombinationBatch,
    } as unknown as CommercialOfferBuilderRepository;
    await expect(
      new CreatePolicyCombinationBatch(repository).execute([row], {
        actorId: 'actor',
        correlationId: 'corr',
      }),
    ).resolves.toMatchObject({ ok: true, batch: { createdCount: 1 } });
    expect(createCombinationBatch).toHaveBeenCalledOnce();
  });

  it('persists G: zero offers when any batch row fails validation', async () => {
    const createCombinationBatch = vi.fn();
    const repository = {
      listPublishedPrices: vi.fn(async () => [finitePrice]),
      listAvailablePolicies: vi.fn(async () => [combinationPolicy('1')]),
      listRecentDrafts: vi.fn(async () => []),
      createCombinationBatch,
    } as unknown as CommercialOfferBuilderRepository;

    await expect(
      new CreatePolicyCombinationBatch(repository).execute(
        [row, { ...row, clientRowId: 'row-invalid', policyIds: ['missing-policy'] }],
        { actorId: 'actor', correlationId: 'corr' },
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(createCombinationBatch).not.toHaveBeenCalled();
  });

  it('identifies the exact row when an identical open draft already exists', async () => {
    const repository = {
      listPublishedPrices: vi.fn(async () => [{ ...finitePrice, endsOn: null }]),
      listAvailablePolicies: vi.fn(async () => [combinationPolicy('1')]),
      listRecentDrafts: vi.fn(async () => [
        {
          productId: '42',
          status: 'draft',
          policyIds: ['1'],
          validFrom: '2026-08-01',
          validTo: null,
        },
      ]),
      createCombinationBatch: vi.fn(),
    } as unknown as CommercialOfferBuilderRepository;
    await expect(
      new CreatePolicyCombinationBatch(repository).execute([row], {
        actorId: 'actor',
        correlationId: 'corr',
      }),
    ).resolves.toEqual({
      ok: false,
      issues: [{ clientRowId: 'row-1', message: 'Uma oferta draft idêntica já existe.' }],
    });
    expect(repository.createCombinationBatch).not.toHaveBeenCalled();
  });
});
const input = {
  productId: '42',
  publicPriceId: '10',
  validFrom: '2026-08-01',
  validTo: '2026-08-31',
  policyIds: ['1', '2'],
};
describe('commercial offer builder', () => {
  it('calculates only explicitly selected policies without floating point', () => {
    expect(
      validateCommercialOfferDraft(input, price, [
        policy('1', '10000.01'),
        policy('2', '5000.02'),
        policy('3', '999.99'),
      ]),
    ).toMatchObject({
      ok: true,
      value: { benefitAmount: '15000.03', transactionalPrice: '184999.97' },
    });
  });
  it('accepts draft and published policies but rejects deprecated, cross-product and invalid periods', () => {
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [policy('1', '1.00')]).ok,
    ).toBe(true);
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [
        policy('1', '1.00', { status: 'published' }),
      ]).ok,
    ).toBe(true);
    for (const bad of [
      policy('1', '1.00', { productId: '99' }),
      policy('1', '1.00', { policyType: 'registration' }),
      policy('1', '1.00', { startsOn: '2026-08-02' }),
      policy('1', '1.00', { status: 'archived' }),
    ])
      expect(validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [bad]).ok).toBe(
        false,
      );
  });
  it('rejects zero, duplicate, missing policies and benefit above MSRP', () => {
    expect(validateCommercialOfferDraft({ ...input, policyIds: [] }, price, []).ok).toBe(false);
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1', '1'] }, price, [
        policy('1', '1.00'),
      ]).ok,
    ).toBe(false);
    expect(validateCommercialOfferDraft(input, price, [policy('1', '1.00')]).ok).toBe(false);
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [
        policy('1', '200000.01'),
      ]).ok,
    ).toBe(false);
  });
  it('reloads trusted objects and passes only validated totals to atomic repository', async () => {
    const createOfferDraft = vi.fn(async ({ offer }) => ({
      id: '90',
      productId: '42',
      publicPriceId: '10',
      publicPriceAmount: '200000.00',
      validFrom: offer.validFrom,
      validTo: offer.validTo,
      status: 'draft' as const,
      policyIds: offer.policyIds,
      lockVersion: 1,
      benefitAmount: offer.benefitAmount,
      transactionalPrice: offer.transactionalPrice,
    }));
    const repository = {
      getPrice: vi.fn(async () => price),
      getPolicies: vi.fn(async () => [policy('1', '10000.00'), policy('2', '5000.00')]),
      createOfferDraft,
    } as unknown as CommercialOfferBuilderRepository;
    await expect(
      new CreateCommercialOfferDraft(repository).execute(input, {
        actorId: 'actor',
        correlationId: 'correlation',
      }),
    ).resolves.toMatchObject({ ok: true, offer: { transactionalPrice: '185000.00' } });
    expect(createOfferDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor',
        correlationId: 'correlation',
        offer: expect.objectContaining({ benefitAmount: '15000.00' }),
      }),
    );
  });
});
