import { describe, expect, it } from 'vitest';
import {
  canonicalVehicleBrand,
  sameVehicleBrand,
  vehicleBrandComparisonKey,
} from '../src/agents/vehicle-brand-normalization';

describe('vehicle brand normalization', () => {
  it('canonicalizes VW to Volkswagen', () => {
    expect(canonicalVehicleBrand('VW')).toBe('Volkswagen');
    expect(vehicleBrandComparisonKey('VW')).toBe(vehicleBrandComparisonKey('Volkswagen'));
    expect(sameVehicleBrand('VW', 'Volkswagen')).toBe(true);
  });

  it('leaves unrelated manufacturer names untouched', () => {
    expect(canonicalVehicleBrand('Kia')).toBe('Kia');
    expect(sameVehicleBrand('Kia', 'Volkswagen')).toBe(false);
  });
});
