import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
export { transmissionComparisonKey } from './product-component-normalization';
import type { ProductPropulsion } from './new-product-check-types';

export interface LegacyParsedProduct {
  readonly product: AdministrativeVehicle;
  readonly trim: string | null;
  readonly engineDisplacement: number | null;
  readonly propulsion: ProductPropulsion | null;
  readonly propulsionBasis: 'EXPLICIT_TOKEN' | 'LEGACY_EXPANDED_CONVENTION' | 'UNKNOWN';
  readonly transmission: string | null;
  readonly drivetrain: string | null;
  readonly engineLabel: string | null;
  readonly powertrainLabel: string | null;
  readonly extraTokens: readonly string[];
  readonly conflictingTokens: boolean;
  readonly uncertainNaming: boolean;
}
const propulsionTokens: Readonly<Record<string, ProductPropulsion>> = {
  ICE: 'ICE',
  MHEV: 'MHEV',
  HEV: 'HEV',
  PHEV: 'PHEV',
  BEV: 'BEV',
  EV: 'BEV',
};
const transmissions = new Set(['CVT', 'AT', 'DHT', 'MT']);
const drivetrains = new Set(['4X4', '4X2', 'AWD', 'FWD', 'RWD', '2WD', '4WD']);
const displacement = (token: string) => /^\d\.[0-9]$/u.test(token) && Number(token) > 0;
const powertrain = (token: string) => /^T\d{3}$/u.test(token);
const engine = (token: string) => token === 'TGDI';

export function parseLegacyProductVersion(product: AdministrativeVehicle): LegacyParsedProduct {
  const tokens = product.version.trim().split(/\s+/u);
  const upper = tokens.map((token) => token.toUpperCase());
  const firstAttribute = upper.findIndex(
    (token) =>
      displacement(token) ||
      token in propulsionTokens ||
      transmissions.has(token) ||
      drivetrains.has(token) ||
      powertrain(token) ||
      engine(token),
  );
  const prefix = firstAttribute < 0 ? tokens : tokens.slice(0, firstAttribute);
  const attributes = firstAttribute < 0 ? [] : upper.slice(firstAttribute);
  const unique = <T>(items: readonly T[]) => [...new Set(items)];
  const engines = unique(attributes.filter(displacement).map(Number));
  const propulsions = unique(
    attributes
      .filter((token) => token in propulsionTokens)
      .map((token) => propulsionTokens[token]!),
  );
  const gears = unique(attributes.filter((token) => transmissions.has(token)));
  const drives = unique(attributes.filter((token) => drivetrains.has(token)));
  const engineLabels = unique(attributes.filter(engine));
  const powertrains = unique(attributes.filter(powertrain));
  const extraTokens = attributes.filter(
    (token) =>
      !displacement(token) &&
      !(token in propulsionTokens) &&
      !transmissions.has(token) &&
      !drivetrains.has(token) &&
      !powertrain(token),
  );
  const conflictingTokens = [engines, propulsions, gears, drives, engineLabels, powertrains].some(
    (values) => values.length > 1,
  );
  // Explicit convention for historical expanded names, not an inference about official facts.
  // A displacement + conventional gearbox with no unknown suffix or electric marker denotes ICE.
  const legacyIce =
    !propulsions.length &&
    engines.length === 1 &&
    gears.length === 1 &&
    gears[0] !== 'DHT' &&
    extraTokens.every(engine) &&
    !conflictingTokens;
  const propulsion = propulsions.length === 1 ? propulsions[0]! : legacyIce ? 'ICE' : null;
  return {
    product,
    trim: prefix.join(' ') || null,
    engineDisplacement: engines.length === 1 ? engines[0]! : null,
    propulsion,
    propulsionBasis:
      propulsions.length === 1
        ? 'EXPLICIT_TOKEN'
        : legacyIce
          ? 'LEGACY_EXPANDED_CONVENTION'
          : 'UNKNOWN',
    transmission: gears.length === 1 ? gears[0]! : null,
    drivetrain: drives.length === 1 ? drives[0]! : null,
    engineLabel: engineLabels.length === 1 ? engineLabels[0]! : null,
    powertrainLabel:
      powertrains.length === 1 ? [powertrains[0], propulsions[0]].filter(Boolean).join(' ') : null,
    extraTokens,
    conflictingTokens,
    uncertainNaming: extraTokens.some((token) => !engine(token)),
  };
}
