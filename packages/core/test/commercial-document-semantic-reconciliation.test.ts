import { describe, expect, it } from 'vitest';
import type { CommercialDocumentScope } from '../src/import/commercial-document-extraction';
import {
  reconcileCommercialDocumentExtractions,
  type CommercialDocumentReconciliationResult,
  type ReconciledEntity,
} from '../src/import/commercial-document-reconciliation';
import {
  reconcileCommercialDocumentSemantics,
  validateSemanticallyReconciledCommercialDocument,
  type SemanticReconciliationDirectives,
} from '../src/import/commercial-document-semantic-reconciliation';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import {
  fiatLikeCommercialDocumentExtractionFixture,
  geelyLikeCommercialDocumentExtractionFixture,
  volvoLikeCommercialDocumentExtractionFixture,
} from './fixtures/import/commercial-document-extraction-fixtures';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  volvoLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

const clone = <T>(value: T): T => structuredClone(value);
const foundationFrom = (
  map = geelyLikeCommercialDocumentMapFixture,
  artifact = geelyLikeCommercialDocumentExtractionFixture,
): CommercialDocumentReconciliationResult => {
  const unitPlan = createCommercialExtractionUnitPlan(map);
  return reconcileCommercialDocumentExtractions({
    documentMap: map,
    unitPlan,
    artifacts: unitPlan.units.map((unit) => ({
      unitId: unit.unitId,
      ordinal: unit.ordinal,
      artifact: clone(artifact),
    })),
  });
};
const scope = (
  foundation: CommercialDocumentReconciliationResult,
  scopeType: CommercialDocumentScope['scopeType'],
  selector: CommercialDocumentScope['selector'],
  exclusions: CommercialDocumentScope['exclusions'] = {},
  id = 'scope-semantic',
): ReconciledEntity<CommercialDocumentScope> => ({
  reconciledId: id,
  value: {
    scopeId: id,
    scopeType,
    selector,
    exclusions,
    evidenceBlockIds: [],
    ambiguous: false,
    requiresReview: false,
  },
  provenance: foundation.scopes[0]?.provenance ?? [],
});
const oneRule = (
  base: CommercialDocumentReconciliationResult,
  selectedScope: ReconciledEntity<CommercialDocumentScope>,
): CommercialDocumentReconciliationResult => ({
  ...clone(base),
  facts: [
    {
      ...clone(base.facts[0]!),
      reconciledId: 'fact-semantic-1',
      value: {
        ...clone(base.facts[0]!.value),
        factId: 'fact-semantic-1',
        scopeIds: [selectedScope.reconciledId],
      },
    },
  ],
  scopes: [selectedScope],
  composition: { groups: [], relationships: [] },
  conflicts: [],
  issues: [],
  unresolvedAmbiguities: [],
  status: 'complete',
});
const documentFoundation = (
  base = foundationFrom(),
  exclusions: CommercialDocumentScope['exclusions'] = {},
) => oneRule(base, scope(base, 'DOCUMENT', { documentIds: ['document-main'] }, exclusions));
const vehicleIds = (foundation: CommercialDocumentReconciliationResult): string[] =>
  foundation.vehicleIdentities.map((item) => item.reconciledId);
const resultFor = (
  foundation: CommercialDocumentReconciliationResult,
  directives?: SemanticReconciliationDirectives,
) => reconcileCommercialDocumentSemantics({ foundation, ...(directives ? { directives } : {}) });
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

