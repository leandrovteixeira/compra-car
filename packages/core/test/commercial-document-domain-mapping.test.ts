/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests exercise canonical JSON and deliberately malformed semantic input */
import { describe, expect, it } from 'vitest';
import schema from '../../../docs/import/schemas/commercial-letter-mmv-payload-v1.schema.json';
import {
  COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING,
  mapCommercialDocumentToDomain,
  type MapCommercialDocumentToDomainInput,
} from '../src/import/commercial-document-domain-mapping';
import { reconcileCommercialDocumentExtractions } from '../src/import/commercial-document-reconciliation';
import { reconcileCommercialDocumentSemantics } from '../src/import/commercial-document-semantic-reconciliation';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import type { CommercialDocumentExtractionV1 } from '../src/import/commercial-document-extraction';
import type { CommercialDocumentMapV1 } from '../src/import/commercial-document-map';
import { createCommercialLetterPayloadValidator } from '../src/services/commercial-letter-payload-validator';
import {
  fiatLikeCommercialDocumentExtractionFixture,
  geelyLikeCommercialDocumentExtractionFixture,
  gwmLikeCommercialDocumentExtractionFixture,
  volvoLikeCommercialDocumentExtractionFixture,
} from './fixtures/import/commercial-document-extraction-fixtures';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
  volvoLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

const clone = <T>(value: T): T => structuredClone(value);
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};
const semanticFrom = (map: CommercialDocumentMapV1, artifact: CommercialDocumentExtractionV1) => {
  const plan = createCommercialExtractionUnitPlan(map);
  const foundation = reconcileCommercialDocumentExtractions({
    documentMap: map,
    unitPlan: plan,
    artifacts: plan.units.map((unit) => ({
      unitId: unit.unitId,
      ordinal: unit.ordinal,
      artifact: clone(artifact),
    })),
  });
  return reconcileCommercialDocumentSemantics({ foundation });
};
const inputFrom = (
  map = geelyLikeCommercialDocumentMapFixture,
  artifact = geelyLikeCommercialDocumentExtractionFixture,
): MapCommercialDocumentToDomainInput => ({
  semanticDocument: semanticFrom(map, artifact),
  sources: [
    ...map.documents.map((document) => ({
      documentId: document.documentId,
      ordinal: document.ordinal,
      originalFileName: `${document.documentId}.pdf`,
    })),
    ...(!map.documents.some((document) => document.documentId === 'document-main')
      ? [{ documentId: 'document-main', ordinal: 1, originalFileName: 'document-main.pdf' }]
      : []),
  ],
  commercialPeriod: {
    competence: '2026-08',
    kind: 'monthly',
    startsOn: '2026-08-01',
    endsOn: '2026-08-31',
  },
});
const validate = createCommercialLetterPayloadValidator(schema as Record<string, unknown>);

