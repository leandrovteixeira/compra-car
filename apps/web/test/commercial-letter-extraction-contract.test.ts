/* eslint-disable @typescript-eslint/no-explicit-any -- synthetic fixtures mutate untyped provider JSON */
import { describe, expect, it } from 'vitest';

import fixture from '../../../docs/import/examples/commercial-letter-mmv-example-v1.json';
import canonicalSchema from '../../../docs/import/schemas/commercial-letter-mmv-payload-v1.schema.json';
import { createCommercialLetterPayloadValidator } from '../../../packages/core/src/services/commercial-letter-payload-validator';
import {
  reconstructCanonicalPayloads,
  validateCommercialLetterExtraction,
} from '../src/server/commercial-letter-openai-extraction';

type JsonObject = Record<string, any>;

const validateCanonical = createCommercialLetterPayloadValidator(
  canonicalSchema as Record<string, unknown>,
);

function transportRow(index = 1): JsonObject {
  const row = structuredClone(fixture) as JsonObject;
  for (const key of ['schemaVersion', 'productMatch', 'promotionPlan', 'validation'])
    delete row[key];
  if (row.publicPrice.candidate)
    for (const key of ['promotionAction', 'existingPriceId', 'expectedLockVersion'])
      delete row.publicPrice.candidate[key];
  for (const policy of row.policies)
    for (const key of ['promotionAction', 'existingPolicyId', 'predecessor']) delete policy[key];
  for (const offer of row.offers)
    for (const key of ['promotionAction', 'existingOfferId']) delete offer[key];
  row.source.notes ??= [];
  row.mmv.variantRestrictions ??= [];
  row.mmv.model.value = `Model ${index}`;
  row.mmv.version.value = `Version ${index}`;
  row.source.sourceRowNumber = index;
  row.source.applicableBlockKeys = [`table-row-${index}`];
  const completeEvidenceRegion = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const object = value as JsonObject;
    if ('documentPage' in object && 'excerpt' in object && 'blockKey' in object)
      object.region ??= null;
    for (const nested of Object.values(object)) {
      if (Array.isArray(nested)) nested.forEach(completeEvidenceRegion);
      else completeEvidenceRegion(nested);
    }
  };
  completeEvidenceRegion(row);
  return row;
}

function validateEnvelope(rows: JsonObject[]): readonly JsonObject[] {
  const envelope = { rows };
  validateCommercialLetterExtraction(envelope);
  const canonical = reconstructCanonicalPayloads(envelope);
  canonical.forEach(validateCanonical);
  return canonical;
}

function withoutCommercialRule(row: JsonObject): JsonObject {
  row.policies = [];
  row.offers = [];
  return row;
}

function coverageIssue(row: JsonObject, path = '/policies'): JsonObject {
  row.issues[0] = {
    ...row.issues[0],
    issueId: `issue_coverage_${row.source.sourceRowNumber}`,
    code: 'SOURCE_BLOCK_INCOMPLETE',
    path,
    message: 'Uma regra documental aplicável não pôde ser materializada com segurança.',
    status: 'open',
    blocking: true,
  };
  return row;
}

