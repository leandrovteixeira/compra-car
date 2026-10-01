import { describe, expect, it, vi } from 'vitest';
import { applyAcceptedMmvFinding, type MmvAdminDependencies } from '../src/application/admin/mmv-catalog';
import type { AgentFindingDetail, AgentPlatformRepository } from '@compra-car/core/agent-platform';
import type { CanonicalMmvRepository } from '@compra-car/core/agents';

const actor = '22000000-0000-4000-8000-000000000001';
const findingId = '22000000-0000-4000-8000-000000000002';
const runId = '22000000-0000-4000-8000-000000000003';
const reviewId = '22000000-0000-4000-8000-000000000004';

function detail(): AgentFindingDetail {
  return {
    run: {
      id: runId,
      agentType: 'MMV_DISCOVERY',
      status: 'COMPLETED',
      market: 'BR',
      brand: 'Jeep',
      provider: 'fixture',
      runMode: 'dry-run',
      schemaVersion: '20E.1',
      startedAt: '2026-10-01T18:00:00Z',
      completedAt: '2026-10-01T18:01:00Z',
      input: {},
      summary: {},
      configSnapshot: {},
      error: null,
      sourceCommitSha: null,
      createdBy: null,
      createdAt: '2026-10-01T18:00:00Z',
      updatedAt: '2026-10-01T18:01:00Z',
    },
    finding: {
      id: findingId,
      runId,
      findingType: 'NEW_VERSION',
      fingerprint: 'finding-fingerprint',
      subjectKey: 'subject',
      title: 'Jeep Commander Overland',
      summary: 'Synthetic',
      confidence: 0.99,
      requiresReview: true,
      subject: { brand: 'Jeep', model: 'Commander' },
      proposal: {
        action: 'STAGE_MMV_IDENTITIES',
        market: 'BR',
        identities: [
          {
            identityKey: 'identity-key',
            brand: 'Jeep',
            model: 'Commander',
            officialVersionLabel: 'Overland',
          },
        ],
      },
      payload: { reasonCode: 'NEW_COMMERCIAL_VARIANT' },
      createdAt: '2026-10-01T18:01:00Z',
      updatedAt: '2026-10-01T18:01:00Z',
    },
    evidence: [],
    reviews: [
      {
        id: reviewId,
        findingId,
        decision: 'ACCEPT',
        note: null,
        reviewedBy: actor,
        createdAt: '2026-10-01T18:02:00Z',
      },
    ],
    latestReview: {
      id: reviewId,
      findingId,
      decision: 'ACCEPT',
      note: null,
      reviewedBy: actor,
      createdAt: '2026-10-01T18:02:00Z',
    },
  };
}

function form(fingerprint = 'finding-fingerprint') {
  const data = new FormData();
  data.set('findingId', findingId);
  data.set('expectedFingerprint', fingerprint);
  return data;
}

function dependencies(detailValue = detail()) {
  const applyAcceptedProposal = vi.fn<CanonicalMmvRepository['applyAcceptedProposal']>(async () => [
    {
      id: '22000000-0000-4000-8000-000000000005',
      market: 'BR',
      identityKey: 'identity-key',
      brand: 'Jeep',
      model: 'Commander',
      officialVersionLabel: 'Overland',
      bodyStyle: null,
      powertrainLabel: null,
      propulsion: null,
      engineDisplacement: null,
      status: 'ACTIVE',
      visibility: 'PRIVATE',
      sourceFindingId: findingId,
      lastConfirmedFindingId: findingId,
      createdBy: actor,
      createdAt: '2026-10-01T18:03:00Z',
      updatedAt: '2026-10-01T18:03:00Z',
    },
  ]);
  const platform = {
    getFinding: vi.fn(async () => detailValue),
  } as unknown as AgentPlatformRepository;
  const deps: MmvAdminDependencies = {
    authorize: vi.fn(async () => ({ profile: { id: actor } })),
    platform: () => platform,
    repository: () => ({ listCanonicalMmvs: vi.fn(async () => []), applyAcceptedProposal }),
    revalidate: vi.fn(),
  };
  return { deps, applyAcceptedProposal };
}

describe('MMV Admin apply', () => {
  it('applies only the accepted current proposal and never creates Product/MY', async () => {
    const { deps, applyAcceptedProposal } = dependencies();
    const result = await applyAcceptedMmvFinding(form(), deps);
    expect(result).toEqual({
      status: 'success',
      message: '1 MMV(s) aplicado(s) ao catálogo MMV. Nenhum Product/MY foi criado.',
    });
    expect(applyAcceptedProposal).toHaveBeenCalledWith({
      findingId,
      actor,
      proposal: detail().finding.proposal,
      expectedFingerprint: 'finding-fingerprint',
    });
    expect(deps.revalidate).toHaveBeenCalledWith('/admin/agents');
    expect(deps.revalidate).toHaveBeenCalledWith('/admin/agents/findings/' + findingId);
  });

  it('blocks a stale browser fingerprint before the repository write', async () => {
    const { deps, applyAcceptedProposal } = dependencies();
    const result = await applyAcceptedMmvFinding(form('older-fingerprint'), deps);
    expect(result.status).toBe('error');
    expect(applyAcceptedProposal).not.toHaveBeenCalled();
  });

  it('blocks non-ACCEPT reviews before repository write', async () => {
    const value = detail();
    const rejected = {
      ...value,
      latestReview: { ...value.latestReview!, decision: 'REJECT' as const },
    };
    const { deps, applyAcceptedProposal } = dependencies(rejected);
    expect((await applyAcceptedMmvFinding(form(), deps)).status).toBe('error');
    expect(applyAcceptedProposal).not.toHaveBeenCalled();
  });
});
