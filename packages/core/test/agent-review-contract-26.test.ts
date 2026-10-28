import { describe, expect, it } from 'vitest';
import {
  REVIEW_CASE_POLICIES,
  REVIEW_STATUSES,
  REVIEW_ACTIONS,
  validateReviewDecision,
  committedReviewStatus,
  reviewRowActions,
  type ReviewQueueItem,
  type ReviewDecisionCommand,
  normalizeAliasLabel,
  aliasScopeKey,
  resolveCanonicalAlias,
  planAliasMerge,
  type CanonicalAlias,
  type AliasScope,
  buildSpecCreateRows,
  validateSpecMergeTarget,
  type ScaleSpecCreate,
  type NumericSpecCreate,
  type BinarySpecCreate,
} from '../src/agent-platform';

const now = '2026-10-28T12:00:00Z';
const caseItem = (kind: ReviewQueueItem['caseKind']): ReviewQueueItem => ({
  caseId: 'case-1', caseKind: kind, sourceAgent: 'MMV_DISCOVERY',
  sourceFindingType: 'AMBIGUOUS_MMV', businessKey: 'BR/Kia/Niro/SX',
  title: 'Kia Niro SX', shortDescription: 'Identidade ambígua',
  recommendation: 'Escolha criar ou canonicalizar',
  confidence: 0.8, evidenceCount: 1, primaryEvidenceUrl: null,
  evidencePreview: 'Fonte oficial Kia Brasil', observedAt: now, status: 'WAITING', snapshotFingerprint: 'sha:1', caseVersion: 3,
});
const decision = (action: ReviewDecisionCommand['action']): ReviewDecisionCommand => ({
  caseId: 'case-1', action, expectedCaseVersion: 3,
  expectedSnapshotFingerprint: 'sha:1', idempotencyKey: 'request-1', actorId: 'operator-1',
});

const scope: AliasScope = {
  kind: 'MMV', market: 'BR', brandKey: 'kia', modelKey: 'niro',
  commercialPowertrainKey: null,
};
const alias = (overrides: Partial<CanonicalAlias> = {}): CanonicalAlias => ({
  id: 'a-1', scope, rawLabel: 'Niro SX Prestige',
  normalizedLabel: 'niro sx prestige', canonicalId: 'mmv-1', status: 'CONFIRMED',
  sourceUrl: 'https://kia.com.br/niro', sourceFindingId: 'finding-1',
  decisionId: 'decision-1', confirmedAt: now, revokedAt: null, ...overrides,
});
const specShared = {
  groupName: 'Convenience', equipmentGroup: 'Air Conditioner', specSet: 'A/C Type',
  groupNamePt: 'Conveniência', equipmentGroupPt: 'Ar condicionado', specSetPt: 'Tipo',
  displayPt: 'Ar-condicionado', commercialCategory: 'Conforto',
  displayOrder: 1690, isActive: true, notes: null,
} as const;
const scale = (): ScaleSpecCreate => ({
  ...specShared, type: 'scale', options: [
    { code: 'CO_1000', detail: 'None', detailPt: 'Sem ar-condicionado',
      unitPerceivedValue: 0, relativeValue: 0, isBaseline: true },
    { code: 'CO_1001', detail: 'Manual', detailPt: 'Manual',
      unitPerceivedValue: 0, relativeValue: 3300, isBaseline: false },
    { code: 'CO_1002', detail: 'Dual Zone', detailPt: 'Duas zonas',
      unitPerceivedValue: 0, relativeValue: 4590, isBaseline: false },
  ],
});

