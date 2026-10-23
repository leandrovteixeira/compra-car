/**
 * Sprint 23C feature entitlements.
 *
 * The legacy AuthProfile role ('seller' | 'admin') is deliberately NOT used
 * as a source of these new roles. Rollout requires an explicit, server-read
 * membership/grant. Never infer a Corporate or Master grant from user input.
 */
export type AccountTier = 'visitor' | 'public' | 'corporate' | 'admin' | 'master';
export type Feature23C =
  | 'vehicle-specs'
  | 'compare-models'
  | 'compare-specifications'
  | 'export'
  | 'share'
  | 'price-list'
  | 'tpva'
  | 'chat'
  | 'news'
  | 'education'
  | 'current-policies'
  | 'vehicle-administration'
  | 'agents'
  | 'settings';

export type FeatureAvailability = 'enabled' | 'disabled' | 'hidden';

const comingSoon = new Set<Feature23C>([
  'tpva', 'chat', 'news', 'education', 'current-policies',
]);

const rights: Record<AccountTier, ReadonlySet<Feature23C>> = {
  visitor: new Set(['vehicle-specs', 'compare-models', 'compare-specifications']),
  public: new Set(['vehicle-specs', 'compare-models', 'compare-specifications', 'export', 'share']),
  corporate: new Set([
    'vehicle-specs', 'compare-models', 'compare-specifications',
    'export', 'share', 'price-list', 'tpva', 'chat',
  ]),
  admin: new Set([
    'vehicle-specs', 'compare-models', 'compare-specifications',
    'export', 'share', 'price-list', 'tpva', 'chat',
    'news', 'education', 'current-policies', 'vehicle-administration',
  ]),
  master: new Set([
    'vehicle-specs', 'compare-models', 'compare-specifications',
    'export', 'share', 'price-list', 'tpva', 'chat',
    'news', 'education', 'current-policies', 'vehicle-administration',
    'agents', 'settings',
  ]),
};

export function featureAvailability(role: AccountTier, feature: Feature23C): FeatureAvailability {
  if (!rights[role].has(feature)) return 'hidden';
  return comingSoon.has(feature) ? 'disabled' : 'enabled';
}

export function comparisonLimit(role: AccountTier): number {
  return role === 'visitor' || role === 'public' ? 3 : 8;
}

export function canExecuteFeature(role: AccountTier, feature: Feature23C): boolean {
  return featureAvailability(role, feature) === 'enabled';
}

export function canCompareCount(role: AccountTier, count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= comparisonLimit(role);
}
