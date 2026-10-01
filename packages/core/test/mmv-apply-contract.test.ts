import { describe, expect, it } from 'vitest';
import { agentPlatformFixture, platformFixtureId } from '../src/agent-platform/testing';
import { mmvApplyEligibility } from '../src/agents';
import type { AgentFindingDetail, AgentReview } from '../src/agent-platform/types';

function detail(overrides: Partial<AgentFindingDetail['finding']> = {}, decision: AgentReview['decision'] | null = 'ACCEPT'): AgentFindingDetail {
  const { bundle } = agentPlatformFixture();
  const source = bundle.findings[1]!;
  const finding = {
    ...source.finding,
    findingType: 'NEW_MODEL' as const,
    fingerprint: 'mmv-proposal-v1',
    proposal: { action: 'STAGE_MMV_IDENTITIES', market: 'BR', identities: [{ identityKey: 'x', brand: 'Fixture Motors', model: 'Model X', officialVersionLabel: 'Version X' }] },
    payload: { reasonCode: 'NEW_MODEL' },
    ...overrides,
  };
  const review = decision === null ? null : {
    id: platformFixtureId(900),
    findingId: finding.id,
    decision,
    note: null,
    reviewedBy: platformFixtureId(901),
    createdAt: bundle.run.completedAt!,
  };
  return {
    finding,
    evidence: source.evidence,
    run: bundle.run,
    reviews: review ? [review] : [],
    latestReview: review,
  };
}

describe('MMV apply eligibility contract', () => {
  it('requires an accepted completed proposal and matching fingerprint', () => {
    expect(mmvApplyEligibility(detail(), { expectedFingerprint: 'mmv-proposal-v1' })).toMatchObject({
      eligible: true,
      reasonCode: 'NEW_MODEL',
      findingFingerprint: 'mmv-proposal-v1',
    });
  });

  it.each([null, 'REJECT', 'DEFER'] as const)('blocks review state %s', (decision) => {
    expect(mmvApplyEligibility(detail({}, decision))).toEqual({
      eligible: false,
      code: 'REVIEW_NOT_ACCEPTED',
    });
  });

  it('blocks review-only reason classes even after ACCEPT', () => {
    expect(
      mmvApplyEligibility(
        detail({ payload: { reasonCode: 'POSSIBLE_RENAME' } }),
      ),
    ).toEqual({ eligible: false, code: 'REVIEW_ONLY_REASON' });
  });

  it('blocks stale accepted proposals by fingerprint', () => {
    expect(mmvApplyEligibility(detail(), { expectedFingerprint: 'newer-fingerprint' })).toEqual({
      eligible: false,
      code: 'STALE_PROPOSAL',
    });
  });

  it('blocks missing executable proposal separately from review acceptance', () => {
    expect(mmvApplyEligibility(detail({ proposal: null }))).toEqual({
      eligible: false,
      code: 'MISSING_PROPOSAL',
    });
  });

  it('does not treat body split ambiguity as directly applicable', () => {
    expect(
      mmvApplyEligibility(
        detail({
          findingType: 'AMBIGUOUS_MMV',
          payload: { reasonCode: 'POSSIBLE_BODY_SPLIT' },
          proposal: { action: 'REVIEW_MODEL_BODY_SPLIT' },
        }),
      ),
    ).toEqual({ eligible: false, code: 'UNSUPPORTED_FINDING' });
  });
});
