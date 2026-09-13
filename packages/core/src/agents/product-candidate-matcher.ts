import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import {
  parseLegacyProductVersion,
  transmissionComparisonKey,
  type LegacyParsedProduct,
} from './legacy-product-version-parser';
import type {
  AgentMarketScope,
  NewProductFinding,
  NewProductFindingType,
  OfficialProductCandidate,
  MatchedProductCandidate,
  ProductMatchMode,
} from './new-product-check-types';

export function officialCandidateIdentity(
  scope: AgentMarketScope,
  candidate: OfficialProductCandidate,
): readonly (string | null)[] {
  const normalized = (value: string | null) => (value === null ? null : key(value));
  return [
    scope.country,
    key(scope.brand),
    key(candidate.model),
    normalized(candidate.officialVersionLabel),
    candidate.officialVersionLabel === null ? normalized(candidate.trim) : null,
    candidate.propulsion,
    normalized(candidate.powertrainLabel),
  ];
}
export function findingFingerprint(
  scope: AgentMarketScope,
  candidate: OfficialProductCandidate,
  type: NewProductFindingType,
): string {
  return JSON.stringify([
    'new-product-check:v2',
    ...officialCandidateIdentity(scope, candidate),
    type,
  ]);
}
export function isResolvedOfficialVariant(candidate: OfficialProductCandidate): boolean {
  return (
    candidate.taxonomy === 'VARIANT' &&
    Boolean(candidate.officialVersionLabel?.trim() || candidate.trim?.trim())
  );
}
function textConflict(a: string | null, b: string | null, normalize = key): boolean {
  return a !== null && b !== null && normalize(a) !== normalize(b);
}
function componentConflicts(
  candidate: OfficialProductCandidate,
  legacy: LegacyParsedProduct,
): readonly string[] {
  const fields: string[] = [];
  if (textConflict(candidate.trim, legacy.trim)) fields.push('trim');
  if (
    candidate.engineDisplacement !== null &&
    legacy.engineDisplacement !== null &&
    candidate.engineDisplacement !== legacy.engineDisplacement
  )
    fields.push('engineDisplacement');
  if (textConflict(candidate.propulsion, legacy.propulsion)) fields.push('propulsion');
  if (textConflict(candidate.transmission, legacy.transmission, transmissionComparisonKey))
    fields.push('transmission');
  if (textConflict(candidate.drivetrain, legacy.drivetrain)) fields.push('drivetrain');
  if (textConflict(candidate.engineLabel, legacy.engineLabel)) fields.push('engineLabel');
  if (textConflict(candidate.powertrainLabel, legacy.powertrainLabel))
    fields.push('powertrainLabel');
  return fields;
}
/** Only raises suspicion, never resolves identity. */
function namingUncertain(left: string, right: string): boolean {
  const a = key(left),
    b = key(right);
  const compact = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, '');
  return compact(a) === compact(b) || a.startsWith(b + ' ') || b.startsWith(a + ' ');
}

