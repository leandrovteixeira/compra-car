import { describe, expect, it } from 'vitest';
import {
  canCompareCount, canExecuteFeature, comparisonLimit, featureAvailability,
  type AccountTier,
} from './entitlements-23c';

describe('Sprint 23C account entitlements', () => {
  const roles: AccountTier[] = ['visitor', 'public', 'corporate', 'admin', 'master'];

  it('keeps comparison limits on both sides of the public boundary', () => {
    expect(roles.map(comparisonLimit)).toEqual([3, 3, 8, 8, 8]);
    expect(canCompareCount('visitor', 4)).toBe(false);
    expect(canCompareCount('corporate', 9)).toBe(false);
    expect(canCompareCount('master', 8)).toBe(true);
    expect(canCompareCount('public', 2.5)).toBe(false);
  });

  it('gates export and sharing for unauthenticated visitors', () => {
    expect(canExecuteFeature('visitor', 'export')).toBe(false);
    expect(canExecuteFeature('visitor', 'share')).toBe(false);
    expect(canExecuteFeature('public', 'export')).toBe(true);
    expect(canExecuteFeature('public', 'share')).toBe(true);
  });

  it('shows future features disabled only to entitled roles', () => {
    expect(featureAvailability('public', 'tpva')).toBe('hidden');
    expect(featureAvailability('corporate', 'tpva')).toBe('disabled');
    expect(featureAvailability('corporate', 'news')).toBe('hidden');
    expect(featureAvailability('admin', 'current-policies')).toBe('disabled');
    expect(featureAvailability('master', 'chat')).toBe('disabled');
    expect(canExecuteFeature('master', 'tpva')).toBe(false);
  });

  it('separates corporate, admin and master capabilities', () => {
    expect(featureAvailability('corporate', 'vehicle-administration')).toBe('hidden');
    expect(featureAvailability('admin', 'agents')).toBe('hidden');
    expect(featureAvailability('admin', 'settings')).toBe('hidden');
    expect(featureAvailability('master', 'agents')).toBe('enabled');
    expect(featureAvailability('master', 'settings')).toBe('enabled');
  });
});
