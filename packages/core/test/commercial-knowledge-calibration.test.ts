import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS,
  COMMERCIAL_KNOWLEDGE_POLICY_ALLOWLIST,
  COMMERCIAL_KNOWLEDGE_PROMPT_VERSION,
  classifyCommercialBenefit,
  createIndividualCommercialOffers,
  deduplicateCommercialCalibrationPolicies,
  deriveSingleMissingCommercialAmount,
  expandCommercialOfferExpression,
  isRetailCommercialChannel,
  replicateCommercialPolicyByProduct,
  resolveDealerParticipation,
  selectAuthoritativeCommercialEvidence,
  separateIgnoredStockEligibility,
  type CommercialCalibrationPolicy,
  type CommercialOfferExpression,
} from '../src/import/commercial-knowledge-calibration';
import { SEGMENTED_EXTRACTION_PROMPT_VERSION } from '../src/import/segmented-extraction';
import {
  buildSegmentedExtractionUnitContext,
  buildSegmentedExtractionUnitInstructions,
} from '../src/import/segmented-extraction-orchestrator';
import { geelyLikeCommercialDocumentMapFixture } from './fixtures/import/commercial-document-map-fixtures';
import { COMMERCIAL_LETTER_CALIBRATION_CASES } from './fixtures/commercial-letter-golden-dataset';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';

const policy = (
  policyId: string,
  overrides: Partial<CommercialCalibrationPolicy> = {},
): CommercialCalibrationPolicy => ({
  policyId,
  productKey: 'product-a',
  policyType: 'retail_bonus',
  customerBenefitAmount: '10000.00',
  dealerRebateAmount: '1000.00',
  sourceFactIds: [`fact-${policyId}`],
  ...overrides,
});

const expression = (kind: 'AND' | 'OR', members: readonly CommercialOfferExpression[]) =>
  ({
    kind,
    members,
  }) as const;
const p = (policyId: string): CommercialOfferExpression => ({ kind: 'POLICY', policyId });

