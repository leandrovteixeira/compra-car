import type { OfficialProductCandidate } from './new-product-check-types';

export const officialCandidateTextFields = [
  'officialVersionLabel',
  'trim',
  'powertrainLabel',
  'engineLabel',
  'transmission',
  'drivetrain',
] as const;
export const evidenceTypes = [
  'TECHNICAL_SHEET',
  'VERSION_DOCUMENT',
  'PRICE_LIST',
  'CONFIGURATOR',
  'MODEL_PAGE',
  'PRESS_RELEASE',
  'OTHER_OFFICIAL',
] as const;
export function isOfficialProductCandidate(value: unknown): value is OfficialProductCandidate {
  if (!value || typeof value !== 'object') return false;
  const c = value as OfficialProductCandidate;
  const text = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const year = (v: unknown) =>
    v === null || (Number.isInteger(v) && Number(v) >= 1900 && Number(v) <= 2200);
  return (
    text(c.brand, 120) &&
    text(c.model, 200) &&
    ['MODEL', 'VARIANT', 'POWERTRAIN', 'LANDING_PAGE', 'UNKNOWN'].includes(c.taxonomy) &&
    officialCandidateTextFields.every((field) => c[field] === null || text(c[field], 200)) &&
    (c.engineDisplacement === null ||
      (Number.isFinite(c.engineDisplacement) &&
        c.engineDisplacement > 0 &&
        c.engineDisplacement <= 20)) &&
    (c.propulsion === null || ['ICE', 'MHEV', 'HEV', 'PHEV', 'BEV'].includes(c.propulsion)) &&
    year(c.productionYear) &&
    year(c.modelYear) &&
    Number.isFinite(c.confidence) &&
    c.confidence >= 0 &&
    c.confidence <= 1 &&
    Array.isArray(c.evidence) &&
    c.evidence.length <= 30 &&
    c.evidence.every(
      (e) =>
        e &&
        text(e.url, 2048) &&
        (e.title === null || (typeof e.title === 'string' && e.title.length <= 300)) &&
        (e.excerpt === null || (typeof e.excerpt === 'string' && e.excerpt.length <= 300)) &&
        (e.evidenceType === null || evidenceTypes.includes(e.evidenceType)),
    ) &&
    (c.extractionWarnings === undefined ||
      (Array.isArray(c.extractionWarnings) &&
        c.extractionWarnings.every((w) =>
          [
            'POSSIBLE_ALIAS',
            'POSSIBLE_PACKAGE',
            'CONFLICTING_SOURCES',
            'INSUFFICIENT_EVIDENCE',
          ].includes(w),
        )))
  );
}