export class ProductCandidateMatcher {
  match(
    scope: AgentMarketScope,
    candidate: OfficialProductCandidate,
    catalog: readonly AdministrativeVehicle[],
  ): { readonly matched: MatchedProductCandidate } | { readonly finding: NewProductFinding } {
    const brand = catalog.filter((p) => key(p.brand) === key(scope.brand));
    const models = brand.filter((p) => key(p.model) === key(candidate.model));
    const finding = (
      type: NewProductFindingType,
      reason: string,
      products: readonly AdministrativeVehicle[] = models,
      matchMode: ProductMatchMode | null = null,
    ) => ({
      finding: {
        fingerprint: findingFingerprint(scope, candidate, type),
        type,
        candidate,
        matchedProductIds: products.map((p) => p.id).sort(),
        matchedProducts: products,
        matchMode,
        reason,
      },
    });
    if (key(candidate.brand) !== key(scope.brand))
      return finding('AMBIGUOUS', 'Candidate brand is outside the requested scope.', []);
    if (candidate.taxonomy !== 'MODEL' && candidate.taxonomy !== 'VARIANT') {
      return finding(
        'AMBIGUOUS',
        'Taxonomy does not establish a distinct base model or resolved variant.',
      );
    }
    if (
      !candidate.evidence.length ||
      candidate.confidence < 0.65 ||
      candidate.extractionWarnings?.length
    ) {
      return finding(
        'AMBIGUOUS',
        'Extraction uncertainty: ' +
          (candidate.extractionWarnings?.join(', ') ||
            (!candidate.evidence.length ? 'insufficient evidence' : 'confidence below 0.65')) +
          '.',
      );
    }
    // A known brand and explicit base model do not require a resolved trim.
    if (!models.length)
      return finding(
        'NEW_MODEL',
        'Official base model is absent from the administrative brand catalog.',
        [],
      );
    if (!isResolvedOfficialVariant(candidate)) {
      return finding('AMBIGUOUS', 'Model is known, but official variant could not be resolved.');
    }
    const identityTrim = candidate.trim ?? candidate.officialVersionLabel!;
    const parsed = models.map(parseLegacyProductVersion);
    const considered = parsed.filter(
      (p) =>
        (candidate.officialVersionLabel !== null &&
          key(p.product.version) === key(candidate.officialVersionLabel)) ||
        (p.trim !== null && key(p.trim) === key(identityTrim)),
    );
    const compatible = considered.filter(
      (p) =>
        !p.conflictingTokens && !p.uncertainNaming && componentConflicts(candidate, p).length === 0,
    );
    const unresolved = considered.filter(
      (p) =>
        (p.conflictingTokens || p.uncertainNaming) && componentConflicts(candidate, p).length === 0,
    );
    if (unresolved.length)
      return finding(
        'AMBIGUOUS',
        'Legacy tokens leave a possible identity unresolved.',
        [...compatible, ...unresolved].map((p) => p.product),
      );
    // Years never select between identities; reconciliation must first yield exactly one record.
    if (compatible.length > 1)
      return finding(
        'AMBIGUOUS',
        'Multiple canonical products are compatible with the available official components.',
        compatible.map((p) => p.product),
      );
    if (compatible.length === 1) {
      const product = compatible[0]!.product;
      const matchMode: ProductMatchMode =
        candidate.officialVersionLabel !== null &&
        key(product.version) === key(candidate.officialVersionLabel)
          ? 'EXACT_OFFICIAL'
          : 'LEGACY_NAMING';
      if (
        (candidate.productionYear !== null &&
          candidate.productionYear !== product.productionYear) ||
        (candidate.modelYear !== null && candidate.modelYear !== product.modelYear)
      ) {
        return finding(
          'POSSIBLE_YEAR_CHANGE',
          'Explicit official year differs after unique variant reconciliation.',
          [product],
          matchMode,
        );
      }
      return {
        matched: {
          candidate,
          matchedProductIds: [product.id],
          matchedProducts: [product],
          matchMode,
          reason:
            matchMode === 'EXACT_OFFICIAL'
              ? 'Unique exact official label with no component conflict.'
              : 'Unique legacy trim reconciliation; every available comparable component is compatible.',
        },
      };
    }
    if (considered.length) {
      const conflicts = [...new Set(considered.flatMap((p) => componentConflicts(candidate, p)))];
      return finding(
        'AMBIGUOUS',
        'Partial identity with conflicting or uncertain components: ' +
          (conflicts.join(', ') || 'legacy tokens') +
          '.',
        considered.map((p) => p.product),
      );
    }
    const uncertain = parsed.filter(
      (p) => p.trim === null || p.conflictingTokens || namingUncertain(identityTrim, p.trim),
    );
    if (uncertain.length)
      return finding(
        'AMBIGUOUS',
        'Unresolved legacy naming or package requires review.',
        uncertain.map((p) => p.product),
      );
    return finding(
      'NEW_VERSION',
      'Official variant is resolved and no administrative variant can be reconciled.',
      [],
    );
  }
}
