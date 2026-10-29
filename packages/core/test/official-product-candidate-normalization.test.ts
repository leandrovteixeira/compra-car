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
  it('preserves a nameless commercial base version without inventing a trim', () => {
    expect(normalizeDiscoveredVariantLabels({
      brand: 'GWM',
      model: 'HAVAL H7',
      officialVersionLabel: 'HAVAL H7',
      trim: null,
    })).toEqual({
      brand: 'GWM',
      model: 'HAVAL H7',
      officialVersionLabel: null,
      trim: null,
    });
  });

  it('normalizes GWM Tank 300 while preserving the TerraForce distinction', () => {
    expect(normalizeDiscoveredVariantLabels({
      brand: 'GWM',
      model: 'GWM TANK 300',
      officialVersionLabel: 'GWM TANK 300',
      trim: null,
    })).toEqual({
      brand: 'GWM',
      model: 'TANK 300',
      officialVersionLabel: null,
      trim: null,
    });
    expect(normalizeDiscoveredVariantLabels({
      brand: 'GWM',
      model: 'GWM TANK 300',
      officialVersionLabel: 'TERRAFORCE',
      trim: 'TerraForce',
    }).officialVersionLabel).toBe('TERRAFORCE');
  });

});