describe('Sprint 26 decision semantics', () => {
  it('keeps exactly four operator actions and four review statuses', () => {
    expect(REVIEW_ACTIONS).toEqual(['APPROVE', 'MERGE', 'REJECT', 'POSTPONE']);
    expect(REVIEW_STATUSES).toEqual(['WAITING', 'APPROVED', 'REJECTED', 'POSTPONED']);
  });
  it('never offers MERGE for complete new MMV, Model Year, price or connector', () => {
    for (const kind of ['MMV_NEW', 'MODEL_YEAR_NEW', 'PRICE_NEW', 'CONNECTOR_UPDATE'] as const)
      expect(REVIEW_CASE_POLICIES[kind].actions).toEqual(['APPROVE', 'REJECT', 'POSTPONE']);
  });
  it('offers creation and merge when MMV identity is ambiguous', () => {
    expect(REVIEW_CASE_POLICIES.MMV_AMBIGUOUS.actions)
      .toEqual(['APPROVE', 'MERGE', 'REJECT', 'POSTPONE']);
    expect(() => validateReviewDecision(caseItem('MMV_AMBIGUOUS'), decision('APPROVE')))
      .toThrow('CANONICAL_INPUT_REQUIRED');
    expect(validateReviewDecision(caseItem('MMV_AMBIGUOUS'), {
      ...decision('APPROVE'), canonicalInput: { brand: 'Kia', model: 'Niro', trim: 'SX' },
    })).toEqual({ action: 'APPROVE', effect: 'CREATE_MMV', target: null });
    expect(validateReviewDecision(caseItem('MMV_AMBIGUOUS'), {
      ...decision('MERGE'), canonicalTargetId: 'mmv-123',
    })).toEqual({ action: 'MERGE', effect: 'LINK_ALIAS', target: 'mmv-123' });
  });
  it('does not mistake an informational finding for work', () => {
    expect(REVIEW_CASE_POLICIES.MMV_MATCHED.showInReviewQueue).toBe(false);
    expect(() => validateReviewDecision(caseItem('MMV_MATCHED'), decision('APPROVE')))
      .toThrow('STALE_OR_INVALID_DECISION');
  });
  it('rejects stale case, optimistic version mismatch and missing merge target', () => {
    const item = caseItem('MMV_AMBIGUOUS');
    expect(() => validateReviewDecision(item, { ...decision('MERGE'), canonicalTargetId: '' }))
      .toThrow('INVALID_MERGE_TARGET');
    expect(() => validateReviewDecision(item, { ...decision('MERGE'),
      canonicalTargetId: 'mmv-1', expectedCaseVersion: 2 }))
      .toThrow('STALE_OR_INVALID_DECISION');
    expect(() => validateReviewDecision({ ...item, status: 'APPROVED' },
      { ...decision('MERGE'), canonicalTargetId: 'mmv-1' }))
      .toThrow('STALE_OR_INVALID_DECISION');
    expect(() => validateReviewDecision(item,
      { ...decision('POSTPONE'), canonicalInput: {} }))
      .toThrow('UNEXPECTED_CANONICAL_INPUT');
  });
  it('allows postponed cases to be decided later, but never reopens approved cases', () => {
    const postponed = { ...caseItem('MMV_AMBIGUOUS'), status: 'POSTPONED' as const };
    expect(reviewRowActions(postponed)).toContain('MERGE');
    expect(validateReviewDecision(postponed, {
      ...decision('MERGE'), canonicalTargetId: 'mmv-1',
    }).effect).toBe('LINK_ALIAS');
    expect(reviewRowActions({ ...postponed, status: 'REJECTED' })).toEqual([]);
  });
  it('only changes status after the caller records successful transaction', () => {
    expect(committedReviewStatus('APPROVE')).toBe('APPROVED');
    expect(committedReviewStatus('MERGE')).toBe('APPROVED');
    expect(committedReviewStatus('REJECT')).toBe('REJECTED');
    expect(committedReviewStatus('POSTPONE')).toBe('POSTPONED');
  });
});

describe('Sprint 26 canonical aliases', () => {
  it('normalizes accent/case and matches only within full domain scope', () => {
    expect(normalizeAliasLabel('  NIRO  SX-Préstige ')).toBe('niro sx prestige');
    const result = resolveCanonicalAlias([alias()], scope, 'NÍRO SX PRESTIGE');
    expect(result).toEqual({ state: 'MATCH', canonicalId: 'mmv-1', aliasIds: ['a-1'] });
    expect(resolveCanonicalAlias([alias()], {
      ...scope, modelKey: 'sportage',
    }, 'Niro SX Prestige')).toEqual({ state: 'MISS' });
    expect(aliasScopeKey(scope)).not.toBe(aliasScopeKey({
      ...scope, commercialPowertrainKey: 'hev',
    }));
  });
  it('never merges conflicting canonical targets under same alias scope', () => {
    const first = alias();
    const other = alias({ id: 'a-2', canonicalId: 'mmv-2' });
    expect(resolveCanonicalAlias([first, other], scope, first.rawLabel))
      .toEqual({ state: 'CONFLICT', canonicalIds: ['mmv-1', 'mmv-2'] });
    expect(() => planAliasMerge([first], other)).toThrow('ALIAS_CANONICAL_COLLISION');
    expect(planAliasMerge([first], alias({ id: 'a-3' })).operation).toBe('EXISTING');
    expect(planAliasMerge([], first).operation).toBe('INSERT');
  });
  it('does not resolve revoked aliases or accept malformed provenance', () => {
    expect(resolveCanonicalAlias([alias({
      status: 'REVOKED', revokedAt: '2026-10-29T12:00:00Z',
    })], scope, 'Niro SX Prestige')).toEqual({ state: 'MISS' });
    expect(() => planAliasMerge([], alias({ sourceFindingId: '' })))
      .toThrow('INVALID_ALIAS_BINDING');
  });
  it('separates scale field aliases from aliases of scale options', () => {
    const fieldScope: AliasScope = {
      kind: 'SPEC_FIELD', locale: 'pt-BR', categoryKey: 'conveniencia',
      valueType: 'scale', sourceContextKey: 'air-conditioning',
    };
    const optionScope: AliasScope = {
      kind: 'SCALE_OPTION', locale: 'pt-BR', familyKey: 'ac-type',
    };
    expect(aliasScopeKey(fieldScope)).not.toBe(aliasScopeKey(optionScope));
    expect(resolveCanonicalAlias([alias({
      scope: optionScope, rawLabel: 'Duas zonas', normalizedLabel: 'duas zonas',
      canonicalId: 'spec-400',
    })], fieldScope, 'Duas zonas')).toEqual({ state: 'MISS' });
  });
});

