import { describe, expect, it } from 'vitest';
import { detectWatcherEvents } from '../src/agents/watcher-event-detection';
import type { WatcherIntelligenceContext } from '../src/agents/watcher-intelligence';
import { resolveWatcherEventEntity } from '../src/agents/watcher-event-entity-resolution';

const brands = [
  { id: 'byd', canonicalName: 'BYD', canonicalKey: 'byd', market: 'BR', aliases: [] },
  { id: 'vw', canonicalName: 'Volkswagen', canonicalKey: 'volkswagen', market: 'BR', aliases: ['VW'] },
];
const context: Pick<WatcherIntelligenceContext, 'brands' | 'mmvs'> = {
  brands,
  mmvs: [{ id: 'nivus-sense', brand: 'Volkswagen', model: 'Nivus', officialVersionLabel: 'Sense', market: 'BR' }],
};
const event = (title: string) => detectWatcherEvents({ title })[0]!;

describe('Watcher post-event entity resolution', () => {
  it('resolves a known catalog model without requiring an MMVY year', () => {
    expect(resolveWatcherEventEntity(event('VW Nivus ganha nova versão no Brasil'), context)).toMatchObject({
      status: 'KNOWN_MODEL', brandId: 'vw', model: 'Nivus', candidateEligible: false,
    });
  });
  it('keeps an unknown model as a brand-only lead, not a fake canonical identity', () => {
    expect(resolveWatcherEventEntity(event('BYD Song Pro ganha nova versão no Brasil'), context)).toMatchObject({
      status: 'BRAND_ONLY', brandId: 'byd', model: null, proposedModel: null,
    });
  });
  it('does not require a known brand to recognize an event', () => {
    expect(resolveWatcherEventEntity(event('MG IM6 chega ao Brasil por R$ 368.990'), context)).toMatchObject({
      status: 'UNKNOWN_BRAND', model: null,
    });
  });
  it('does not choose between multiple independently mentioned brands', () => {
    expect(resolveWatcherEventEntity(event('Volkswagen e BYD anunciam novo carro no Brasil'), context)).toMatchObject({
      status: 'AMBIGUOUS_BRAND', brandId: null,
    });
  });
});

describe('Watcher entity resolution audit metadata', () => {
  it('lists both brands for a real multi-brand headline without auto-selecting', () => {
    const resolution = resolveWatcherEventEntity(
      event('Volkswagen e BYD anunciam novo carro no Brasil'), context);
    expect(resolution.reason).toBe('MULTIPLE_BRANDS');
    expect(resolution.mentionedBrands).toEqual(['BYD', 'Volkswagen']);
    expect(resolution.candidateEligible).toBe(false);
  });
  it('explains brand-only detection without promoting an unknown model', () => {
    const resolution = resolveWatcherEventEntity(
      event('BYD Song Pro ganha nova versão no Brasil'), context);
    expect(resolution.reason).toBe('BRAND_WITHOUT_MODEL');
    expect(resolution.mentionedBrands).toEqual(['BYD']);
    expect(resolution.model).toBeNull();
  });
});
