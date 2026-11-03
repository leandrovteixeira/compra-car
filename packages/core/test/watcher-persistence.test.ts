import { describe, expect, it } from 'vitest';
import {
  createWatcherArticleObservation,
  validateWatcherPersistInput,
  validateWatcherRegistration,
  validateWatcherCandidate,
  validateWatcherCandidateEvidence,
} from '../src/agents';
const id = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-25T12:00:00Z';
const source = {
  id: 'rss',
  feedUrl: 'https://auto.example.br/rss',
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const settings = {
  requestUrl: source.feedUrl,
  allowedHosts: ['auto.example.br'],
  allowedArticleHosts: ['auto.example.br'],
  allowRelativeUrls: false,
  pollIntervalSeconds: 3600,
};
const observation = createWatcherArticleObservation(
  {
    sourceId: 'rss',
    guid: 'one',
    url: 'https://auto.example.br/a',
    title: 'Article',
    excerpt: null,
    publishedAt: null,
    updatedAt: null,
  },
  at,
);
const input = {
  batchId: id,
  lease: {
    sourceId: 'rss',
    token: id,
    owner: 'worker',
    expiresAt: at,
    configVersion: 1,
    stateVersion: 0,
  },
  batch: {
    schemaVersion: 'watcher-ingestion/1' as const,
    sourceId: 'rss',
    observedAt: at,
    observations: [observation],
    failures: [],
  },
  checkpoint: { sourceId: 'rss', etag: 'v1', lastModified: null, lastSuccessfulObservedAt: at },
  advanceCheckpoint: true,
  checkpointBlockedReason: null,
  diagnostics: [],
};
describe('pure Watcher persistence contracts', () => {
  it('normalizes source config but preserves actual request path/query', () => {
    const result = validateWatcherRegistration(source, {
      ...settings,
      requestUrl: 'https://AUTO.example.br/rss/?utm_source=x#ignored',
    });
    expect(result.settings.requestUrl).toBe('https://auto.example.br/rss/?utm_source=x');
    expect(result.source.feedUrl).toBe(source.feedUrl);
  });
  it.each([
    { ...settings, allowedHosts: ['evil.example.org'] },
    { ...settings, requestUrl: 'http://auto.example.br/rss' },
    { ...settings, allowedArticleHosts: ['127.0.0.1'] },
    { ...settings, pollIntervalSeconds: 1 },
    { ...settings, allowRelativeUrls: 'yes' },
  ])('rejects invalid registration %j', (value) => {
    expect(() => validateWatcherRegistration(source, value as never)).toThrow();
  });
  it('validates idempotent normalized persist payload without reading a clock', () => {
    const p = validateWatcherPersistInput(input);
    expect(validateWatcherPersistInput(p)).toEqual(p);
    expect(p.batch.observations[0].evidenceFingerprint).toBe(observation.evidenceFingerprint);
  });
  it.each([
    { ...input, batchId: 'bad' },
    { ...input, lease: { ...input.lease, sourceId: 'other' } },
    { ...input, lease: { ...input.lease, stateVersion: -1 } },
    { ...input, checkpoint: { ...input.checkpoint, etag: 'x\r\nheader' } },
    { ...input, advanceCheckpoint: false },
    { ...input, checkpointBlockedReason: 'CONFLICT' },
    { ...input, diagnostics: [{ code: 'ITEMS_TRUNCATED', itemIndex: null }] },
  ])('rejects unsafe commit %j', (value) => {
    expect(() => validateWatcherPersistInput(value as never)).toThrow();
  });
  it('allows explicit blocked partial commit but never advances checkpoint', () => {
    const result = validateWatcherPersistInput({
      ...input,
      advanceCheckpoint: false,
      checkpointBlockedReason: 'LIMIT_EXCEEDED',
    });
    expect(result.advanceCheckpoint).toBe(false);
  });
  it('separates candidate identity and evidence confirmation from news publication', () => {
    const c = {
      id,
      brand: ' Ford ',
      modelHint: 'Puma',
      projectCode: null,
      aliases: ['Novo Puma', 'Novo Puma'],
      status: 'OBSERVED' as const,
    };
    const result = validateWatcherCandidate(c);
    expect(result.aliases).toEqual(['Novo Puma']);
    expect(validateWatcherCandidate({ ...c, brand: 'Ford' }).identityKey).toBe(result.identityKey);
    expect(() =>
      validateWatcherCandidateEvidence({
        candidateId: id,
        candidateVersion: 1,
        revisionId: id,
        assertion: 'BR_CONFIRMED',
        actorId: null,
        note: 'Unreviewed',
      }),
    ).toThrow();
  });
});
