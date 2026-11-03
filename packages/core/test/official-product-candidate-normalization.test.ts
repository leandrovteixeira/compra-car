import { describe, expect, it } from 'vitest';
import {
  normalizeDiscoveredVariantLabels,
  stripRedundantModelPrefix,
} from '../src/agents/official-product-candidate-normalization';

describe('official product candidate normalization', () => {
  it('strips one redundant model prefix from a version label', () => {
    expect(stripRedundantModelPrefix('Tera', 'Tera 170 TSI')).toBe('170 TSI');
    expect(stripRedundantModelPrefix('T-Cross', 'T-Cross Urban')).toBe('Urban');
  });

  it('does not alter labels that do not repeat the model', () => {
    expect(stripRedundantModelPrefix('T-Cross', 'Highline 250 TSI')).toBe(
      'Highline 250 TSI',
    );
  });

  it('normalizes official label and trim together', () => {
    expect(
      normalizeDiscoveredVariantLabels({
        model: 'Tera',
        officialVersionLabel: 'Tera 1.0 MPI',
        trim: 'Tera 1.0 MPI',
      }),
    ).toEqual({
      model: 'Tera',
      officialVersionLabel: '1.0 MPI',
      trim: '1.0 MPI',
    });
  });
});