describe('Sprint 10C.3D Semantic Reconciliation', () => {
  it('A propagates a document-wide rule to 4 vehicles', () => {
    expect(resultFor(documentFoundation()).ruleApplicability[0]!.resolvedRecipientIds).toHaveLength(
      4,
    );
  });

  it('B/AB propagates a document-wide rule to Fiat-like 100 identities', () => {
    const foundation = foundationFrom(
      fiatLikeCommercialDocumentMapFixture,
      fiatLikeCommercialDocumentExtractionFixture,
    );
    const result = resultFor(documentFoundation(foundation));
    expect(result.ruleApplicability[0]!.resolvedRecipientIds).toHaveLength(100);
    expect(result.coverage.recipientCount).toBe(100);
  });

  it('C resolves MODEL scope exactly', () => {
    const base = foundationFrom();
    const model = base.vehicleIdentities[0]!.value.model;
    expect(
      resultFor(oneRule(base, scope(base, 'MODEL', { models: [model] }))).ruleApplicability[0]!
        .resolvedRecipientIds,
    ).toHaveLength(4);
  });

  it('D resolves VERSION_SET scope exactly', () => {
    const base = foundationFrom();
    const versions = base.vehicleIdentities.slice(0, 2).map((item) => item.value.version!);
    expect(
      resultFor(oneRule(base, scope(base, 'VERSION_SET', { versions }))).ruleApplicability[0]!
        .resolvedRecipientIds,
    ).toHaveLength(2);
  });

  it('E resolves VEHICLE scope by reconciled identity', () => {
    const base = foundationFrom();
    const selected = vehicleIds(base)[0]!;
    const result = resultFor(
      oneRule(base, scope(base, 'VEHICLE', { vehicleIdentityIds: [selected] })),
    );
    expect(result.ruleApplicability[0]!.resolvedRecipientIds).toEqual([
      `recipient-vehicle-${selected}`,
    ]);
  });

  it('F/AC filters a rule to structurally associated Volvo-like channel recipients', () => {
    const base = foundationFrom(
      volvoLikeCommercialDocumentMapFixture,
      volvoLikeCommercialDocumentExtractionFixture,
    );
    const channelFact = base.facts.find((item) => item.value.channel)!;
    const narrowed = {
      ...clone(base),
      facts: [channelFact],
      conflicts: [],
      issues: [],
      unresolvedAmbiguities: [],
      status: 'complete' as const,
    };
    const result = resultFor(narrowed);
    expect(result.rules[0]!.channelConstraints).toContain(channelFact.value.channel);
    expect(result.ruleApplicability[0]!.resolvedRecipientIds.length).toBeGreaterThan(0);
    expect(result.ruleApplicability[0]!.resolvedRecipientIds.length).toBeLessThanOrEqual(20);
  });

  it('G resolves GROUP scope through group member scopes', () => {
    const base = foundationFrom();
    const selected = vehicleIds(base)[0]!;
    const vehicleScope = scope(
      base,
      'VEHICLE',
      { vehicleIdentityIds: [selected] },
      {},
      'scope-member',
    );
    const groupScope = scope(base, 'GROUP', { groupIds: ['group-semantic'] });
    const foundation: CommercialDocumentReconciliationResult = {
      ...oneRule(base, groupScope),
      scopes: [groupScope, vehicleScope],
      composition: {
        groups: [
          {
            reconciledId: 'group-semantic',
            groupType: 'CUMULATIVE',
            memberFactIds: [],
            sharedFactIds: [],
            scopeIds: ['scope-member'],
            provenance: [],
          },
        ],
        relationships: [],
      },
    };
    expect(resultFor(foundation).ruleApplicability[0]!.resolvedRecipientIds).toEqual([
      `recipient-vehicle-${selected}`,
    ]);
  });

  it('H/J applies an exclusion before materializing a broad rule', () => {
    const base = foundationFrom();
    const excluded = vehicleIds(base)[0]!;
    const result = resultFor(documentFoundation(base, { vehicleIdentityIds: [excluded] }));
    expect(result.ruleApplicability[0]!.resolvedRecipientIds).toHaveLength(3);
    expect(result.ruleApplicability[0]!.excludedRecipientIds).toEqual([
      `recipient-vehicle-${excluded}`,
    ]);
  });

  it('I applies multiple exact exclusions', () => {
    const base = foundationFrom();
    const excluded = vehicleIds(base).slice(0, 2);
    const result = resultFor(documentFoundation(base, { vehicleIdentityIds: excluded }));
    expect(result.ruleApplicability[0]!.resolvedRecipientIds).toHaveLength(2);
    expect(result.ruleApplicability[0]!.excludedRecipientIds).toHaveLength(2);
  });

  it('applies a version exclusion to a model rule', () => {
    const base = foundationFrom();
    const selected = base.vehicleIdentities[0]!;
    const result = resultFor(
      oneRule(
        base,
        scope(
          base,
          'MODEL',
          { models: [selected.value.model] },
          { versions: [selected.value.version!] },
        ),
      ),
    );
    expect(result.ruleApplicability[0]!.resolvedRecipientIds).toHaveLength(3);
  });

  it('applies channel exclusions only through explicit channel associations', () => {
    const base = foundationFrom(
      volvoLikeCommercialDocumentMapFixture,
      volvoLikeCommercialDocumentExtractionFixture,
    );
    const broad = documentFoundation(base, { channels: ['Varejo'] });
    const foundation: CommercialDocumentReconciliationResult = {
      ...broad,
      facts: [...broad.facts, ...base.facts],
      scopes: [...broad.scopes, ...base.scopes],
    };
    const result = resultFor(foundation);
    const rule = result.rules.find((item) => item.sourceFactRefs.includes('fact-semantic-1'))!;
    expect(
      result.ruleApplicability.find((item) => item.ruleId === rule.ruleId)!.excludedRecipientIds
        .length,
    ).toBeGreaterThan(0);
  });

  it('applies a group exclusion to its explicit members', () => {
    const base = foundationFrom();
    const selected = vehicleIds(base)[0]!;
    const memberScope = scope(
      base,
      'VEHICLE',
      { vehicleIdentityIds: [selected] },
      {},
      'scope-member',
    );
    const broad = scope(
      base,
      'DOCUMENT',
      { documentIds: ['document-main'] },
      { groupIds: ['group-excluded'] },
    );
    const foundation: CommercialDocumentReconciliationResult = {
      ...oneRule(base, broad),
      scopes: [broad, memberScope],
      composition: {
        groups: [
          {
            reconciledId: 'group-excluded',
            groupType: 'CUMULATIVE',
            memberFactIds: [],
            sharedFactIds: [],
            scopeIds: ['scope-member'],
            provenance: [],
          },
        ],
        relationships: [],
      },
    };
    expect(resultFor(foundation).ruleApplicability[0]!.excludedRecipientIds).toEqual([
      `recipient-vehicle-${selected}`,
    ]);
  });

  it('K/L preserves cumulative and alternative group recipients', () => {
    const base = foundationFrom();
    const result = resultFor(base);
    expect(result.recipients.some((item) => item.recipientType === 'GROUP')).toBe(true);
    expect(base.composition.groups.some((item) => item.groupType === 'CUMULATIVE')).toBe(true);
    expect(base.composition.groups.some((item) => item.groupType === 'ALTERNATIVE')).toBe(true);
  });

  it('M applies a general shared rule across both alternative branches', () => {
    const base = foundationFrom();
    const shared = base.composition.groups.find((item) => item.groupType === 'ALTERNATIVE')!
      .sharedFactIds[0]!;
    const result = resultFor(base);
    const rule = result.rules.find((item) => item.sourceFactRefs.includes(shared))!;
    expect(rule.compositionGroupRefs.length).toBeGreaterThan(0);
    expect(
      result.ruleApplicability.find((item) => item.ruleId === rule.ruleId)!.resolvedRecipientIds
        .length,
    ).toBeGreaterThan(1);
  });

  it('N resolves an explicit documentary alias', () => {
    const base = foundationFrom();
    const selected = base.vehicleIdentities[0]!.value;
    const foundation = oneRule(base, scope(base, 'MODEL', { models: ['Declared Alias'] }));
    const result = resultFor(foundation, {
      aliases: [
        {
          alias: 'Declared Alias',
          canonicalLabel: selected.model,
          recipientType: 'MODEL',
          provenance: [],
        },
      ],
    });
    expect(result.ruleApplicability[0]!.resolvedRecipientIds).toHaveLength(4);
  });

  it('O refuses an alias with conflicting explicit targets', () => {
    const base = foundationFrom();
    const foundation = oneRule(base, scope(base, 'MODEL', { models: ['Alias'] }));
    const aliases: SemanticReconciliationDirectives['aliases'] = [
      { alias: 'Alias', canonicalLabel: 'Model A', recipientType: 'MODEL', provenance: [] },
      { alias: 'Alias', canonicalLabel: 'Model B', recipientType: 'MODEL', provenance: [] },
    ];
    expect(resultFor(foundation, { aliases }).semanticIssues.map((item) => item.code)).toContain(
      'AMBIGUOUS_ALIAS',
    );
  });

  it('P accepts a note/context with explicit scope without inventing proximity', () => {
    const foundation = documentFoundation();
    const factRef = foundation.facts[0]!.reconciledId;
    const result = resultFor(foundation, {
      contexts: [
        {
          factRef,
          contextRef: 'note-explicit',
          scopeRefs: foundation.facts[0]!.value.scopeIds,
          explicitlyScoped: true,
          provenance: [],
        },
      ],
    });
    expect(result.semanticIssues.map((item) => item.code)).not.toContain('UNRESOLVED_CONTEXT');
  });

  it('Q reports a note/context without resolvable scope', () => {
    const foundation = documentFoundation();
    const result = resultFor(foundation, {
      contexts: [
        {
          factRef: foundation.facts[0]!.reconciledId,
          contextRef: 'note-positional-only',
          scopeRefs: [],
          explicitlyScoped: false,
          provenance: [],
        },
      ],
    });
    expect(result.semanticIssues.map((item) => item.code)).toContain('UNRESOLVED_CONTEXT');
  });

  const conflictingFoundation = (overlap = true): CommercialDocumentReconciliationResult => {
    const base = documentFoundation();
    const original = clone(base.facts[0]!);
    const first = {
      ...original,
      reconciledId: 'fact-old',
      value: {
        ...original.value,
        factId: 'fact-old',
        value: { kind: 'money' as const, amount: '100.00', currency: 'BRL' },
        validity: { startsOn: '2026-01-01', endsOn: overlap ? '2026-12-31' : '2026-03-31' },
      },
    };
    const second = {
      ...clone(first),
      reconciledId: 'fact-new',
      value: {
        ...clone(first.value),
        factId: 'fact-new',
        value: { kind: 'money' as const, amount: '90.00', currency: 'BRL' },
        validity: { startsOn: overlap ? '2026-06-01' : '2026-04-01', endsOn: '2026-12-31' },
      },
    };
    return { ...base, facts: [first, second] };
  };

  it('R resolves an explicit errata replacement with provenance', () => {
    const foundation = conflictingFoundation();
    const result = resultFor(foundation, {
      precedence: [
        {
          earlierFactRef: 'fact-old',
          laterFactRef: 'fact-new',
          relation: 'REPLACES',
          provenance: foundation.facts[0]!.provenance,
        },
      ],
    });
    expect(result.resolvedConflicts).toHaveLength(1);
    expect(
      result.rules.find((item) => item.sourceFactRefs.includes('fact-old'))!.supersededByRuleId,
    ).toBeTruthy();
  });

  it('S preserves a supplement as an added rule without false replacement', () => {
    const foundation = conflictingFoundation(false);
    const result = resultFor(foundation, {
      precedence: [
        {
          earlierFactRef: 'fact-old',
          laterFactRef: 'fact-new',
          relation: 'SUPPLEMENTS',
          provenance: [],
        },
      ],
    });
    expect(result.rules).toHaveLength(2);
    expect(result.resolvedConflicts).toHaveLength(0);
  });

  it('T retains conflict when there is no explicit precedence', () => {
    const result = resultFor(conflictingFoundation());
    expect(result.unresolvedConflicts).toHaveLength(1);
    expect(result.status).toBe('conflicted');
  });

  it('U does not conflict when validity periods do not overlap', () => {
    expect(resultFor(conflictingFoundation(false)).unresolvedConflicts).toHaveLength(0);
  });

  it('V detects incompatible values with overlapping validity', () => {
    expect(
      resultFor(conflictingFoundation(true)).semanticIssues.map((item) => item.code),
    ).toContain('OVERLAPPING_RULE_CONFLICT');
  });

  it('W enforces bidirectional rule-recipient consistency', () => {
    const result = resultFor(documentFoundation());
    expect(() => validateSemanticallyReconciledCommercialDocument(result)).not.toThrow();
    for (const forward of result.ruleApplicability)
      for (const recipientId of forward.resolvedRecipientIds)
        expect(
          result.recipientApplicability.find((item) => item.recipientId === recipientId)!
            .applicableRuleIds,
        ).toContain(forward.ruleId);
  });

  it('X reports complete semantic coverage', () => {
    expect(resultFor(documentFoundation()).coverage.status).toBe('complete');
  });

  it('Y reports partial semantic coverage for unresolved scope', () => {
    const base = foundationFrom();
    const result = resultFor(
      oneRule(base, scope(base, 'MODEL', { models: ['Missing documentary model'] })),
    );
    expect(result.coverage.status).toBe('partial');
    expect(result.semanticIssues.map((item) => item.code)).toContain('UNRESOLVED_SCOPE');
  });

  it('Z produces byte-equivalent deterministic output', () => {
    const foundation = documentFoundation();
    const first = resultFor(foundation);
    const permuted = {
      ...clone(foundation),
      vehicleIdentities: [...clone(foundation.vehicleIdentities)].reverse(),
      scopes: [...clone(foundation.scopes)].reverse(),
    };
    expect(JSON.stringify(resultFor(permuted))).toBe(JSON.stringify(first));
  });

  it('AA does not mutate a deep-frozen foundation or directives', () => {
    const input = deepFreeze({ foundation: documentFoundation(), directives: { aliases: [] } });
    expect(() => reconcileCommercialDocumentSemantics(input)).not.toThrow();
  });

  it('AD emits no domain Product, Policy, Offer, or promotion fields', () => {
    expect(JSON.stringify(resultFor(documentFoundation()))).not.toMatch(
      /productId|commercialPolicy|commercialOffer|promotionPlan/iu,
    );
  });
});
