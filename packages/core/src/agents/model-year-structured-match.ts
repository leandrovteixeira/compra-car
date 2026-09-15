import type { ModelYearResearchTarget, StructuredModelYearRow } from './model-year-types';
export const myTokens = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
const contains = (text: string, value: string) =>
  myTokens(value).every((t) => myTokens(text).includes(t));
const family = (s: string) =>
  /cvt/iu.test(s)
    ? 'cvt'
    : /automatic|automático|at\b|dsg/iu.test(s)
      ? 'automatic'
      : /manual|mt\b/iu.test(s)
        ? 'manual'
        : null;
export function structuredVersionMatches(
  row: StructuredModelYearRow,
  target: ModelYearResearchTarget,
): boolean {
  if (
    myTokens(row.brand).join(' ') !== myTokens(target.officialIdentity.brand).join(' ') ||
    myTokens(row.model).join(' ') !== myTokens(target.officialIdentity.model).join(' ')
  )
    return false;
  const identity = target.structuredIdentity;
  if (!identity.trim || !contains(row.versionLabel, identity.trim)) return false;
  if (identity.powertrainLabel && !contains(row.versionLabel, identity.powertrainLabel))
    return false;
  if (
    !identity.powertrainLabel &&
    !contains(row.versionLabel, target.officialIdentity.officialVersionLabel)
  )
    return false;
  const displacement = row.versionLabel.match(/\b(\d[.,]\d)\b/u)?.[1];
  if (
    displacement &&
    identity.engineDisplacement !== null &&
    Number(displacement.replace(',', '.')) !== identity.engineDisplacement
  )
    return false;
  const observedTransmission = family(row.versionLabel),
    expectedTransmission = identity.transmission ? family(identity.transmission) : null;
  if (expectedTransmission && observedTransmission && expectedTransmission !== observedTransmission)
    return false;
  if (
    identity.transmission &&
    !expectedTransmission &&
    !contains(row.versionLabel, identity.transmission)
  )
    return false;
  if (identity.drivetrain && !contains(row.versionLabel, identity.drivetrain)) return false;
  if (identity.propulsion) {
    const fuel = (s: string) =>
      /flex/iu.test(s)
        ? 'flex'
        : /diesel/iu.test(s)
          ? 'diesel'
          : /h[iy]brid/iu.test(s)
            ? 'hybrid'
            : /eletric|electric/iu.test(s)
              ? 'electric'
              : /gasolin/iu.test(s)
                ? 'gasoline'
                : null;
    const actual = fuel(row.versionLabel),
      expected = fuel(identity.propulsion);
    if (actual && expected && actual !== expected) return false;
  }
  return true;
}
export function structuredRowValid(row: StructuredModelYearRow): boolean {
  if (
    !Number.isInteger(row.modelYear) ||
    row.modelYear < 1000 ||
    row.modelYear > 9999 ||
    !row.versionLabel.trim() ||
    row.versionLabel.length > 500
  )
    return false;
  try {
    const u = new URL(row.sourceUrl);
    // Only this implemented source is enabled; future source kinds are capabilities, not trust bypasses.
    return (
      row.sourceKind === 'WEBMOTORS_FIPE' &&
      u.protocol === 'https:' &&
      u.hostname === 'www.webmotors.com.br' &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash &&
      new RegExp('^/tabela-fipe/carros/[a-z0-9-]+/[a-z0-9-]+/' + row.modelYear + '/?$').test(
        u.pathname,
      )
    );
  } catch {
    return false;
  }
}
export const validFipeCode = (code: string) => /^\d{6}-\d$/u.test(code.trim());
