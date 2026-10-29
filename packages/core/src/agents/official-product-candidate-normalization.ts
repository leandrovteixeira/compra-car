import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^\${}()|[\]\\]/gu, '\\$&');
}

export function stripRedundantModelPrefix(model: string, label: string | null): string | null {
  if (label === null) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  const modelPattern = model
    .trim()
    .split(/\s+/u)
    .map(escapeRegExp)
    .join('\\s+');
  const match = trimmed.match(new RegExp('^' + modelPattern + '\\s+(.+)$', 'iu'));
  if (!match?.[1]?.trim()) return trimmed;
  return match[1].trim();
}

export function normalizeDiscoveredVariantLabels<T extends {
  readonly model: string;
  readonly brand?: string;
  readonly officialVersionLabel: string | null;
  readonly trim: string | null;
}>(candidate: T): T {
  const brand = candidate.brand?.trim();
  const model = brand && new RegExp('^' + escapeRegExp(brand) + '\\s+', 'iu').test(candidate.model)
    ? candidate.model.replace(new RegExp('^' + escapeRegExp(brand) + '\\s+', 'iu'), '').trim()
    : candidate.model;
  const normalizeLabel = (label: string | null) => {
    if (!label) return null;
    const stripped = stripRedundantModelPrefix(model, label);
    return stripped && key(stripped) !== key(model) && (!brand || key(stripped) !== key(brand + ' ' + model))
      ? stripped : null;
  };
  return {
    ...candidate,
    model,
    officialVersionLabel: normalizeLabel(candidate.officialVersionLabel),
    trim: normalizeLabel(candidate.trim),
  };
}

export function labelRepeatsModel(model: string, label: string | null): boolean {
  if (!label) return false;
  const normalized = stripRedundantModelPrefix(model, label);
  return normalized !== null && key(normalized) !== key(label);
}
