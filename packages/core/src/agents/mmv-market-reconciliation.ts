export interface MmvMarketLookupRequest {
  readonly market: 'BR';
  readonly brand: string;
  readonly model: string;
  readonly versionHints: readonly string[];
}

export interface MmvMarketObservation {
  readonly sourceKind: 'FIPE' | 'SECONDARY';
  readonly sourceName: 'FIPE' | 'WEBMOTORS';
  readonly sourceUrl: string;
  readonly fipeCode: string;
  readonly brand: string;
  readonly modelLabel: string;
  readonly matchedVersionHint: string | null;
  readonly modelYear: number | null;
  readonly referencePeriod: string | null;
  readonly confidence: number;
  readonly capturedAt: string;
}

export interface MmvMarketLookupPort {
  lookup(request: MmvMarketLookupRequest): Promise<readonly MmvMarketObservation[]>;
}

export interface MmvMarketReconciliationItem {
  readonly manufacturerVersionLabel: string;
  readonly observations: readonly MmvMarketObservation[];
}

export function groupMmvMarketObservations(
  versionHints: readonly string[],
  observations: readonly MmvMarketObservation[],
): readonly MmvMarketReconciliationItem[] {
  return versionHints.map((manufacturerVersionLabel) => ({
    manufacturerVersionLabel,
    observations: observations.filter(
      (observation) => observation.matchedVersionHint === manufacturerVersionLabel,
    ),
  }));
}
