export interface FipeMmvLookupRequest {
  readonly market: 'BR';
  readonly brand: string;
  readonly model: string;
  /** Optional commercial label hint. This is a lookup aid, never canonical input. */
  readonly versionHint?: string | null;
}

export interface FipeMmvObservation {
  readonly sourceKind: 'FIPE';
  readonly sourceUrl: string;
  readonly fipeCode: string;
  readonly brand: string;
  /** Exact model/variant text returned by the official FIPE consultation. */
  readonly modelLabel: string;
  /** FIPE states that its year field is model year. */
  readonly modelYear: number | null;
  readonly referencePeriod: string | null;
  readonly capturedAt: string;
}

/**
 * Official FIPE boundary for targeted consultation.
 *
 * FIPE explicitly states that it does not provide an API or database download.
 * Implementations must therefore remain model-directed and must not emulate a
 * bulk database export through undocumented endpoints.
 */
export interface FipeMmvLookupPort {
  lookup(request: FipeMmvLookupRequest): Promise<readonly FipeMmvObservation[]>;
}
