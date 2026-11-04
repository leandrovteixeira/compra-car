/**
 * Central access matrix.
 *
 * Product vocabulary:
 * visitor   = Público (sem login)
 * public    = Free (com login)
 * corporate = cliente Corporate, consumo/consulta
 * admin     = operação interna Compra Car
 * master    = administração global Compra Car
 *
 * This matrix is intentionally capability-based. Future Corporate write
 * capabilities (sandbox products, tentative prices, custom market values, etc.)
 * must be added as new capabilities instead of upgrading Corporate to Admin.
 *
 * Review this matrix at the end of every sprint that adds or changes a feature.
 */
export type AccountTier = 'visitor' | 'public' | 'corporate' | 'admin' | 'master';

export type Feature23C =
  | 'vehicle-specs'
  | 'compare-models'
  | 'compare-specifications'
  | 'export'
  | 'share'
  | 'price-list'
  | 'price-administration'
  | 'tpva'
  | 'chat'
  | 'news'
  | 'education'
  | 'current-policies'
  | 'vehicle-administration'
  | 'agents'
  | 'settings';

export type AccessMode = 'none' | 'read' | 'write' | 'manage';
export type FeatureAvailability = 'enabled' | 'disabled' | 'hidden';

export interface FeaturePolicy {
  readonly visitor: AccessMode;
  readonly public: AccessMode;
  readonly corporate: AccessMode;
  readonly admin: AccessMode;
  readonly master: AccessMode;
  readonly lifecycle: 'active' | 'planned';
}

/**
 * Source of truth for feature authorization.
 *
 * Corporate is deliberately read-only today.
 * Admin is an internal Compra Car operator and has everything except Settings.
 * Master owns global configuration and account governance.
 */
export const ACCESS_MATRIX: Readonly<Record<Feature23C, FeaturePolicy>> = {
  'vehicle-specs': {
    visitor: 'read', public: 'read', corporate: 'read', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  'compare-models': {
    visitor: 'read', public: 'read', corporate: 'read', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  'compare-specifications': {
    visitor: 'read', public: 'read', corporate: 'read', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  export: {
    visitor: 'none', public: 'read', corporate: 'read', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  share: {
    visitor: 'none', public: 'read', corporate: 'read', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  'price-list': {
    visitor: 'none', public: 'none', corporate: 'read', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  'price-administration': {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'manage', master: 'manage',
    lifecycle: 'active',
  },
  tpva: {
    visitor: 'none', public: 'none', corporate: 'read', admin: 'manage', master: 'manage',
    lifecycle: 'planned',
  },
  chat: {
    visitor: 'none', public: 'none', corporate: 'read', admin: 'manage', master: 'manage',
    lifecycle: 'planned',
  },
  news: {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'manage', master: 'manage',
    lifecycle: 'active',
  },
  education: {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'manage', master: 'manage',
    lifecycle: 'planned',
  },
  'current-policies': {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'read', master: 'read',
    lifecycle: 'active',
  },
  'vehicle-administration': {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'manage', master: 'manage',
    lifecycle: 'active',
  },
  agents: {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'manage', master: 'manage',
    lifecycle: 'active',
  },
  settings: {
    visitor: 'none', public: 'none', corporate: 'none', admin: 'none', master: 'manage',
    lifecycle: 'active',
  },
};

export function accessMode(role: AccountTier, feature: Feature23C): AccessMode {
  return ACCESS_MATRIX[feature][role];
}

export function hasFeatureAccess(role: AccountTier, feature: Feature23C): boolean {
  return accessMode(role, feature) !== 'none';
}

export function canWriteFeature(role: AccountTier, feature: Feature23C): boolean {
  const mode = accessMode(role, feature);
  return mode === 'write' || mode === 'manage';
}

export function featureAvailability(role: AccountTier, feature: Feature23C): FeatureAvailability {
  const policy = ACCESS_MATRIX[feature];
  if (policy[role] === 'none') return 'hidden';
  return policy.lifecycle === 'planned' ? 'disabled' : 'enabled';
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
