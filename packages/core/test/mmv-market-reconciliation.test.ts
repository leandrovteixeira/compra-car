import { describe, expect, it } from 'vitest';
import { groupMmvMarketObservations } from '../src/agents/mmv-market-reconciliation';

describe('groupMmvMarketObservations', () => {
  it('keeps manufacturer labels canonical while attaching FIPE/market observations', () => {
    const capturedAt = '2026-10-03T12:00:00.000Z';
    const result = groupMmvMarketObservations(
      ['EX', 'SX Prestige'],
      [
        {
          sourceKind: 'SECONDARY',
          sourceName: 'WEBMOTORS',
          sourceUrl: 'https://www.webmotors.com.br/tabela-fipe/kia/niro/ex',
          fipeCode: '018099-8',
          brand: 'Kia',
          modelLabel: 'Niro 1.6 GDI HEV EX DCT',
          matchedVersionHint: 'EX',
          modelYear: 2027,
          referencePeriod: null,
          confidence: 0.95,
          capturedAt,
        },
        {
          sourceKind: 'SECONDARY',
          sourceName: 'WEBMOTORS',
          sourceUrl: 'https://www.webmotors.com.br/tabela-fipe/kia/niro/sx-prestige',
          fipeCode: '018100-5',
          brand: 'Kia',
          modelLabel: 'Niro 1.6 GDI HEV SX Prestige DCT',
          matchedVersionHint: 'SX Prestige',
          modelYear: 2027,
          referencePeriod: null,
          confidence: 0.95,
          capturedAt,
        },
      ],
    );

    expect(result).toEqual([
      expect.objectContaining({
        manufacturerVersionLabel: 'EX',
        observations: [expect.objectContaining({ fipeCode: '018099-8' })],
      }),
      expect.objectContaining({
        manufacturerVersionLabel: 'SX Prestige',
        observations: [expect.objectContaining({ fipeCode: '018100-5' })],
      }),
    ]);
  });
});
