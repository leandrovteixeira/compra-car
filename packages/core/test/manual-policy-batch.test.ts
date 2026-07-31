import {
  calculateManualPolicyBenefit,
  canonicalManualPolicyPercentage,
  CreateManualPolicyBatch,
  formatPtBrPercentageInput,
  MANUAL_POLICY_DISPLAY_LABELS,
  normalizeManualPolicyBatchRow,
  resolveManualPolicyReferenceData,
  validateManualPolicyBatch,
  type ManualPolicyBatchRowInput,
  type ManualPolicyBatchRepository,
  type NormalizedManualPolicyBatchRow,
} from '../src';
import { describe, expect, it, vi } from 'vitest';
const base: ManualPolicyBatchRowInput = {
  clientRowId: 'row-1',
  productId: '1',
  policyType: 'retail_bonus',
  title: 'Bônus',
  description: '',
  startsOn: '2026-07-29',
  endsOn: null,
  amount: '5.000,00',
};
describe('manual policy batch', () => {
  it('normalizes fixed policies and rejects deprecated and duplicate fingerprints', () => {
    expect(validateManualPolicyBatch([base], {})).toMatchObject({
      ok: true,
      rows: [{ customerBenefitAmount: '5000.00' }],
    });
    expect(validateManualPolicyBatch([{ ...base, policyType: 'registration' }], {}).ok).toBe(false);
    expect(validateManualPolicyBatch([base, { ...base, clientRowId: 'row-2' }], {}).ok).toBe(false);
  });
  it('calculates registration, IPVA and insurance with decimal arithmetic', () => {
    const ref = { basePriceAmount: '200000.00' };
    expect(
      calculateManualPolicyBenefit(
        { ...base, policyType: 'free_registration', calculationBasePriceId: '1' },
        ref,
      ),
    ).toMatchObject({ customerBenefitAmount: '2000.00' });
    expect(
      calculateManualPolicyBenefit(
        {
          ...base,
          policyType: 'free_ipva',
          calculationBasePriceId: '1',
          offerMonth: '8',
        },
        ref,
      ),
    ).toEqual({ customerBenefitAmount: '3333.33', remainingMonths: 5 });
    expect(
      calculateManualPolicyBenefit(
        {
          ...base,
          policyType: 'free_insurance',
          calculationBasePriceId: '1',
          coverageYears: '2',
        },
        ref,
      ),
    ).toMatchObject({ customerBenefitAmount: '12000.00' });
  });

  it('injects official defaults, title and clears residual fields by policy type', () => {
    expect(
      normalizeManualPolicyBatchRow({
        ...base,
        policyType: 'free_ipva',
        startsOn: '2026-08-10',
        title: 'forjado',
        endsOn: '2027-01-01',
        amount: '999',
        annualRate: '0.99',
        offerMonth: '1',
      }),
    ).toEqual({
      clientRowId: 'row-1',
      productId: '1',
      policyType: 'free_ipva',
      title: 'IPVA grátis',
      description: '',
      startsOn: '2026-08-10',
      endsOn: null,
      annualRate: '0.04',
      offerMonth: '8',
    });
    for (const [months, years] of [
      ['12', '1'],
      ['24', '2'],
      ['36', '3'],
    ]) {
      expect(
        normalizeManualPolicyBatchRow({
          ...base,
          policyType: 'free_insurance',
          termMonths: months,
        }),
      ).toMatchObject({
        title: 'Seguro grátis',
        endsOn: null,
        annualRate: '0.03',
        termMonths: months,
        coverageYears: years,
      });
    }
    expect(normalizeManualPolicyBatchRow({ ...base, policyType: 'free_insurance' })).toMatchObject({
      termMonths: '12',
      coverageYears: '1',
    });
    expect(
      normalizeManualPolicyBatchRow({
        ...base,
        policyType: 'free_maintenance',
        maintenanceCount: '3',
        coverageMonths: '24',
        coverageKm: '30000',
      }),
    ).toEqual({
      clientRowId: 'row-1',
      productId: '1',
      policyType: 'free_maintenance',
      title: 'Manutenção grátis',
      description: '',
      startsOn: '2026-07-29',
      endsOn: null,
      amount: '5000.00',
      voucherType: undefined,
    });
  });

  it('resolves MSRP and financial reference only at startsOn even with endsOn null', () => {
    const row = { productId: '1', startsOn: '2026-08-10' };
    const prices = [
      {
        id: 'price-1',
        productId: '1',
        amount: '200000.00',
        startsOn: '2026-07-01',
        endsOn: '2026-08-31',
      },
    ];
    const references = [
      {
        id: 'reference-1',
        effectiveFrom: '2026-07-29',
        validTo: '2026-12-31',
        monthlyReferenceRate: '0.014458',
      },
    ];
    expect(resolveManualPolicyReferenceData(row, prices, references)).toEqual({
      calculationBasePriceId: 'price-1',
      basePriceAmount: '200000.00',
      financialParameterSetId: 'reference-1',
      monthlyReferenceRate: '0.014458',
      basePriceResolution: undefined,
      financialReferenceResolution: undefined,
    });
    expect(resolveManualPolicyReferenceData(row, [], references)).toMatchObject({
      basePriceResolution: 'missing',
    });
    expect(
      resolveManualPolicyReferenceData(
        row,
        [...prices, { ...prices[0]!, id: 'price-2' }],
        references,
      ),
    ).toMatchObject({
      basePriceResolution: 'ambiguous',
    });
    expect(resolveManualPolicyReferenceData(row, prices, [])).toMatchObject({
      financialReferenceResolution: 'missing',
    });
    expect(
      resolveManualPolicyReferenceData(row, prices, [
        ...references,
        { ...references[0]!, id: 'reference-2' },
      ]),
    ).toMatchObject({ financialReferenceResolution: 'ambiguous' });
  });
  it('derives financing from the persisted reference rate', () => {
    expect(
      calculateManualPolicyBenefit(
        {
          ...base,
          policyType: 'subsidized_financing',
          calculationBasePriceId: '1',
          termMonths: '24',
          customerInterestRateMonthly: '0.5',
          downPaymentPercentage: '20',
        },
        {
          basePriceAmount: '200000.00',
          financialParameterSetId: '7',
          monthlyReferenceRate: '0.014458',
        },
      ),
    ).toMatchObject({
      financialParameterSetId: '7',
      financedPrincipal: '160000.00',
      customerBenefitAmount: expect.stringMatching(/^\d+\.\d{2}$/u),
    });
  });
  it('accepts pt-BR financing percentages and preserves internal identifiers', () => {
    const normalized = normalizeManualPolicyBatchRow({
      ...base,
      policyType: 'subsidized_financing',
      termMonths: '24',
      customerInterestRateMonthly: '0,49',
      downPaymentPercentage: '60',
    });
    expect(canonicalManualPolicyPercentage('0,49')).toBe('0.49');
    expect(formatPtBrPercentageInput('0.49')).toBe('0,49');
    expect(formatPtBrPercentageInput('0,49')).toBe('0,49');
    expect(normalized).toMatchObject({
      policyType: 'subsidized_financing',
      termMonths: '24',
      customerInterestRateMonthly: '0.49',
      downPaymentPercentage: '60',
    });
    const result = calculateManualPolicyBenefit(normalized, {
      calculationBasePriceId: '1',
      basePriceAmount: '200000.00',
      financialParameterSetId: '7',
      monthlyReferenceRate: '0.014458',
    });
    expect(result?.customerBenefitAmount).toMatch(/^\d+\.\d{2}$/u);
    expect(Number(result?.customerBenefitAmount)).not.toBeNaN();
    expect(
      validateManualPolicyBatch([{ ...normalized, downPaymentPercentage: '100' }], {
        [normalized.clientRowId]: {
          calculationBasePriceId: '1',
          basePriceAmount: '200000.00',
          financialParameterSetId: '7',
          monthlyReferenceRate: '0.014458',
        },
      }).ok,
    ).toBe(false);
  });

  it('keeps display labels separate from persisted identifiers and titles', () => {
    expect(MANUAL_POLICY_DISPLAY_LABELS.subsidized_financing).toBe('Taxa');
    expect(MANUAL_POLICY_DISPLAY_LABELS.fuel_or_recharge_voucher).toBe('Voucher');
    expect(
      normalizeManualPolicyBatchRow({ ...base, policyType: 'subsidized_financing' }),
    ).toMatchObject({
      policyType: 'subsidized_financing',
      title: 'Financiamento subsidiado',
    });
  });
  it('creates financing with open Policy and finite reference validity', async () => {
    let persisted: unknown;
    const repository: ManualPolicyBatchRepository = {
      listProductOptions: async () => [],
      listBasePrices: async () => [],
      listFinancialReferences: async () => [],
      resolveReferences: async (rows) => ({
        [rows[0]!.clientRowId]: {
          calculationBasePriceId: 'price-1',
          basePriceAmount: '200000.00',
          financialParameterSetId: 'reference-1',
          monthlyReferenceRate: '0.014458',
        },
      }),
      createManualPolicyBatch: async (input) => {
        persisted = input;
        return { batchId: 'batch-1', createdCount: 1, policyIds: ['policy-1'] };
      },
    };
    const result = await new CreateManualPolicyBatch(repository).execute(
      [
        {
          ...base,
          policyType: 'subsidized_financing',
          title: 'forjado',
          endsOn: null,
          termMonths: '24',
          customerInterestRateMonthly: '0.5',
          downPaymentPercentage: '20',
        },
      ],
      { actorId: 'actor-1', correlationId: 'correlation-1' },
    );
    expect(result.ok).toBe(true);
    expect(persisted).toMatchObject({
      rows: [
        {
          title: 'Financiamento subsidiado',
          endsOn: null,
          calculationBasePriceId: 'price-1',
          financialParameterSetId: 'reference-1',
        },
      ],
    });
  });
  it('supports all current fixed variants and validates specialized fields', () => {
    for (const policyType of [
      'retail_bonus',
      'trade_in_bonus',
      'loyalty_bonus',
      'free_wallbox',
      'free_maintenance',
      'fuel_or_recharge_voucher',
      'other',
    ]) {
      const row = {
        ...base,
        policyType,
        description: policyType === 'other' ? 'Detalhe' : '',
        voucherType: policyType === 'fuel_or_recharge_voucher' ? 'fuel' : undefined,
      };
      expect(validateManualPolicyBatch([row], {}).ok).toBe(true);
    }
    expect(
      validateManualPolicyBatch([{ ...base, policyType: 'other', description: '' }], {}).ok,
    ).toBe(false);
  });
  it('persists valid trade-in, financing and free-IPVA rows atomically as one batch', async () => {
    const createManualPolicyBatch = vi.fn(
      async ({ rows }: { readonly rows: readonly NormalizedManualPolicyBatchRow[] }) => ({
        batchId: 'batch-1',
        createdCount: rows.length,
        policyIds: rows.map((_, index) => `policy-${index + 1}`),
      }),
    );
    const repository: ManualPolicyBatchRepository = {
      listProductOptions: async () => [],
      listBasePrices: async () => [],
      listFinancialReferences: async () => [],
      resolveReferences: async (rows) =>
        Object.fromEntries(
          rows.map((row) => [
            row.clientRowId,
            ['free_ipva', 'subsidized_financing'].includes(row.policyType)
              ? {
                  calculationBasePriceId: 'price-1',
                  basePriceAmount: '200000.00',
                  ...(row.policyType === 'subsidized_financing'
                    ? {
                        financialParameterSetId: 'reference-1',
                        monthlyReferenceRate: '0.014458',
                      }
                    : {}),
                }
              : {},
          ]),
        ),
      createManualPolicyBatch,
    };
    const result = await new CreateManualPolicyBatch(repository).execute(
      [
        { ...base, clientRowId: 'trade-in', policyType: 'trade_in_bonus', amount: '10.000,00' },
        {
          ...base,
          clientRowId: 'financing',
          policyType: 'subsidized_financing',
          termMonths: '24',
          customerInterestRateMonthly: '0,49',
          downPaymentPercentage: '60',
        },
        { ...base, clientRowId: 'ipva', policyType: 'free_ipva' },
      ],
      { actorId: 'actor-1', correlationId: 'correlation-1' },
    );
    expect(result).toMatchObject({ ok: true, batch: { createdCount: 3 } });
    expect(createManualPolicyBatch).toHaveBeenCalledOnce();
    expect(createManualPolicyBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({
            policyType: 'trade_in_bonus',
            amount: '10000.00',
            customerBenefitAmount: '10000.00',
          }),
          expect.objectContaining({
            policyType: 'subsidized_financing',
            customerInterestRateMonthly: '0.49',
            customerBenefitAmount: expect.stringMatching(/^\d+\.\d{2}$/u),
          }),
          expect.objectContaining({ policyType: 'free_ipva', customerBenefitAmount: '4000.00' }),
        ]),
      }),
    );
  });

  it('does not call persistence when one batch row is invalid', async () => {
    const createManualPolicyBatch = vi.fn();
    const repository: ManualPolicyBatchRepository = {
      listProductOptions: async () => [],
      listBasePrices: async () => [],
      listFinancialReferences: async () => [],
      resolveReferences: async () => ({}),
      createManualPolicyBatch,
    };
    const result = await new CreateManualPolicyBatch(repository).execute(
      [base, { ...base, clientRowId: 'invalid', policyType: 'trade_in_bonus', amount: '0' }],
      { actorId: 'actor-1', correlationId: 'correlation-1' },
    );
    expect(result.ok).toBe(false);
    expect(createManualPolicyBatch).not.toHaveBeenCalled();
  });
  it('enforces empty and 100 row boundaries', () => {
    expect(validateManualPolicyBatch([], {}).ok).toBe(false);
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...base,
      clientRowId: `row-${i + 1}`,
      title: `Bônus ${i}`,
    }));
    expect(validateManualPolicyBatch(rows, {}).ok).toBe(true);
    expect(
      validateManualPolicyBatch([...rows, { ...base, clientRowId: 'row-101', title: 'extra' }], {})
        .ok,
    ).toBe(false);
  });
});
