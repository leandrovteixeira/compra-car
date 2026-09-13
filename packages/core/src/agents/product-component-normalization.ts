import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { ProductPropulsion } from './new-product-check-types';

export type TransmissionFamily = 'CVT' | 'AT' | 'MT' | 'DHT';
function componentText(value: string): string {
  // Accent folding is limited to component vocabulary, never product identity.
  return key(value).normalize('NFD').replace(/\p{M}/gu, '');
}
export function normalizePropulsionFamily(
  value: string | null,
  purelyElectric = false,
): ProductPropulsion | null {
  if (value === null) return null;
  const label = componentText(value);
  if (['ice', 'mhev', 'hev', 'phev', 'bev'].includes(label))
    return label.toUpperCase() as ProductPropulsion;
  if (label === 'hybrid' || label === 'hibrido') return 'HEV';
  if (purelyElectric && ['ev', 'electric', 'eletrico'].includes(label)) return 'BEV';
  return null;
}
export function normalizeEngineDisplacement(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*l?\s*$/iu.exec(value);
  if (!match) return null;
  const number = Number(match[1]!.replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}
export function normalizeTransmissionFamily(
  value: string | null,
  propulsion: ProductPropulsion | null = null,
): TransmissionFamily | null {
  if (value === null) return null;
  const label = componentText(value);
  // Historical compatibility only: Hybrid Transaxle remains the published label.
  if (/\bhybrid transaxle\b/u.test(label)) {
    return propulsion === 'HEV' && /^hybrid transaxle(?:\s*\(cvt\))?$/u.test(label) ? 'CVT' : null;
  }
  const cvt = /\bcvt\b/u.test(label);
  const dht = /\bdht\b/u.test(label);
  const manual = /\b(?:mt|manual)\b/u.test(label);
  const explicitAt = /\bat\b/u.test(label);
  if (Number(cvt) + Number(dht) + Number(manual) + Number(explicitAt) > 1) return null;
  if (cvt) return 'CVT';
  if (dht) return 'DHT';
  if (manual) return 'MT';
  if (explicitAt || /\bautomatica\b/u.test(label)) return 'AT';
  return null;
}
export interface PowertrainComponents {
  readonly displacement: number | null;
  readonly propulsion: ProductPropulsion | null;
  readonly code: string | null;
}
export function normalizePowertrainComponents(
  value: string | null,
  purelyElectric = false,
): PowertrainComponents {
  const empty = { displacement: null, propulsion: null, code: null };
  if (value === null) return empty;
  const displacement = normalizeEngineDisplacement(value);
  if (displacement !== null) return { ...empty, displacement };
  const propulsion = normalizePropulsionFamily(value, purelyElectric);
  if (propulsion !== null) return { ...empty, propulsion };
  const combined =
    /^\s*(\d+(?:[.,]\d+)?)\s*l?\s+(ICE|MHEV|HEV|PHEV|BEV|EV|Hybrid|Hibrido)\s*$/iu.exec(
      componentText(value),
    );
  if (combined)
    return {
      displacement: normalizeEngineDisplacement(combined[1]!),
      propulsion: normalizePropulsionFamily(combined[2]!, purelyElectric),
      code: null,
    };
  const coded = /^\s*(T\d{3})(?:\s+(MHEV|HEV|PHEV|BEV))?\s*$/iu.exec(value);
  if (coded)
    return {
      displacement: null,
      propulsion: normalizePropulsionFamily(coded[2] ?? null),
      code: coded[1]!.toUpperCase(),
    };
  return empty;
}
/** Families for equality/deduplication; unrecognized labels retain a literal key. */
export function transmissionComparisonKey(
  value: string,
  propulsion: ProductPropulsion | null = null,
): string {
  return normalizeTransmissionFamily(value, propulsion)?.toLowerCase() ?? key(value);
}
export function powertrainComparisonKey(value: string): string {
  const parsed = normalizePowertrainComponents(value);
  return parsed.displacement !== null || parsed.propulsion !== null || parsed.code !== null
    ? JSON.stringify(parsed)
    : key(value);
}
