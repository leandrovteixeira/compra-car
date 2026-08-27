import type {
  ComparisonCategoryPresentationDto,
  ComparisonPageDataDto,
  ComparisonRowPresentationDto,
} from '@compra-car/contracts';

export const comparisonModes = ['complete', 'differences', 'advantages'] as const;

export type ComparisonMode = (typeof comparisonModes)[number];

export interface ComparisonRowViewModel extends ComparisonRowPresentationDto {
  readonly hasDifference: boolean;
  readonly hasAnyAdvantage: boolean;
}

export interface ComparisonCategoryViewModel extends ComparisonCategoryPresentationDto {
  readonly rows: readonly ComparisonRowViewModel[];
}

export interface ComparisonPageViewModel extends ComparisonPageDataDto {
  readonly categories: readonly ComparisonCategoryViewModel[];
}

export function parseComparisonMode(
  rawMode: string | readonly string[] | undefined,
  rawHighlights?: string | readonly string[],
): ComparisonMode {
  const mode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
  if (comparisonModes.some((candidate) => candidate === mode)) return mode as ComparisonMode;

  const highlights = Array.isArray(rawHighlights) ? rawHighlights[0] : rawHighlights;
  return highlights === 'true' ? 'advantages' : 'complete';
}