describe('Sprint 10R.5 commercial knowledge calibration', () => {
  it('keeps the MVP allowlist explicit and excludes unsupported fallback families', () => {
    expect(COMMERCIAL_KNOWLEDGE_POLICY_ALLOWLIST).toEqual([
      'retail_bonus',
      'invoice_discount',
      'trade_in_bonus',
      'loyalty_bonus',
      'subsidized_financing',
      'free_ipva',
      'free_insurance',
      'free_wallbox',
      'free_registration',
      'fuel_or_recharge_voucher',
    ]);
    expect(COMMERCIAL_KNOWLEDGE_POLICY_ALLOWLIST).not.toContain('other');
    expect(COMMERCIAL_KNOWLEDGE_POLICY_ALLOWLIST).not.toContain('free_maintenance');
  });

  it('filters retail-only channels and excludes VD and other special channels', () => {
    expect(isRetailCommercialChannel('VAREJO')).toBe(true);
    expect(isRetailCommercialChannel('Canal Varejo Nacional')).toBe(true);
    for (const channel of ['VD-CPF', 'PCD', 'Táxi', 'CNPJ/Frotista', 'Governo', 'Agro', 'ZFM/ALC'])
      expect(isRetailCommercialChannel(channel)).toBe(false);
    expect(
      classifyCommercialBenefit({ factType: 'trade_in', rawLabel: 'Trade-In', channel: 'VD-CPF' }),
    ).toMatchObject({
      ignored: true,
      issues: [{ reasonCode: 'NON_RETAIL_CHANNEL_IGNORED' }],
    });
  });

  it('defaults plain retail Bonus to retail_bonus but requires explicit NF for invoice discount', () => {
    expect(
      classifyCommercialBenefit({ factType: 'bonus', rawLabel: 'Bônus', channel: 'VAREJO' }),
    ).toMatchObject({ ignored: false, policyType: 'retail_bonus' });
    expect(
      classifyCommercialBenefit({
        factType: 'discount',
        rawLabel: 'Desconto em N.F.',
        channel: 'VAREJO',
      }),
    ).toMatchObject({ ignored: false, policyType: 'invoice_discount' });
    expect(
      classifyCommercialBenefit({
        factType: 'discount',
        rawLabel: 'DE 150.000 POR 140.000',
        channel: 'VAREJO',
      }),
    ).toMatchObject({
      ignored: true,
      issues: [{ reasonCode: 'COMMERCIAL_BENEFIT_CLASSIFICATION_UNRESOLVED' }],
    });
  });

  it('requires own-brand Trade-In evidence for loyalty', () => {
    expect(
      classifyCommercialBenefit({
        factType: 'trade_in',
        rawLabel: 'Loyalty BYD-BYD com usado na troca',
        channel: 'VAREJO',
      }),
    ).toMatchObject({ ignored: false, policyType: 'loyalty_bonus' });
    expect(
      classifyCommercialBenefit({
        factType: 'trade_in',
        rawLabel: 'Loyalty para cliente',
        channel: 'VAREJO',
      }),
    ).toMatchObject({
      ignored: true,
      issues: [{ reasonCode: 'LOYALTY_OWN_BRAND_TRADE_IN_NOT_EXPLICIT' }],
    });
  });

  it('reports unsupported benefits instead of mapping them to other', () => {
    expect(
      classifyCommercialBenefit({
        factType: 'maintenance',
        rawLabel: '3 revisões grátis',
        channel: 'VAREJO',
        sourceBlockIds: ['block-1'],
        page: 8,
      }),
    ).toEqual({
      ignored: true,
      issues: [
        expect.objectContaining({
          confidenceStatus: 'yellow',
          reasonCode: 'UNSUPPORTED_COMMERCIAL_BENEFIT',
          sourceBlockIds: ['block-1'],
          page: 8,
          promptVersion: '11',
        }),
      ],
    });
  });

  it('prefers structured tables over promotional copy and bound notes over general rules', () => {
    expect(
      selectAuthoritativeCommercialEvidence([
        { kind: 'PROMOTIONAL_TEXT' as const, id: 'suggestion' },
        { kind: 'GENERAL_RULE' as const, id: 'general' },
        { kind: 'SPECIFIC_NOTE' as const, id: 'note' },
        { kind: 'STRUCTURED_TABLE' as const, id: 'table' },
      ]),
    ).toEqual({ kind: 'STRUCTURED_TABLE', id: 'table' });
  });

  it('ignores stock-age eligibility while preserving other commercial eligibility', () => {
    expect(
      separateIgnoredStockEligibility([
        'Usado na troca',
        'Estoque com mais de 90 dias',
        'Data de faturamento no atacado anterior a junho',
      ]),
    ).toEqual({
      commercialEligibility: ['Usado na troca'],
      ignoredStockEligibility: [
        'Estoque com mais de 90 dias',
        'Data de faturamento no atacado anterior a junho',
      ],
    });
  });

  it('expands AND, OR and nested composition without assuming absent cumulability', () => {
    expect(expandCommercialOfferExpression(expression('AND', [p('A'), p('B')]))).toEqual([
      ['A', 'B'],
    ]);
    expect(expandCommercialOfferExpression(expression('OR', [p('A'), p('B')]))).toEqual([
      ['A'],
      ['B'],
    ]);
    expect(
      expandCommercialOfferExpression(
        expression('AND', [p('A'), expression('OR', [p('B'), p('C')])]),
      ),
    ).toEqual([
      ['A', 'B'],
      ['A', 'C'],
    ]);
    expect(createIndividualCommercialOffers(['C', 'A', 'B'])).toEqual([['A'], ['B'], ['C']]);
  });

  it('replicates merged-cell conditions as product-owned Policies', () => {
    const replicated = replicateCommercialPolicyByProduct({
      policyId: 'merged-financing',
      productKeys: ['willys-26-27', 'sahara-26-27'],
    });
    expect(replicated).toEqual([
      { policyId: 'merged-financing-01', productKey: 'sahara-26-27' },
      { policyId: 'merged-financing-02', productKey: 'willys-26-27' },
    ]);
    expect(new Set(replicated.map((item) => item.policyId)).size).toBe(2);
  });

  it('materializes hyphen plus explicit dealer participation once without double count', () => {
    expect(
      resolveDealerParticipation({
        manufacturerContribution: '0',
        dealerParticipation: '2000',
        allocationExplicit: true,
      }),
    ).toEqual({
      customerBenefitAmount: '2000.00',
      dealerRebateAmount: '2000.00',
      issues: [],
    });
    expect(
      resolveDealerParticipation({
        manufacturerContribution: '10000',
        dealerParticipation: '1600',
        allocationExplicit: true,
      }).customerBenefitAmount,
    ).toBe('11600.00');
  });

  it('does not spuriously allocate ambiguous dealer participation', () => {
    expect(
      resolveDealerParticipation({
        manufacturerContribution: '10000',
        dealerParticipation: '1600',
        allocationExplicit: false,
      }),
    ).toMatchObject({
      customerBenefitAmount: '10000.00',
      issues: [{ reasonCode: 'AMBIGUOUS_DEALER_PARTICIPATION_ALLOCATION' }],
    });
    expect(
      resolveDealerParticipation({
        manufacturerContribution: '10000',
        dealerParticipation: '1600',
        allocationExplicit: false,
      }),
    ).not.toHaveProperty('dealerRebateAmount');
  });

  it('derives only one unequivocal missing value and marks it yellow', () => {
    expect(
      deriveSingleMissingCommercialAmount({
        total: '15000',
        knownAmounts: ['10000'],
        unknownCount: 1,
        sourceBlockIds: ['block-total'],
      }),
    ).toMatchObject({
      amount: '5000.00',
      derived: true,
      issues: [{ confidenceStatus: 'yellow', reasonCode: 'MATHEMATICAL_VALUE_DERIVED' }],
    });
    expect(
      deriveSingleMissingCommercialAmount({
        total: '15000',
        knownAmounts: ['10000'],
        unknownCount: 2,
      }),
    ).toBeUndefined();
  });

  it('reuses same-product semantic Policies and never deduplicates across products', () => {
    const result = deduplicateCommercialCalibrationPolicies([
      policy('higher-dealer', { dealerRebateAmount: '2000.00' }),
      policy('lower-dealer', { dealerRebateAmount: '1000.00' }),
      policy('other-product', { productKey: 'product-b', dealerRebateAmount: '0.00' }),
      policy('other-funding', { financingRate: '0.99', dealerRebateAmount: '0.00' }),
    ]);
    expect(result.map((item) => item.policyId)).toEqual([
      'lower-dealer',
      'other-funding',
      'other-product',
    ]);
  });

  it('keeps calibrated geometry cases for all five brands and the requested identity boundaries', () => {
    expect(new Set(COMMERCIAL_LETTER_CALIBRATION_CASES.map((item) => item.brand))).toEqual(
      new Set(['Jeep', 'BYD', 'GWM', 'Geely', 'VW']),
    );
    const merged = COMMERCIAL_LETTER_CALIBRATION_CASES.find(
      (item) => item.id === 'jeep-renegade-sahara-willys-merged-financing',
    );
    expect(merged?.source.mergedCells).toHaveLength(1);
    expect(new Set(merged?.policies.map((item) => item.productKey))).toEqual(
      new Set(['sahara-26-27', 'willys-26-27']),
    );
    expect(
      COMMERCIAL_LETTER_CALIBRATION_CASES.find(
        (item) => item.id === 'vw-tcross-stock-variants-preserved',
      )?.offers,
    ).toHaveLength(2);
  });

  it('versions only Unit Extraction to v11 and carries every compact calibration boundary', () => {
    expect(COMMERCIAL_KNOWLEDGE_PROMPT_VERSION).toBe('11');
    expect(SEGMENTED_EXTRACTION_PROMPT_VERSION).toBe('11');
    for (const phrase of [
      'only for VAREJO',
      'Do not emit final Policy/Offer objects',
      'Without explicit composition',
      'merged-cell span',
      'SUGESTAO DE OFERTA',
      'hyphen plus dealer participation',
      'never double count',
      'Invoice discount requires explicit NF/N.F',
      'Loyalty requires Trade-In plus explicit own-brand',
      'Ignore stock-age/wholesale-date eligibility',
      'mark derived',
      'GREEN supported; YELLOW',
    ])
      expect(COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS).toContain(phrase);
    const plan = createCommercialExtractionUnitPlan(geelyLikeCommercialDocumentMapFixture);
    const instructions = buildSegmentedExtractionUnitInstructions(
      buildSegmentedExtractionUnitContext(geelyLikeCommercialDocumentMapFixture, plan.units[0]!),
    );
    expect(instructions).toContain(COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS);
  });
});