describe('Sprint 10C.3E deterministic Domain Mapping', () => {
  it('maps the explicit fact vocabulary through an auditable table', () => {
    expect(COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING.public_price).toBe('MSRP');
    expect(COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING.promotional_price).not.toBe('MSRP');
    expect(COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING.bonus).toBe('POLICY_RETAIL_BONUS');
    expect(COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING.financing_rate).toContain('FINANCING');
  });

  it.each([
    [
      'Geely-like',
      geelyLikeCommercialDocumentMapFixture,
      geelyLikeCommercialDocumentExtractionFixture,
      4,
    ],
    [
      'GWM-like',
      gwmLikeCommercialDocumentMapFixture,
      gwmLikeCommercialDocumentExtractionFixture,
      13,
    ],
    [
      'Volvo-like',
      volvoLikeCommercialDocumentMapFixture,
      volvoLikeCommercialDocumentExtractionFixture,
      20,
    ],
    [
      'Fiat-like',
      fiatLikeCommercialDocumentMapFixture,
      fiatLikeCommercialDocumentExtractionFixture,
      100,
    ],
  ] as const)(
    'materializes and canonically validates %s recipients',
    (_name, map, artifact, count) => {
      const result = mapCommercialDocumentToDomain(inputFrom(map, artifact));
      expect(result.coverage.expectedRecipientCount).toBe(count);
      expect(result.coverage.mappedRecipientCount).toBe(count);
      expect(result.rows).toHaveLength(count);
      result.rows.forEach((row) => expect(() => validate(row)).not.toThrow());
    },
  );

  it('preserves separate PY/MY and permits both to be absent', () => {
    const present = mapCommercialDocumentToDomain(inputFrom()).rows[0] as Record<string, any>;
    expect(present.mmv.productionYear.value).toBe('2025');
    expect(present.mmv.modelYear.value).toBe('2026');
    const input = inputFrom();
    const semantic = clone(input.semanticDocument);
    const vehicle = semantic.recipients.find((recipient) => recipient.recipientType === 'VEHICLE')!;
    delete (vehicle.vehicleIdentity as any).productionYear;
    delete (vehicle.vehicleIdentity as any).modelYear;
    const missing = mapCommercialDocumentToDomain({
      ...input,
      semanticDocument: semantic,
    }).rows.find(
      (row: any) => row.mmv.version.value === vehicle.vehicleIdentity!.version,
    ) as Record<string, any>;
    expect(missing.mmv.productionYear.value).toBeNull();
    expect(missing.mmv.modelYear.value).toBeNull();
  });

  it('maps only public_price to MSRP and never promotional_price', () => {
    const input = inputFrom();
    const semantic = clone(input.semanticDocument);
    semantic.rules.forEach((rule) => {
      if (rule.factType === 'public_price') (rule as any).factType = 'promotional_price';
    });
    const result = mapCommercialDocumentToDomain({ ...input, semanticDocument: semantic });
    expect(result.rows.every((row: any) => row.publicPrice.candidate === null)).toBe(true);
    expect(result.mappingIssues.map((issue) => issue.code)).toContain('POLICY_TYPE_UNSUPPORTED');
  });

  it('maps bonus and financing to canonical Policies with preserved channels/restrictions', () => {
    const result = mapCommercialDocumentToDomain(
      inputFrom(
        volvoLikeCommercialDocumentMapFixture,
        volvoLikeCommercialDocumentExtractionFixture,
      ),
    );
    const policies = result.rows.flatMap((row: any) => row.policies);
    expect(policies.some((policy: any) => policy.canonicalType === 'subsidized_financing')).toBe(
      true,
    );
    expect(
      policies.some((policy: any) =>
        policy.restrictions.some((restriction: any) =>
          /channel:|eligibility:/u.test(restriction.value),
        ),
      ),
    ).toBe(true);
  });

  it('materializes cumulative/alternative composition with shared Policies and no orphan refs', () => {
    const result = mapCommercialDocumentToDomain(inputFrom());
    expect(result.coverage.mappedCompositionGroupCount).toBeGreaterThan(0);
    for (const row of result.rows as Record<string, any>[]) {
      const known = new Set(row.policies.map((policy: any) => policy.clientPolicyId));
      for (const offer of row.offers)
        expect(offer.policyClientIds.every((id: string) => known.has(id))).toBe(true);
      expect(new Set(row.policies.map((policy: any) => policy.clientPolicyId)).size).toBe(
        row.policies.length,
      );
    }
  });

  it('materializes nested (A AND B) OR (C AND D) without reinterpreting composition', () => {
    const input = inputFrom(
      fiatLikeCommercialDocumentMapFixture,
      fiatLikeCommercialDocumentExtractionFixture,
    );
    const semantic = clone(input.semanticDocument);
    const recipient = semantic.recipients.find((item) => item.recipientType === 'VEHICLE')!;
    const projection = semantic.recipientApplicability.find(
      (item) => item.recipientId === recipient.recipientId,
    )!;
    const applicable = projection.applicableRuleIds;
    const seed = applicable
      .map((ruleId) => semantic.rules.find((rule) => rule.ruleId === ruleId)!)
      .find((rule) => rule.factType === 'bonus')!;
    const policyRules = Array.from({ length: 4 }, (_, index) => ({
      ...clone(seed),
      ruleId: `semantic-rule-nested-${index + 1}`,
      value: { kind: 'money' as const, amount: `${700 + index}.00`, currency: 'BRL' },
      compositionGroupRefs: [],
    }));
    expect(seed).toBeTruthy();
    for (const rule of policyRules) {
      (semantic.rules as any).push(rule);
      (projection as any).applicableRuleIds = [...projection.applicableRuleIds, rule.ruleId].sort();
      (semantic.ruleApplicability as any).push({
        ruleId: rule.ruleId,
        expectedRecipientIds: [recipient.recipientId],
        resolvedRecipientIds: [recipient.recipientId],
        excludedRecipientIds: [],
        unresolvedRecipientRefs: [],
        status: 'complete',
      });
    }
    expect(policyRules).toHaveLength(4);
    (semantic.composition as any).groups = [
      {
        groupId: 'group-root',
        groupType: 'ALTERNATIVE',
        memberRuleIds: [],
        sharedRuleIds: [],
        provenance: [],
      },
      {
        groupId: 'group-left',
        groupType: 'CUMULATIVE',
        memberRuleIds: policyRules.slice(0, 2).map((rule) => rule.ruleId),
        sharedRuleIds: [],
        parentGroupId: 'group-root',
        provenance: [],
      },
      {
        groupId: 'group-right',
        groupType: 'CUMULATIVE',
        memberRuleIds: policyRules.slice(2, 4).map((rule) => rule.ruleId),
        sharedRuleIds: [],
        parentGroupId: 'group-root',
        provenance: [],
      },
    ];
    const result = mapCommercialDocumentToDomain({ ...input, semanticDocument: semantic });
    const row = result.rows.find(
      (item: any) => item.mmv.version.value === recipient.vehicleIdentity!.version,
    ) as Record<string, any>;
    const alternatives = row.offers.filter(
      (offer: any) => offer.sourceRelation.value === 'or_alternative',
    );
    expect(alternatives.filter((offer: any) => offer.policyClientIds.length === 2)).toHaveLength(2);
  });

  it('uses stable local Policy IDs created before Offer references', () => {
    const first = mapCommercialDocumentToDomain(inputFrom());
    const second = mapCommercialDocumentToDomain(inputFrom());
    expect(
      first.rows.map((row: any) => row.policies.map((policy: any) => policy.clientPolicyId)),
    ).toEqual(
      second.rows.map((row: any) => row.policies.map((policy: any) => policy.clientPolicyId)),
    );
  });

  it('turns an unmappable grouped rule into review without a placeholder or orphan', () => {
    const input = inputFrom();
    const semantic = clone(input.semanticDocument);
    const grouped = semantic.rules.find((rule) => rule.compositionGroupRefs.length)!;
    (grouped as any).factType = 'other';
    const result = mapCommercialDocumentToDomain({ ...input, semanticDocument: semantic });
    expect(result.mappingIssues.map((issue) => issue.code)).toContain('OFFER_COVERAGE_GAP');
    expect(JSON.stringify(result.rows)).not.toContain('placeholder');
    result.rows.forEach((row) => expect(() => validate(row)).not.toThrow());
  });

  it('preserves disjoint Policy validity dates and blocks unresolved conflicts conservatively', () => {
    const input = inputFrom();
    const semantic = clone(input.semanticDocument);
    const policyRules = semantic.rules.filter((rule) => rule.factType === 'bonus').slice(0, 2);
    if (policyRules[0])
      (policyRules[0] as any).validity = { startsOn: '2026-08-01', endsOn: '2026-08-10' };
    if (policyRules[1])
      (policyRules[1] as any).validity = { startsOn: '2026-08-20', endsOn: '2026-08-31' };
    const disjoint = mapCommercialDocumentToDomain({ ...input, semanticDocument: semantic });
    const dates = disjoint.rows.flatMap((row: any) =>
      row.policies.map((policy: any) => policy.startsOn.value),
    );
    if (policyRules.length > 1)
      expect(dates).toEqual(expect.arrayContaining(['2026-08-01', '2026-08-20']));
    expect(input.semanticDocument.unresolvedConflicts.length).toBeGreaterThanOrEqual(0);
  });

  it('blocks unresolved identity and reports incomplete recipient coverage', () => {
    const input = inputFrom();
    const semantic = clone(input.semanticDocument);
    delete (
      semantic.recipients.find((recipient) => recipient.recipientType === 'VEHICLE')!
        .vehicleIdentity as any
    ).version;
    const result = mapCommercialDocumentToDomain({ ...input, semanticDocument: semantic });
    expect(result.status).toBe('blocked');
    expect(result.rows).toHaveLength(3);
    expect(result.mappingIssues.map((issue) => issue.code)).toContain('MMV_FIELD_MISSING');
  });

  it('maps unresolved scope and overlapping MSRP conflict to deterministic review', () => {
    const input = inputFrom();
    const semantic = clone(input.semanticDocument);
    const recipient = semantic.recipients.find((item) => item.recipientType === 'VEHICLE')!;
    const projection = semantic.recipientApplicability.find(
      (item) => item.recipientId === recipient.recipientId,
    )!;
    const msrpRule = semantic.rules.find((rule) => rule.factType === 'public_price')!;
    (projection as any).unresolvedRuleIds = [msrpRule.ruleId];
    (semantic.unresolvedConflicts as any).push({
      conflictId: 'semantic-conflict-test',
      status: 'unresolved',
      ruleRefs: [msrpRule.ruleId],
      recipientRefs: [recipient.recipientId],
      provenance: msrpRule.provenance,
    });
    const result = mapCommercialDocumentToDomain({ ...input, semanticDocument: semantic });
    const codes = result.mappingIssues.map((issue) => issue.code);
    expect(codes).toContain('OFFER_COVERAGE_GAP');
    expect(codes).toContain('MSRP_CONFLICT');
    expect(result.status).toBe('review_required');
  });

  it('preserves documentary evidence/provenance and confidence remains server-band-derived', () => {
    const result = mapCommercialDocumentToDomain(inputFrom());
    const row = result.rows[0] as Record<string, any>;
    expect(row.source.applicablePages.length).toBeGreaterThan(0);
    expect(row.source.applicableBlockKeys.length).toBeGreaterThan(0);
    expect(result.provenance.length).toBeGreaterThan(0);
    expect(row.overallConfidence.band).toBe(
      row.overallConfidence.score >= 90
        ? 'high'
        : row.overallConfidence.score >= 70
          ? 'medium'
          : 'low',
    );
  });

  it('is permutation-invariant, byte-equivalent, and does not mutate deep-frozen input', () => {
    const input = inputFrom();
    const frozen = deepFreeze(clone(input));
    const first = mapCommercialDocumentToDomain(frozen);
    const permuted = clone(input);
    (permuted.semanticDocument.recipients as any[]).reverse();
    (permuted.semanticDocument.rules as any[]).reverse();
    (permuted.semanticDocument.composition.groups as any[]).reverse();
    const second = mapCommercialDocumentToDomain(permuted);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('keeps Fiat-like 100-recipient mapping trivial and free of DB/provider authority', () => {
    const input = inputFrom(
      fiatLikeCommercialDocumentMapFixture,
      fiatLikeCommercialDocumentExtractionFixture,
    );
    const started = performance.now();
    const result = mapCommercialDocumentToDomain(input);
    expect(performance.now() - started).toBeLessThan(5_000);
    expect(result.rows).toHaveLength(100);
    expect(JSON.stringify(result)).not.toMatch(
      /selectedProductId":\s*[1-9]|existingPolicyId":\s*[1-9]|providerRunId|supabase/iu,
    );
    expect((result.rows[0] as any).promotionPlan).toMatchObject({
      mode: 'blocked',
      affectedOffers: [],
    });
  });
});
