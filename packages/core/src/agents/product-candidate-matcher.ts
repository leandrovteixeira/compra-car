import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import {
  parseLegacyProductVersion,
  type LegacyParsedProduct,
} from './legacy-product-version-parser';
import {
  normalizeEngineDisplacement,
  normalizePowertrainComponents,
  normalizeTransmissionFamily,
  powertrainComparisonKey,
} from './product-component-normalization';
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
    candidate.powertrainLabel === null ? null : powertrainComparisonKey(candidate.powertrainLabel),
  ];
}
export function findingFingerprint(
  scope: AgentMarketScope,
  candidate: OfficialProductCandidate,
  type: NewProductFindingType,
): string {
  if (type === 'NEW_MODEL')
    return JSON.stringify([
      'new-product-check:v3',
      scope.country,
      key(scope.brand),
      key(candidate.model),
      type,
    ]);
  return JSON.stringify([
    'new-product-check:v3',
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
type Compatibility = 'COMPATIBLE' | 'CONFLICT' | 'UNKNOWN';
function knownValues(a: string | number | null, b: string | number | null): Compatibility {
  if (a === null || b === null) return 'COMPATIBLE';
  return a === b ? 'COMPATIBLE' : 'CONFLICT';
}
function namedComponent(a: string | null, b: string | null): Compatibility {
  if (a === null || b === null || key(a) === key(b)) return 'COMPATIBLE';
  // Opaque marketing text is not proof of a technical conflict.
  return 'UNKNOWN';
}
/** Only raises uncertainty, never declares a match or resolves an alias. */
function namingUncertain(left: string, right: string): boolean {
  const a = key(left),
    b = key(right);
  const compact = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, '');
  return compact(a) === compact(b) || a.startsWith(b + ' ') || b.startsWith(a + ' ');
}
function evidenceNamesTrim(candidate: OfficialProductCandidate, trim: string): boolean {
  // Literal phrase in an official excerpt/title can flag an existing alias for review.
  const words = (text: string) => ' ' + key(text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  return candidate.evidence.some((e) =>
    words([e.title, e.excerpt].filter(Boolean).join(' ')).includes(words(trim)),
  );
}
function hasCommercialVariantEvidence(candidate: OfficialProductCandidate): boolean {
  return candidate.evidence.some((e) =>
    ['TECHNICAL_SHEET', 'VERSION_DOCUMENT', 'PRICE_LIST', 'CONFIGURATOR'].includes(
      e.evidenceType ?? '',
    ),
  );
}
interface Survivor {
  readonly legacy: LegacyParsedProduct;
  readonly unknown: readonly string[];
}
export class ProductCandidateMatcher {
  match(
    scope: AgentMarketScope,
    candidate: OfficialProductCandidate,
    catalog: readonly AdministrativeVehicle[],
  ): { readonly matched: MatchedProductCandidate } | { readonly finding: NewProductFinding } {
    const models = catalog.filter(
      (p) => key(p.brand) === key(scope.brand) && key(p.model) === key(candidate.model),
    );
    const warnings = [...new Set(candidate.extractionWarnings ?? [])];
    const finding = (
      type: NewProductFindingType,
      reason: string,
      products: readonly AdministrativeVehicle[] = [],
      matchMode: ProductMatchMode | null = null,
    ) => ({
      finding: {
        fingerprint: findingFingerprint(scope, candidate, type),
        type,
        candidate,
        variants: [],
        warnings,
        matchedProductIds: products.map((p) => p.id).sort(),
        matchedProducts: products,
        matchMode,
        reason,
      },
    });
    if (key(candidate.brand) !== key(scope.brand) || !candidate.evidence.length)
      return finding('AMBIGUOUS', 'Official model evidence is insufficient for this scope.');
    if (candidate.taxonomy !== 'MODEL' && candidate.taxonomy !== 'VARIANT') {
      return finding(
        'AMBIGUOUS',
        'Taxonomy does not establish a distinct base model or resolved variant.',
      );
    }
    // Variant uncertainty does not negate an explicitly identified absent base model.
    if (!models.length)
      return finding(
        'NEW_MODEL',
        'Official base model is absent; variant warnings remain attached for review.',
      );
    const officialPowertrain = normalizePowertrainComponents(
      candidate.powertrainLabel,
      candidate.propulsion === 'BEV',
    );
    const officialEngine = normalizeEngineDisplacement(candidate.engineDisplacement);
    const contradictoryFacts =
      knownValues(officialPowertrain.displacement, officialEngine) === 'CONFLICT' ||
      knownValues(officialPowertrain.propulsion, candidate.propulsion) === 'CONFLICT';
    const displacement = officialEngine ?? officialPowertrain.displacement;
    const propulsion = candidate.propulsion ?? officialPowertrain.propulsion;
    const officialTransmission = normalizeTransmissionFamily(candidate.transmission, propulsion);
    const identityTrim = candidate.trim ?? candidate.officialVersionLabel;
    let survivors: Survivor[] = models
      .map(parseLegacyProductVersion)
      .map((legacy) => ({ legacy, unknown: [] }));
    const constrain = (
      field: string,
      present: boolean,
      compare: (legacy: LegacyParsedProduct) => Compatibility,
    ) => {
      if (!present) return;
      survivors = survivors.flatMap((s) => {
        const compatibility = compare(s.legacy);
        if (compatibility === 'CONFLICT') return [];
        return [{ ...s, unknown: compatibility === 'UNKNOWN' ? [...s.unknown, field] : s.unknown }];
      });
    };
    constrain('trim', identityTrim !== null, (legacy) => {
      if (
        candidate.officialVersionLabel !== null &&
        key(legacy.product.version) === key(candidate.officialVersionLabel)
      )
        return 'COMPATIBLE';
      if (legacy.trim === null) return 'UNKNOWN';
      if (key(legacy.trim) === key(identityTrim!)) return 'COMPATIBLE';
      if (
        namingUncertain(identityTrim!, legacy.trim) ||
        (warnings.includes('POSSIBLE_ALIAS') && evidenceNamesTrim(candidate, legacy.trim))
      )
        return 'UNKNOWN';
      return 'CONFLICT';
    });
    constrain('propulsion', propulsion !== null, (legacy) =>
      knownValues(propulsion, legacy.propulsion),
    );
    constrain('engineDisplacement', displacement !== null, (legacy) =>
      knownValues(displacement, legacy.engineDisplacement),
    );
    constrain('transmission', candidate.transmission !== null, (legacy) => {
      if (legacy.transmission === null) return 'COMPATIBLE';
      const family = normalizeTransmissionFamily(legacy.transmission, legacy.propulsion);
      if (officialTransmission !== null && family !== null)
        return knownValues(officialTransmission, family);
      return namedComponent(candidate.transmission, legacy.transmission);
    });
    constrain('drivetrain', candidate.drivetrain !== null, (legacy) =>
      knownValues(
        candidate.drivetrain === null ? null : key(candidate.drivetrain),
        legacy.drivetrain === null ? null : key(legacy.drivetrain),
      ),
    );
    constrain('powertrain', candidate.powertrainLabel !== null, (legacy) => {
      const parsed = normalizePowertrainComponents(legacy.powertrainLabel);
      if (officialPowertrain.code !== null && parsed.code !== null)
        return knownValues(officialPowertrain.code, parsed.code);
      // Recognized engine/propulsion constraints have already been intersected.
      if (
        officialPowertrain.displacement !== null ||
        officialPowertrain.propulsion !== null ||
        officialPowertrain.code !== null
      )
        return 'COMPATIBLE';
      return namedComponent(candidate.powertrainLabel, legacy.powertrainLabel);
    });
    constrain('engineLabel', candidate.engineLabel !== null, (legacy) =>
      namedComponent(candidate.engineLabel, legacy.engineLabel),
    );
    const products = survivors.map((s) => s.legacy.product);
    if (!isResolvedOfficialVariant(candidate))
      return finding(
        'AMBIGUOUS',
        'Model is known, but official variant could not be resolved.',
        products,
      );
    if (
      contradictoryFacts ||
      warnings.includes('CONFLICTING_SOURCES') ||
      warnings.includes('INSUFFICIENT_EVIDENCE') ||
      candidate.confidence < 0.65
    ) {
      return finding(
        'AMBIGUOUS',
        'Identity facts remain conflicting or insufficient after component narrowing.',
        products,
      );
    }
    if (
      warnings.includes('POSSIBLE_PACKAGE') &&
      !hasCommercialVariantEvidence(candidate) &&
      !products.some(
        (p) =>
          candidate.officialVersionLabel !== null &&
          key(p.version) === key(candidate.officialVersionLabel),
      )
    ) {
      return finding(
        'AMBIGUOUS',
        'Possible package has no structured official evidence of a distinct commercial variant.',
        products,
      );
    }
    if (!survivors.length) {
      const reason = warnings.includes('POSSIBLE_ALIAS')
        ? 'Official sources have naming variation; no existing administrative variant reconciles.'
        : warnings.includes('POSSIBLE_PACKAGE')
          ? 'Official structured source identifies a commercial variant; no existing administrative variant reconciles.'
          : 'No administrative variant survives the available official component constraints.';
      return finding('NEW_VERSION', reason);
    }
    if (survivors.length > 1)
      return finding(
        'AMBIGUOUS',
        'Multiple canonical products remain after all available component constraints.',
        products,
      );
    const survivor = survivors[0]!,
      product = survivor.legacy.product;
    const exact =
      candidate.officialVersionLabel !== null &&
      key(product.version) === key(candidate.officialVersionLabel);
    if (
      survivor.unknown.length ||
      survivor.legacy.conflictingTokens ||
      survivor.legacy.uncertainNaming ||
      (warnings.includes('POSSIBLE_PACKAGE') && !exact)
    ) {
      return finding(
        'AMBIGUOUS',
        'Surviving identity needs review: ' +
          (survivor.unknown.join(', ') || 'unresolved legacy naming or commercial package') +
          '.',
        products,
      );
    }
    const matchMode: ProductMatchMode = exact ? 'EXACT_OFFICIAL' : 'LEGACY_NAMING';
    if (
      (candidate.productionYear !== null && candidate.productionYear !== product.productionYear) ||
      (candidate.modelYear !== null && candidate.modelYear !== product.modelYear)
    ) {
      return finding(
        'POSSIBLE_YEAR_CHANGE',
        'Explicit official year differs after unique variant reconciliation.',
        products,
        matchMode,
      );
    }
    return {
      matched: {
        candidate,
        matchedProductIds: [product.id],
        matchedProducts: products,
        matchMode,
        reason: exact
          ? 'Unique exact official label after component constraints.'
          : 'Unique legacy correspondence after component constraints.',
      },
    };
  }
}
