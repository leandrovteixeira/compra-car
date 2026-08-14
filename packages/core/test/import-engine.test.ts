/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests exercise malformed untyped provider JSON */
import { describe, expect, it } from 'vitest';
import schema from '../../../docs/import/schemas/commercial-letter-mmv-payload-v1.schema.json';
import fixture from '../../../docs/import/examples/commercial-letter-mmv-example-v1.json';
import { createCommercialLetterPayloadValidator } from '../src/services/commercial-letter-payload-validator';

import {
  COMMERCIAL_LETTERS_PLUGIN,
  hasPdfSignature,
  IMPORT_ENGINE_MAX_DOCUMENTS,
  IMPORT_ENGINE_MAX_PDF_BYTES,
  sanitizeImportFileName,
  validateImportBatchForm,
  validateImportDocumentCount,
  validateImportDocumentMetadata,
  ExtractionProviderRegistry,
  CommercialLetterPayloadValidationError,
  analyzeCommercialLetterReferenceIntegrity,
  deriveConfidenceBand,
  enrichCommercialLetterRow,
  matchProduct,
  prepareCommercialLetterRows,
} from '../src';

describe('Import Engine core', () => {
  it('registers only the provider-independent commercial letters plugin', () => {
    expect(COMMERCIAL_LETTERS_PLUGIN).toEqual({
      key: 'commercial_letters',
      version: '1',
      displayName: 'Cartas Comerciais',
      acceptedDocumentTypes: ['pdf'],
    });
  });

  it('accepts an absent competence hint and validates an informed value', () => {
    expect(
      validateImportBatchForm({
        competence: '2026-13',
        notes: '',
        idempotencyKey: 'forged',
      }),
    ).toEqual({
      competence: expect.any(Array),
      idempotencyKey: expect.any(Array),
    });
    expect(
      validateImportBatchForm({
        competence: '2026-07',
        notes: '',
        idempotencyKey: '10000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({});
    expect(
      validateImportBatchForm({
        competence: '',
        notes: '',
        idempotencyKey: '10000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({});
  });

  it('enforces PDF metadata, size, role and document-count limits', () => {
    expect(
      validateImportDocumentMetadata({
        originalFileName: 'carta.exe',
        mimeType: 'application/octet-stream',
        fileSizeBytes: IMPORT_ENGINE_MAX_PDF_BYTES + 1,
        role: 'invented',
      }),
    ).toHaveLength(4);
    expect(
      validateImportDocumentMetadata({
        originalFileName: 'carta.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: IMPORT_ENGINE_MAX_PDF_BYTES + 1,
        role: 'primary',
      }),
    ).toContain('O PDF excede o limite de 32 MiB.');
    expect(
      validateImportDocumentMetadata({
        originalFileName: 'carta.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: IMPORT_ENGINE_MAX_PDF_BYTES,
        role: 'primary',
      }),
    ).toEqual([]);
    expect(validateImportDocumentCount(0)).not.toEqual([]);
    expect(validateImportDocumentCount(IMPORT_ENGINE_MAX_DOCUMENTS + 1)).not.toEqual([]);
  });

  it('checks the PDF signature and sanitizes names without path traversal', () => {
    expect(hasPdfSignature(new TextEncoder().encode('%PDF-1.7'))).toBe(true);
    expect(hasPdfSignature(new TextEncoder().encode('<html>'))).toBe(false);
    expect(sanitizeImportFileName('../../Política Comercial Julho.pdf')).toBe(
      'Politica-Comercial-Julho.pdf',
    );
    expect(sanitizeImportFileName('🔥.pdf')).toBe('documento.pdf');
  });
});

describe('canonical commercial letter payload', () => {
  const validate = createCommercialLetterPayloadValidator(schema as Record<string, unknown>);
  const clone = () => structuredClone(fixture) as Record<string, any>;

  it('executes the canonical JSON Schema and complementary invariants', () => {
    expect(() => validate(fixture)).not.toThrow();
    for (const mutate of [
      (value: Record<string, any>) => {
        value.extra = true;
      },
      (value: Record<string, any>) => {
        value.publicPrice.candidate.amount.amount = 205800;
      },
      (value: Record<string, any>) => {
        value.publicPrice.candidate.amount.currency = 'USD';
      },
      (value: Record<string, any>) => {
        value.commercialPeriod.competence = '2026-13';
      },
      (value: Record<string, any>) => {
        value.commercialPeriod.startsOn.value = 'not-a-date';
      },
      (value: Record<string, any>) => {
        value.overallConfidence.band = 'high';
      },
      (value: Record<string, any>) => {
        delete value.mmv.brand.meta.evidence;
      },
      (value: Record<string, any>) => {
        value.mmv.brand.meta.evidence[0].documentPage = 0;
      },
      (value: Record<string, any>) => {
        value.offers[0].policyClientIds = ['unknown'];
      },
      (value: Record<string, any>) => {
        value.policies.push(structuredClone(value.policies[0]));
      },
      (value: Record<string, any>) => {
        delete value.issues[0].path;
      },
    ]) {
      const invalid = clone();
      mutate(invalid);
      expect(() => validate(invalid)).toThrow(CommercialLetterPayloadValidationError);
    }
  });

  it.each([
    [0, 'low'],
    [69, 'low'],
    [70, 'medium'],
    [89, 'medium'],
    [90, 'high'],
    [100, 'high'],
  ] as const)('derives confidence band deterministically for score %s', (score, band) => {
    expect(deriveConfidenceBand(score)).toBe(band);
  });

  it.each([-1, 101, 70.5, Number.NaN])('rejects invalid confidence score %s', (score) => {
    expect(() => deriveConfidenceBand(score)).toThrow(CommercialLetterPayloadValidationError);
  });

  it.each([
    [95, 'low', 'high'],
    [75, 'high', 'medium'],
    [40, 'medium', 'low'],
    [90, 'low', 'high'],
    [70, 'high', 'medium'],
  ] as const)(
    'ignores provider band for score %s and normalizes it from %s to %s',
    (score, providerBand, expectedBand) => {
      const extracted = clone();
      extracted.overallConfidence = {
        ...extracted.overallConfidence,
        score,
        band: providerBand,
      };
      extracted.mmv.brand.meta.confidence = {
        ...extracted.mmv.brand.meta.confidence,
        score,
        band: providerBand,
      };

      const row = prepareCommercialLetterRows([extracted], validate)[0]!;
      expect((row.rawPayload.overallConfidence as Record<string, unknown>).band).toBe(expectedBand);
      expect(
        (
          (row.rawPayload.mmv as Record<string, any>).brand.meta.confidence as Record<
            string,
            unknown
          >
        ).band,
      ).toBe(expectedBand);
    },
  );

  it('keeps an already correct provider band unchanged', () => {
    const row = prepareCommercialLetterRows([clone()], validate)[0]!;
    expect((row.rawPayload.overallConfidence as Record<string, unknown>).band).toBe(
      fixture.overallConfidence.band,
    );
  });

  it('rejects invalid provider score before deriving any band', () => {
    const extracted = clone();
    extracted.overallConfidence.score = 101;
    expect(() => prepareCommercialLetterRows([extracted], validate)).toThrow(
      CommercialLetterPayloadValidationError,
    );
  });

  it('discards provider authority and rebuilds server-owned fields', () => {
    const malicious = clone();
    malicious.productMatch.selectedProductId = 999999;
    malicious.productMatch.selectedBy = 'operator';
    malicious.validation = {
      blockingIssueCount: 0,
      warningCount: 0,
      readyForApproval: true,
      readyForPromotion: true,
    };
    malicious.promotionPlan = {
      mode: 'single_phase',
      publishedPriceIdForOffers: 999999,
      affectedOffers: [],
      requiresExplicitConfirmation: true,
      issueIds: [],
    };
    const row = prepareCommercialLetterRows([malicious], validate)[0]!;
    expect(row.normalizedPayload.productMatch).toMatchObject({
      selectedProductId: null,
      selectedBy: 'none',
    });
    expect(row.normalizedPayload.validation).toMatchObject({
      readyForApproval: false,
      readyForPromotion: false,
    });
    expect(row.normalizedPayload.promotionPlan).toMatchObject({
      mode: 'blocked',
      publishedPriceIdForOffers: null,
    });
    const enriched = enrichCommercialLetterRow(
      row,
      { status: 'unmatched', candidates: [] },
      validate,
    );
    expect(enriched.status).toBe('unmatched');
    expect(enriched.issueCodes).toEqual(['PRODUCT_UNMATCHED']);
  });

  it('keeps deterministic ordinals across input order and distinguishes semantic blocks', () => {
    const first = clone();
    const second = clone();
    second.source.applicableBlockKeys = ['second-block'];
    second.mmv.version.value = 'MAX';
    const forward = prepareCommercialLetterRows([first, second], validate);
    const reverse = prepareCommercialLetterRows([second, first], validate);
    expect(forward.map((row) => row.matchInput.version)).toEqual(
      reverse.map((row) => row.matchInput.version),
    );
    expect(forward.map((row) => row.sourceRowNumber)).toEqual([1, 2]);
  });

  describe('Policy/Offer referential integrity', () => {
    const withSecondPolicy = () => {
      const value = clone();
      const second = structuredClone(value.policies[0]);
      second.clientPolicyId = 'policy_second';
      value.policies.push(second);
      return value;
    };
    const validationError = (value: Record<string, any>) => {
      try {
        validate(value);
      } catch (error) {
        expect(error).toBeInstanceOf(CommercialLetterPayloadValidationError);
        return error as CommercialLetterPayloadValidationError;
      }
      throw new Error('Expected canonical validation failure.');
    };

    it('1. preserves a valid Offer to Policy reference', () => {
      const value = clone();
      expect(() => validate(value)).not.toThrow();
      expect(value.offers[0].policyClientIds).toEqual(fixture.offers[0].policyClientIds);
    });

    it('2. does not silently deduplicate semantic Policies or remap their IDs', () => {
      const value = withSecondPolicy();
      value.offers[0].policyClientIds = ['policy_second'];
      expect(() => validate(value)).not.toThrow();
      expect(value.policies).toHaveLength(fixture.policies.length + 1);
      expect(value.offers[0].policyClientIds).toEqual(['policy_second']);
    });

    it('3. preserves several Offers that reference the second semantic Policy', () => {
      const value = withSecondPolicy();
      value.offers.push(structuredClone(value.offers[0]));
      value.offers[0].clientOfferId = 'offer_first';
      value.offers[1].clientOfferId = 'offer_second';
      value.offers.forEach((offer: Record<string, any>) => {
        offer.policyClientIds = ['policy_second'];
      });
      expect(() => validate(value)).not.toThrow();
      expect(value.offers.map((offer: Record<string, any>) => offer.policyClientIds)).toEqual([
        ['policy_second'],
        ['policy_second'],
      ]);
    });

    it('4. rejects a reference when its Policy is removed before canonical validation', () => {
      const value = clone();
      value.policies = [];
      expect(validationError(value).issues).toContain('/offers/0/policyClientIds: unknownPolicy');
    });

    it('5. rejects an ID that never existed in provider Policies', () => {
      const value = clone();
      value.offers[0].policyClientIds = ['policy_never_existed'];
      expect(validationError(value).referenceIntegrity).toMatchObject({
        orphanReferenceCount: 1,
        deterministicRemappingCount: 0,
      });
    });

    it('6. rejects the entire payload when an Offer mixes valid and unknown references', () => {
      const value = clone();
      value.offers[0].policyClientIds.push('policy_unknown');
      expect(validationError(value).issues).toContain('/offers/0/policyClientIds: unknownPolicy');
      expect(value.offers[0].policyClientIds).toContain(fixture.policies[0].clientPolicyId);
    });

    it('7. rejects an Offer containing only unknown references', () => {
      const value = clone();
      value.offers[0].policyClientIds = ['policy_unknown'];
      expect(validationError(value).referenceIntegrity?.affectedOfferPaths).toEqual([
        '/offers/0/policyClientIds',
      ]);
    });

    it('8. counts multiple unknown references without logging their values', () => {
      const value = clone();
      value.offers[0].policyClientIds = ['unknown_a', 'unknown_b'];
      expect(analyzeCommercialLetterReferenceIntegrity(value)).toEqual({
        policyCount: value.policies.length,
        offerCount: value.offers.length,
        referenceCount: 2,
        orphanReferenceCount: 2,
        deterministicRemappingCount: 0,
        affectedOfferPaths: ['/offers/0/policyClientIds'],
      });
    });

    it('9. rejects repeated IDs inside one Offer', () => {
      const value = clone();
      const id = value.offers[0].policyClientIds[0];
      value.offers[0].policyClientIds = [id, id];
      expect(() => validate(value)).toThrow(CommercialLetterPayloadValidationError);
    });

    it('10. leaves E/OU Offer grouping unchanged', () => {
      const value = withSecondPolicy();
      value.offers.push(structuredClone(value.offers[0]));
      value.offers[1].clientOfferId = 'offer_alternative';
      value.offers[1].policyClientIds = ['policy_second'];
      const before = structuredClone(value.offers);
      expect(() => validate(value)).not.toThrow();
      expect(value.offers).toEqual(before);
    });

    it('11. leaves economic values unchanged', () => {
      const value = clone();
      const before = structuredClone({ publicPrice: value.publicPrice, policies: value.policies });
      expect(() => validate(value)).not.toThrow();
      expect({ publicPrice: value.publicPrice, policies: value.policies }).toEqual(before);
    });

    it('12. leaves evidence unchanged', () => {
      const value = clone();
      const before = structuredClone(value.mmv.brand.meta.evidence);
      expect(() => validate(value)).not.toThrow();
      expect(value.mmv.brand.meta.evidence).toEqual(before);
    });

    it('13. never creates a placeholder Policy for an orphan reference', () => {
      const value = clone();
      value.offers[0].policyClientIds = ['policy_placeholder_candidate'];
      validationError(value);
      expect(value.policies).toEqual(fixture.policies);
    });

    it('14. never associates a textual or fuzzy-similar unknown ID', () => {
      const value = clone();
      const known = String(value.policies[0].clientPolicyId);
      value.offers[0].policyClientIds = [`${known}_typo`];
      expect(validationError(value).referenceIntegrity?.orphanReferenceCount).toBe(1);
    });

    it('15. keeps the canonical validator as the authority for genuine unknownPolicy', () => {
      const value = clone();
      value.offers[0].policyClientIds = ['genuine_unknown'];
      const error = validationError(value);
      expect(error.issues).toEqual(['/offers/0/policyClientIds: unknownPolicy']);
      expect(error.referenceIntegrity).toMatchObject({
        policyCount: value.policies.length,
        offerCount: value.offers.length,
        referenceCount: 1,
        orphanReferenceCount: 1,
        deterministicRemappingCount: 0,
      });
    });
  });
});

describe('Import processing foundation', () => {
  const catalog = [
    {
      id: '1',
      brand: 'Geely',
      model: 'EX5',
      version: 'Pro',
      modelYear: '2026',
      productionYear: '2025',
      externalCodes: ['MVS-10'],
    },
    {
      id: '2',
      brand: 'Geely',
      model: 'EX5',
      version: 'Max',
      modelYear: '2026',
      productionYear: '2025',
      externalCodes: ['MVS-20'],
    },
  ];
  it('registers and resolves provider implementations without leaking them into the plugin', () => {
    const registry = new ExtractionProviderRegistry();
    const provider = {
      key: 'fake',
      version: '1',
      extract: async () => ({
        providerRunId: 'run',
        payloads: [],
        usage: { inputUnits: 0, outputUnits: 0 },
      }),
    };
    registry.register(provider);
    expect(registry.require('fake')).toBe(provider);
    expect(() => registry.register(provider)).toThrow(/duplicado/i);
  });
  it('auto-confirms only exact external code or full business key', () => {
    expect(
      matchProduct(
        {
          brand: '?',
          model: '?',
          version: '?',
          modelYear: '?',
          productionYear: '?',
          externalCodes: ['mvs-10'],
        },
        catalog,
      ),
    ).toMatchObject({ status: 'confirmed', method: 'external_code' });
    expect(
      matchProduct(
        {
          brand: ' GEELY ',
          model: 'EX5',
          version: 'Pro',
          modelYear: '2026',
          productionYear: '2025',
        },
        catalog,
      ),
    ).toMatchObject({ status: 'confirmed', method: 'business_key' });
  });
  it('keeps token candidates as suggestions and reports no match', () => {
    expect(
      matchProduct(
        { brand: 'Geely', model: 'EX5', version: '', modelYear: '2026', productionYear: '2025' },
        catalog,
      ).status,
    ).not.toBe('confirmed');
    expect(
      matchProduct(
        { brand: 'Outra', model: 'Nada', version: 'X', modelYear: '2026', productionYear: '2025' },
        catalog,
      ),
    ).toEqual({ status: 'unmatched', candidates: [] });
  });
  it('never confirms an incomplete year key from token similarity', () => {
    expect(
      matchProduct(
        {
          brand: 'Geely',
          model: 'EX5',
          version: 'Pro',
          modelYear: '',
          productionYear: '',
        },
        catalog,
      ),
    ).toMatchObject({ status: 'suggested' });
  });
});