describe('CommercialLetterExtraction/1 v4 representation capacity', () => {
  it('A. represents 20 nominal MMVs', () => {
    expect(
      validateEnvelope(Array.from({ length: 20 }, (_, index) => transportRow(index + 1))),
    ).toHaveLength(20);
  });

  it('B. represents the pipeline ceiling of 100 nominal MMVs', () => {
    expect(
      validateEnvelope(Array.from({ length: 100 }, (_, index) => transportRow(index + 1))),
    ).toHaveLength(100);
  });

  it('C. represents one Policy shared by several valid Offers', () => {
    const row = transportRow();
    const second = structuredClone(row.offers[0]);
    second.clientOfferId = 'offer_alternative';
    row.offers.push(second);
    const [canonical] = validateEnvelope([row]);
    expect(canonical.offers.map((offer: JsonObject) => offer.policyClientIds)).toEqual([
      ['policy_invoice_discount'],
      ['policy_invoice_discount'],
    ]);
  });

  it('D. represents distinct channel restrictions without collapsing Offers', () => {
    const row = transportRow();
    const retail = structuredClone(row.offers[0].label);
    retail.value = 'channel: retail';
    row.offers[0].restrictions = [retail];
    const direct = structuredClone(row.offers[0]);
    direct.clientOfferId = 'offer_direct_sales';
    direct.restrictions[0].value = 'channel: direct_sales';
    row.offers.push(direct);
    const [canonical] = validateEnvelope([row]);
    expect(canonical.offers.map((offer: JsonObject) => offer.restrictions[0].value)).toEqual([
      'channel: retail',
      'channel: direct_sales',
    ]);
  });

  it('E. represents productionYear and modelYear as separate fields', () => {
    const row = transportRow();
    row.mmv.productionYear.value = '2025';
    row.mmv.modelYear.value = '2026';
    const [canonical] = validateEnvelope([row]);
    expect(canonical.mmv).toMatchObject({
      productionYear: { value: '2025' },
      modelYear: { value: '2026' },
    });
  });

  it('F. represents an Offer only with existing policyClientIds', () => {
    const [canonical] = validateEnvelope([transportRow()]);
    const policyIds = new Set(
      canonical.policies.map((policy: JsonObject) => policy.clientPolicyId),
    );
    expect(
      canonical.offers.every((offer: JsonObject) =>
        offer.policyClientIds.every((id: string) => policyIds.has(id)),
      ),
    ).toBe(true);
  });

  it('G. represents a blocking completeness REVIEW with the existing issue vocabulary', () => {
    const row = transportRow();
    row.issues[0] = {
      ...row.issues[0],
      issueId: 'issue_coverage_incomplete',
      code: 'SOURCE_BLOCK_INCOMPLETE',
      path: '/source/applicableBlockKeys',
      message: 'Uma linha nominal da tabela não pôde ser reconciliada com segurança.',
      status: 'open',
      blocking: true,
    };
    const [canonical] = validateEnvelope([row]);
    expect(canonical.issues).toContainEqual(
      expect.objectContaining({
        code: 'SOURCE_BLOCK_INCOMPLETE',
        status: 'open',
        blocking: true,
      }),
    );
  });

  it('H. represents one DOCUMENT rule in all four applicable MMV rows', () => {
    const rows = Array.from({ length: 4 }, (_, index) => transportRow(index + 1));
    const canonical = validateEnvelope(rows);
    expect(canonical).toHaveLength(4);
    expect(
      canonical.every((row) =>
        row.policies.some(
          (policy: JsonObject) => policy.clientPolicyId === 'policy_invoice_discount',
        ),
      ),
    ).toBe(true);
  });

  it('I. represents one MODEL rule in both applicable version rows', () => {
    const rows = [transportRow(1), transportRow(2)];
    rows.forEach((row) => {
      row.mmv.model.value = 'Shared model';
    });
    const canonical = validateEnvelope(rows);
    expect(canonical.map((row) => row.mmv.version.value)).toEqual(['Version 1', 'Version 2']);
    expect(canonical.every((row) => row.policies.length === 1)).toBe(true);
  });

  it('J. represents an explicit exception without giving it the general benefit', () => {
    const applicable = transportRow(1);
    const excluded = withoutCommercialRule(transportRow(2));
    excluded.mmv.variantRestrictions = [
      structuredClone(applicable.mmv.variantRestrictions[0] ?? applicable.mmv.version),
    ];
    excluded.mmv.variantRestrictions[0].value = 'Explicitly excluded by the source';
    const canonical = validateEnvelope([applicable, excluded]);
    expect(canonical[0].policies).toHaveLength(1);
    expect(canonical[1].policies).toHaveLength(0);
    expect(canonical[1].offers).toHaveLength(0);
  });

  it('K. represents a cumulative rule shared by two alternative Offers', () => {
    const row = transportRow();
    const alternative = structuredClone(row.offers[0]);
    alternative.clientOfferId = 'offer_alternative_with_shared_rule';
    row.offers.push(alternative);
    const [canonical] = validateEnvelope([row]);
    expect(canonical.offers).toHaveLength(2);
    expect(
      canonical.offers.every((offer: JsonObject) =>
        offer.policyClientIds.includes('policy_invoice_discount'),
      ),
    ).toBe(true);
  });

  it('L. keeps a shared Policy clientId referentially valid in every Offer', () => {
    const row = transportRow();
    const second = structuredClone(row.offers[0]);
    second.clientOfferId = 'offer_second_reference';
    row.offers.push(second);
    const [canonical] = validateEnvelope([row]);
    const policyIds = new Set(
      canonical.policies.map((policy: JsonObject) => policy.clientPolicyId),
    );
    expect(
      canonical.offers
        .flatMap((offer: JsonObject) => offer.policyClientIds)
        .every((id: string) => policyIds.has(id)),
    ).toBe(true);
  });

  it('M. represents a broad-rule coverage gap with an existing blocking issue', () => {
    const covered = transportRow(1);
    const incomplete = coverageIssue(withoutCommercialRule(transportRow(2)));
    const canonical = validateEnvelope([covered, incomplete]);
    expect(canonical[1].issues).toContainEqual(
      expect.objectContaining({
        code: 'SOURCE_BLOCK_INCOMPLETE',
        path: '/policies',
        status: 'open',
        blocking: true,
      }),
    );
  });

  it('N. demonstrates that schema-valid HIGH with incomplete coverage needs the v4 prompt gate', () => {
    const incomplete = coverageIssue(withoutCommercialRule(transportRow()));
    incomplete.overallConfidence = {
      score: 99,
      band: 'high',
      rationale: 'Synthetic schema-capacity fixture; v4 instructions must prohibit this state.',
    };
    const [canonical] = validateEnvelope([incomplete]);
    expect(canonical.overallConfidence.band).toBe('high');
    expect(canonical.issues).toContainEqual(
      expect.objectContaining({ code: 'SOURCE_BLOCK_INCOMPLETE', blocking: true }),
    );
  });
});
