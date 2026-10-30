import { describe, it, expect } from 'vitest';
import {
  NewProductCheckAgent,
  FixtureProductCatalogReader,
  FixtureProductResearchProvider,
  mapMmvRunToPlatform,
  mmvEvidenceFingerprint,
  jeepCapturedMmvCandidates,
  jeepCapturedMmvCatalog,
} from '../src/agents';
import { platformFixtureId } from '../src/agent-platform/testing';
async function result(captured = false) {
  return new NewProductCheckAgent({
    research: captured
      ? {
          researchProducts: async () => ({
            candidates: jeepCapturedMmvCandidates,
            metadata: { provider: 'fixture' },
          }),
        }
      : new FixtureProductResearchProvider(),
    catalog: captured
      ? { readProducts: async () => jeepCapturedMmvCatalog }
      : new FixtureProductCatalogReader(),
    reports: { write: async () => {} },
  }).run({ brand: 'Jeep', country: 'BR' }, platformFixtureId(1));
}
describe('MMV platform mapping', () => {
  it('retains evidence-backed nameless base models for review without inventing a label', async () => {
    const original = await result();
    const exemplar = original.findings.find((finding) => finding.type === 'NEW_MODEL')!;
    const candidate = {
      ...exemplar.candidate,
      brand: 'GWM',
      model: 'HAVAL H7',
      taxonomy: 'MODEL' as const,
      trim: null,
      officialVersionLabel: null,
    };
    const finding = {
      ...exemplar,
      candidate,
      variants: [candidate],
      reasonCode: 'NEW_MODEL' as const,
    };
    const bundle = mapMmvRunToPlatform({
      ...original,
      brand: 'GWM',
      findings: [finding],
      matchedCandidates: [],
      bodyModelProposals: [],
    }, { provider: 'fixture' });
    const mapped = bundle.findings[0]!.finding;
    expect(mapped.proposal?.action).toBe('REVIEW_UNNAMED_MMV');
    expect(mapped.proposal?.unnamedCandidates).toHaveLength(1);
    expect(mapped.payload.unnamedCommercialVersions).toHaveLength(1);
    expect(JSON.stringify(mapped.proposal)).not.toContain('Versão única');
  });

  it('does not silently omit an unnamed base when a named edition exists', async () => {
    const original = await result();
    const sample = original.findings.find((finding) => finding.type === 'NEW_MODEL')!;
    const base = {
      ...sample.candidate,
      brand: 'GWM',
      model: 'TANK 300',
      taxonomy: 'VARIANT' as const,
      officialVersionLabel: null,
      trim: null,
    };
    const edition = {
      ...base,
      officialVersionLabel: 'TerraForce',
      trim: 'TerraForce',
    };
    const finding = {
      ...sample,
      candidate: { ...base, taxonomy: 'MODEL' as const },
      variants: [base, edition],
      reasonCode: 'NEW_MODEL' as const,
    };
    const mapped = mapMmvRunToPlatform({
      ...original,
      brand: 'GWM',
      findings: [finding],
      matchedCandidates: [],
      bodyModelProposals: [],
    }, { provider: 'fixture' }).findings[0]!.finding;
    expect(mapped.proposal?.action).toBe('REVIEW_UNNAMED_MMV');
    expect(mapped.proposal?.namedIdentities).toHaveLength(1);
    expect(mapped.proposal?.unnamedCandidates).toHaveLength(1);
    expect(mapped.payload.unnamedCommercialVersions).toHaveLength(1);
  });

  it('maps all current types with review semantics and shared report UUID', async () => {
    const input = await result();
    const bundle = mapMmvRunToPlatform(input, { provider: 'fixture' });
    expect(bundle.run.id).toBe(input.runId);
    expect(bundle.findings.map((i) => i.finding.findingType)).toEqual([
      'MMV_MATCHED',
      'MMV_MATCHED',
      'MMV_MATCHED',
      'MMV_MATCHED',
      'NEW_VERSION',
      'AMBIGUOUS_MMV',
      'NEW_MODEL',
    ]);
    expect(bundle.findings.filter((i) => i.finding.requiresReview)).toHaveLength(3);
    for (const finding of input.findings)
      expect(bundle.findings.some((i) => i.finding.fingerprint === finding.fingerprint)).toBe(true);
  });
  it('persists reason codes in MMV finding payloads', async () => {
    const bundle = mapMmvRunToPlatform(await result(), { provider: 'fixture' });
    const newVersion = bundle.findings.find((item) => item.finding.findingType === 'NEW_VERSION')!;
    expect(typeof newVersion.finding.payload.reasonCode).toBe('string');
  });

  it('maps body/model proposals into reviewable ambiguous findings with evidence', async () => {
    const input = await result();
    const evidence = input.findings[0]!.candidate.evidence;
    const bundle = mapMmvRunToPlatform(
      {
        ...input,
        bodyModelProposals: [
          {
            reasonCode: 'POSSIBLE_BODY_SPLIT',
            currentModel: 'A3',
            bodyStyle: 'Sedan',
            proposedModel: 'A3 Sedan',
            requiresReview: true,
            evidence,
          },
        ],
      },
      { provider: 'fixture' },
    );
    const body = bundle.findings.find(
      (item) => item.finding.payload.reasonCode === 'POSSIBLE_BODY_SPLIT',
    )!;
    expect(body.finding).toMatchObject({
      findingType: 'AMBIGUOUS_MMV',
      requiresReview: true,
      proposal: {
        action: 'REVIEW_MODEL_BODY_SPLIT',
        currentModel: 'A3',
        bodyStyle: 'Sedan',
        proposedModel: 'A3 Sedan',
      },
    });
    expect(body.evidence.length).toBeGreaterThan(0);
  });

  it('stages directly applicable MMV identity proposals without creating products', async () => {
    const bundle = mapMmvRunToPlatform(await result(), { provider: 'fixture' });
    const proposal = bundle.findings.find(
      (item) => item.finding.proposal?.action === 'STAGE_MMV_IDENTITIES',
    );
    expect(proposal).toBeDefined();
    expect(proposal!.finding.requiresReview).toBe(true);
    expect(proposal!.finding.proposal).toMatchObject({
      action: 'STAGE_MMV_IDENTITIES',
      market: 'BR',
      identities: expect.any(Array),
    });
  });

  it('persists validation-only evidence readiness alongside reason codes', async () => {
    const bundle = mapMmvRunToPlatform(await result(), { provider: 'fixture' });
    const reviewable = bundle.findings.find(
      (item) => item.finding.requiresReview && typeof item.finding.payload.reasonCode === 'string',
    )!;
    expect(reviewable.finding.payload.evidenceAssessment).toMatchObject({
      maturity: 'VALIDATION',
      automationEligible: false,
      readiness: expect.any(String),
      corroborationLevel: expect.any(String),
    });
  });

  it('preserves canonical MMV and all four associated product rows', async () => {
    const bundle = mapMmvRunToPlatform(await result(true), { provider: 'fixture' });
    const item = bundle.findings.find((i) =>
      i.finding.title.includes('COMMANDER LONGITUDE T270 7L'),
    )!;
    expect(item.finding.payload.associatedProductRows).toHaveLength(4);
    expect(item.finding.subject.canonicalMmv).toHaveLength(1);
  });
  it('keeps evidence only in evidence rows, deduplicated with short excerpts', async () => {
    const bundle = mapMmvRunToPlatform(await result(), { provider: 'fixture' });
    for (const item of bundle.findings) {
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(new Set(item.evidence.map((e) => e.evidenceFingerprint)).size).toBe(
        item.evidence.length,
      );
      expect(JSON.stringify(item.finding.payload)).not.toContain('"evidence"');
      expect(
        item.evidence.every(
          (e) =>
            e.sourceUrl.startsWith('https://') &&
            e.sourceType &&
            e.evidenceFingerprint.length === 64,
        ),
      ).toBe(true);
    }
  });
  it('produces deterministic match and evidence fingerprints across mappings', async () => {
    const input = await result();
    const first = mapMmvRunToPlatform(input, { provider: 'fixture' }),
      second = mapMmvRunToPlatform(input, { provider: 'fixture' });
    expect(first.findings.map((i) => i.finding.fingerprint)).toEqual(
      second.findings.map((i) => i.finding.fingerprint),
    );
    expect(first.findings.map((i) => i.evidence.map((e) => e.evidenceFingerprint))).toEqual(
      second.findings.map((i) => i.evidence.map((e) => e.evidenceFingerprint)),
    );
    const e = {
      url: 'https://example.com',
      title: 'Source',
      excerpt: 'One',
      evidenceType: 'MODEL_PAGE' as const,
    };
    expect(mmvEvidenceFingerprint(e)).not.toBe(mmvEvidenceFingerprint({ ...e, excerpt: 'Two' }));
    expect(mmvEvidenceFingerprint(e)).not.toBe(
      mmvEvidenceFingerprint({ ...e, sourceKind: 'FIPE' }),
    );
  });
  it('uses an allowlisted config and input, excluding provider raw metadata', async () => {
    const input = await result();
    const bundle = mapMmvRunToPlatform(
      { ...input, researchMetadata: { provider: 'fixture', responseId: 'secret-do-not-copy' } },
      { provider: 'fixture' },
    );
    expect(JSON.stringify(bundle)).not.toContain('secret-do-not-copy');
    expect(bundle.run.configSnapshot.persistence).toBe('operational-only');
  });
  it('attaches market reconciliation without changing canonical manufacturer labels', async () => {
    const input = await result();
    const newModel = input.findings.find((finding) => finding.type === 'NEW_MODEL')!;
    const version = newModel.variants[0]!.officialVersionLabel!;
    const bundle = mapMmvRunToPlatform(input, {
      provider: 'fixture',
      marketReconciliationByModel: {
        [newModel.candidate.model]: [
          {
            sourceKind: 'SECONDARY',
            sourceName: 'WEBMOTORS',
            sourceUrl: 'https://www.webmotors.com.br/tabela-fipe/synthetic',
            fipeCode: '999999-9',
            brand: newModel.candidate.brand,
            modelLabel: newModel.candidate.model + ' 1.0 ' + version,
            matchedVersionHint: version,
            modelYear: 2027,
            referencePeriod: null,
            confidence: 0.9,
            capturedAt: input.completedAt,
          },
        ],
      },
    });
    const item = bundle.findings.find(
      (finding) => finding.finding.fingerprint === newModel.fingerprint,
    )!;
    expect(item.finding.payload.marketReconciliation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          manufacturerVersionLabel: version,
          observations: [
            expect.objectContaining({
              fipeCode: '999999-9',
              sourceKind: 'SECONDARY',
            }),
          ],
        }),
      ]),
    );
    expect(item.finding.proposal).toMatchObject({
      action: 'STAGE_MMV_IDENTITIES',
      identities: expect.arrayContaining([
        expect.objectContaining({ officialVersionLabel: version }),
      ]),
    });
  });
});
