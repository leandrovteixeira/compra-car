import { describe, it, expect } from 'vitest';
import { detectWatcherEvents } from '../src/agents/watcher-event-detection';

describe('Watcher event-first detection, without catalog lookup', () => {
  it('detects vehicle arrival without any known brand/model', () => {
    const events = detectWatcherEvents({title:'MG IM6 chega ao Brasil por R$ 368.990'});
    expect(events.some(e => e.kind === 'NEW_MODEL')).toBe(true);
    expect(events.every(e => e.quote.includes('MG IM6'))).toBe(true);
  });
  it('distinguishes a discounted price from MSRP', () => {
    const kinds = detectWatcherEvents({title:'BYD Song Pro GL tem R$ 28.500 de desconto no preço'}).map(e=>e.kind);
    expect(kinds).toContain('PROMOTION');
    expect(kinds).not.toContain('PRICE_CHANGE');
  });
  it('detects the arrival of an unknown brand', () => {
    const kinds = detectWatcherEvents({title:'Lepas mostra conceito e marca vem ao Brasil em 2027'}).map(e=>e.kind);
    expect(kinds).toContain('MARKET_ENTRY');
  });
  it('marks foreign industrial events without creating a Brazilian new model', () => {
    const events = detectWatcherEvents({title:'Audi investirá em fábrica nos EUA para produzir SUVs'});
    expect(events.some(e=>e.kind==='INDUSTRIAL' && e.foreignMarket)).toBe(true);
    expect(events.some(e=>e.kind==='NEW_MODEL')).toBe(false);
  });
  it('does not force any event for an editorial without matching expressions', () => {
    expect(detectWatcherEvents({title:'Uma reflexão sobre direção'})).toHaveLength(0);
  });
  it('keeps speculative qualification', () => {
    expect(detectWatcherEvents({title:'Jeep pode lançar novo modelo no Brasil'}).some(e=>e.uncertain)).toBe(true);
  });
});
