/** Domain-scoped canonical aliases. This module never writes to a database. */
export const ALIAS_KINDS = ['BRAND', 'MMV', 'SPEC_FIELD', 'SCALE_OPTION'] as const;
export type AliasKind = (typeof ALIAS_KINDS)[number];
export type AliasStatus = 'CONFIRMED' | 'REVOKED';

export type AliasScope =
  | Readonly<{ kind: 'BRAND'; market: string }>
  | Readonly<{
      kind: 'MMV'; market: string; brandKey: string; modelKey: string;
      /** Distinguishes same-label commercially different powertrains; null is a real scope. */
      commercialPowertrainKey: string | null;
    }>
  | Readonly<{
      kind: 'SPEC_FIELD'; locale: string; categoryKey: string;
      valueType: 'binary' | 'numeric' | 'scale'; sourceContextKey: string;
    }>
  | Readonly<{ kind: 'SCALE_OPTION'; familyKey: string; locale: string }>;

export type CanonicalAlias = Readonly<{
  id: string;
  scope: AliasScope;
  rawLabel: string;
  normalizedLabel: string;
  canonicalId: string;
  status: AliasStatus;
  sourceUrl: string | null;
  sourceFindingId: string;
  decisionId: string;
  confirmedAt: string;
  revokedAt: string | null;
}>;

export class AliasContractError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'AliasContractError'; }
}

/** A hint is not authority. Normalization cannot prove semantic equivalence. */
export function normalizeAliasLabel(value: string): string {
  if (typeof value !== 'string') throw new AliasContractError('INVALID_ALIAS_LABEL');
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');
  if (!normalized || normalized.length > 250) throw new AliasContractError('INVALID_ALIAS_LABEL');
  return normalized;
}

/** Stable identity: always the complete verified business scope, never just a label. */
export function aliasScopeKey(scope: AliasScope): string {
  if (!scope || !ALIAS_KINDS.includes(scope.kind)) throw new AliasContractError('INVALID_ALIAS_SCOPE');
  const required = (s: unknown) => {
    if (typeof s !== 'string' || !s.trim() || s.length > 250)
      throw new AliasContractError('INVALID_ALIAS_SCOPE');
    return s.trim();
  };
  switch (scope.kind) {
    case 'BRAND': return JSON.stringify(['BRAND', required(scope.market)]);
    case 'MMV': return JSON.stringify([
      'MMV', required(scope.market), required(scope.brandKey),
      required(scope.modelKey),
      scope.commercialPowertrainKey === null ? null : required(scope.commercialPowertrainKey),
    ]);
    case 'SPEC_FIELD': {
      if (!['binary', 'numeric', 'scale'].includes(scope.valueType))
        throw new AliasContractError('INVALID_ALIAS_SCOPE');
      return JSON.stringify([
        'SPEC_FIELD', required(scope.locale), required(scope.categoryKey),
        scope.valueType, required(scope.sourceContextKey),
      ]);
    }
    case 'SCALE_OPTION': return JSON.stringify([
      'SCALE_OPTION', required(scope.familyKey), required(scope.locale),
    ]);
  }
}

export function scopedAliasKey(scope: AliasScope, label: string): string {
  return JSON.stringify([aliasScopeKey(scope), normalizeAliasLabel(label)]);
}

export function validateAlias(alias: CanonicalAlias): CanonicalAlias {
  if (!alias || !alias.id?.trim() || !alias.canonicalId?.trim() ||
      !alias.sourceFindingId?.trim() || !alias.decisionId?.trim() ||
      !['CONFIRMED', 'REVOKED'].includes(alias.status) ||
      alias.normalizedLabel !== normalizeAliasLabel(alias.rawLabel) ||
      !Number.isFinite(Date.parse(alias.confirmedAt)) ||
      (alias.status === 'CONFIRMED' && alias.revokedAt !== null) ||
      (alias.status === 'REVOKED' && (!alias.revokedAt ||
        !Number.isFinite(Date.parse(alias.revokedAt)) ||
        Date.parse(alias.revokedAt) < Date.parse(alias.confirmedAt))) ||
      (alias.sourceUrl !== null && (!/^https:\/\//u.test(alias.sourceUrl) ||
        alias.sourceUrl.length > 2048)))
    throw new AliasContractError('INVALID_ALIAS_BINDING');
  aliasScopeKey(alias.scope);
  return alias;
}

export type AliasResolution =
  | Readonly<{ state: 'MATCH'; canonicalId: string; aliasIds: readonly string[] }>
  | Readonly<{ state: 'MISS' }>
  | Readonly<{ state: 'CONFLICT'; canonicalIds: readonly string[] }>;

/** Exact scope + confirmed alias only. Never choose the first of competing targets. */
export function resolveCanonicalAlias(
  entries: readonly CanonicalAlias[], scope: AliasScope, observedLabel: string,
): AliasResolution {
  const key = scopedAliasKey(scope, observedLabel);
  const matches = entries.filter((entry) => {
    validateAlias(entry);
    return entry.status === 'CONFIRMED' && scopedAliasKey(entry.scope, entry.rawLabel) === key;
  });
  if (!matches.length) return { state: 'MISS' };
  const targets = [...new Set(matches.map((entry) => entry.canonicalId))].sort();
  if (targets.length !== 1) return { state: 'CONFLICT', canonicalIds: targets };
  return { state: 'MATCH', canonicalId: targets[0]!, aliasIds: matches.map((x) => x.id).sort() };
}

/** Pure staged merge check; caller must still enforce uniqueness/locking in SQL. */
export function planAliasMerge(existing: readonly CanonicalAlias[], candidate: CanonicalAlias) {
  validateAlias(candidate);
  if (candidate.status !== 'CONFIRMED') throw new AliasContractError('ALIAS_NOT_CONFIRMED');
  const current = resolveCanonicalAlias(existing, candidate.scope, candidate.rawLabel);
  if (current.state === 'CONFLICT' ||
      (current.state === 'MATCH' && current.canonicalId !== candidate.canonicalId))
    throw new AliasContractError('ALIAS_CANONICAL_COLLISION');
  return {
    operation: current.state === 'MATCH' ? 'EXISTING' as const : 'INSERT' as const,
    canonicalId: candidate.canonicalId,
    scopeKey: aliasScopeKey(candidate.scope),
    normalizedLabel: candidate.normalizedLabel,
  };
}
