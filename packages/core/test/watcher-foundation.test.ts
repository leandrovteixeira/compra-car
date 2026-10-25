import { describe, expect, it } from 'vitest';
import {
  articleTextSimilarity, canonicalArticleUrl, compareWatcherArticles,
  isNewsEligible, preferredWatcherArticle, prepareWatcherHint,
  type WatcherArticle,
} from '../src/agents/watcher-foundation';

const base: WatcherArticle = {
  id: 'a', url: 'https://auto.example.br/new?utm_source=rss',
  title: 'Fabricante anuncia novo modelo', sourceId: 'oem',
  sourceRank: 1, publishedAt: '2026-10-20T12:00:00Z',
  market: 'BR', category: 'PRODUCTS', brand: 'Ford', model: 'Puma',
  excerpt: 'A fabricante anunciou oficialmente que seu novo modelo para o Brasil sera mostrado em breve durante um evento.',
};
describe('Watcher deterministic foundation', () => {
  it('canonicalizes tracking parameters without losing content parameters', () => {
    expect(canonicalArticleUrl('https://AUTO.example.br/a/?utm_source=x&model=puma#intro'))
      .toBe('https://auto.example.br/a?model=puma');
    expect(() => canonicalArticleUrl('file:///tmp/a')).toThrow('WATCHER_INVALID_URL');
  });
  it('uses five-word shingles, rejecting insufficient text', () => {
    expect(articleTextSimilarity('one two three four', 'one two three four')).toBeNull();
    expect(articleTextSimilarity(base.excerpt!, base.excerpt!)).toBe(1);
  });
  it('deduplicates canonical URLs regardless of marketing parameters', () => {
    expect(compareWatcherArticles(base, { ...base, id: 'b', url: 'https://auto.example.br/new' }).reason)
      .toBe('SAME_URL');
  });
  it('deduplicates within seven days only when brand, model and text agree', () => {
    const b = { ...base, id: 'b', url: 'https://journal.example.br/a',
      publishedAt: '2026-10-26T12:00:00Z' };
    expect(compareWatcherArticles(base, b).duplicate).toBe(true);
    expect(compareWatcherArticles(base, { ...b, publishedAt: '2026-10-28T12:00:01Z' }).duplicate)
      .toBe(false);
    expect(compareWatcherArticles(base, { ...b, model: 'Ranger' }).duplicate).toBe(false);
    expect(compareWatcherArticles(base, { ...b, excerpt: 'Curto' }).reason)
      .toBe('INSUFFICIENT_TEXT');
  });
  it('chooses a more authoritative source, without deleting other articles', () => {
    expect(preferredWatcherArticle(base, { ...base, id: 'c', sourceRank: 9 }).id).toBe('a');
  });
  it('filters sponsored or irrelevant news', () => {
    expect(isNewsEligible(base)).toBe(true);
    expect(isNewsEligible({ ...base, isSponsored: true })).toBe(false);
    expect(isNewsEligible({ ...base, category: 'IRRELEVANT' })).toBe(false);
  });
  it('requires confirmed Brazil launches and traceable names/codenames for handoff', () => {
    const valid = {
      watcherCandidateId: 'candidate-1', brand: 'Fiat', market: 'BR' as const,
      modelHint: 'Panda', projectCode: null, aliases: ['Novo Panda'],
      evidenceFingerprint: 'sha256-example', confirmedBrazil: true,
    };
    expect(prepareWatcherHint(valid).schemaVersion).toBe('watcher-brand-hint/1');
    expect(() => prepareWatcherHint({ ...valid, confirmedBrazil: false }))
      .toThrow('WATCHER_LAUNCH_NOT_CONFIRMED');
    expect(() => prepareWatcherHint({ ...valid, modelHint: null }))
      .toThrow('WATCHER_INVALID_HANDOFF');
    expect(prepareWatcherHint({ ...valid, modelHint: null, projectCode: 'X123' }).projectCode)
      .toBe('X123');
  });
});