describe('Sprint 26 complete spec CREATE contract', () => {
  it('creates a complete binary spec row with English/Portuguese metadata and valuation', () => {
    const form: BinarySpecCreate = {
      ...specShared, type: 'binary', code: 'AD_9000', detail: 'AEB',
      detailPt: 'Frenagem automática', unitPerceivedValue: 700,
      relativeValue: 0,
    };
    expect(buildSpecCreateRows(form)).toEqual([expect.objectContaining({
      type: 'binary', code: 'AD_9000', unit: null, value_direction: null,
      detail_pt: 'Frenagem automática', unit_perceived_value: 700,
      is_baseline: false, display_order: 1690,
    })]);
  });
  it('requires numeric unit, direction, precision, multiplier and valuation', () => {
    const form: NumericSpecCreate = {
      ...specShared, type: 'numeric', code: 'CO_9000',
      detail: 'Display size', detailPt: 'Tamanho da tela',
      unit: 'inch', displayUnitPt: 'pol', valueDirection: 'Positive',
      displayDecimals: 2, displayMultiplier: 1, unitPerceivedValue: 150, relativeValue: 0,
    };
    expect(buildSpecCreateRows(form)[0]).toMatchObject({
      type: 'numeric', unit: 'inch', display_decimals: 2,
      display_multiplier: 1, value_direction: 'Positive',
    });
    expect(() => buildSpecCreateRows({ ...form, displayMultiplier: 0 }))
      .toThrow('INVALID_NUMERIC_METADATA');
    expect(() => buildSpecCreateRows({ ...form, unitPerceivedValue: -1 }))
      .toThrow('INVALID_VALUATION');
  });
  it('creates scale family as multiple codes, exactly one baseline and option valuations', () => {
    const rows = buildSpecCreateRows(scale());
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.type === 'scale' && r.display_order === 1690)).toBe(true);
    expect(rows.filter((r) => r.is_baseline)).toHaveLength(1);
    expect(rows[2]?.relative_value).toBe(4590);
    expect(rows[2]?.detail_pt).toBe('Duas zonas');
  });
  it('rejects duplicate options, missing baseline and incomplete translated metadata', () => {
    const original = scale();
    expect(() => buildSpecCreateRows({
      ...original, options: original.options.map(o => ({...o, isBaseline: false})),
    })).toThrow('SCALE_REQUIRES_ONE_BASELINE');
    expect(() => buildSpecCreateRows({
      ...original, options: [...original.options, { ...original.options[1]!, detail: 'Other' }],
    })).toThrow('DUPLICATE_SPEC_DEFINITION');
    expect(() => buildSpecCreateRows({ ...original, specSetPt: '' }))
      .toThrow('REQUIRED_SPECSETPT');
  });
  it('requires a different merge target for scale family versus scale option', () => {
    expect(validateSpecMergeTarget({
      kind: 'SPEC_FIELD', type: 'scale', scaleFamilyId: 'family-1',
    })).toBeTruthy();
    expect(validateSpecMergeTarget({
      kind: 'SCALE_OPTION', specId: 100, scaleFamilyId: 'family-1',
    })).toBeTruthy();
    expect(() => validateSpecMergeTarget({
      kind: 'SCALE_OPTION', specId: 0, scaleFamilyId: 'family-1',
    })).toThrow('INVALID_SPEC_MERGE_TARGET');
  });
});
