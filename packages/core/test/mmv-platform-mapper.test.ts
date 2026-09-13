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
});
