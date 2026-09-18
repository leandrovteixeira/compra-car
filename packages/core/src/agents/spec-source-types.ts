import type { ModelYearResearchTarget } from './model-year-types';
export interface SpecSourceTarget {
  readonly mmvIdentity: string;
  readonly brand: string;
  readonly model: string;
  readonly catalogVersion: string;
  readonly officialVersionLabel: string;
  readonly modelYear: number;
  readonly structuredIdentity: ModelYearResearchTarget['structuredIdentity'];
  readonly discoveryRunId: string;
}
export const SPEC_SOURCE_KINDS = [
  'OFFICIAL_HTML',
  'OFFICIAL_STRUCTURED_HTML',
  'OFFICIAL_JSON',
  'OFFICIAL_CONFIGURATOR',
  'OFFICIAL_PDF',
  'OFFICIAL_MANUAL',
  'OFFICIAL_CATALOG',
] as const;
export type SpecSourceKind = (typeof SPEC_SOURCE_KINDS)[number];
export type SpecExtractionMethod =
  | 'STRUCTURED_TABLE'
  | 'STRUCTURED_JSON'
  | 'DOM_PAIR'
  | 'HTML_PROSE'
  | 'VERSION_CARD'
  | 'PDF_TEXT'
  | 'SEMANTIC'
  | 'DOCUMENT_INTELLIGENCE';
export interface SourceApplicabilityContext {
  readonly brandBinding: 'OFFICIAL_SOURCE' | 'UNRESOLVED';
  readonly modelBinding: 'EXACT_MODEL' | 'UNRESOLVED';
  readonly model: string | null;
  readonly versionBinding: SpecApplicability['versionBinding'];
  readonly yearBinding: SpecApplicability['yearBinding'];
  readonly evidence: readonly SpecObservation['evidence'][];
}
export interface SpecApplicability {
  readonly modelBinding?: 'EXACT_MODEL' | 'UNRESOLVED';
  readonly versionBinding: 'EXACT_VERSION' | 'VERSION_MATRIX' | 'MODEL_SHARED' | 'UNRESOLVED';
  readonly yearBinding: 'EXACT_MY' | 'CURRENT_LINEUP' | 'UNRESOLVED';
  readonly confidence: number;
}
export interface SpecObservation {
  readonly target: Pick<
    SpecSourceTarget,
    'mmvIdentity' | 'brand' | 'model' | 'officialVersionLabel' | 'modelYear'
  >;
  readonly observation: {
    readonly observedLabel: string;
    readonly rawValue: string;
    readonly rawUnit: string | null;
    readonly parsedValue: string | number | boolean | null;
    readonly parsedUnit: string | null;
    readonly polarity: 'POSITIVE' | 'EXPLICIT_NEGATIVE';
  };
  readonly applicability: SpecApplicability;
  readonly evidence: {
    readonly sourceUrl: string;
    readonly sourceKind: SpecSourceKind;
    readonly evidenceText: string;
    readonly locator: string;
    readonly contentHash: string;
  };
  readonly factEvidence?: readonly SpecObservation['evidence'][];
  readonly applicabilityEvidence?: readonly SpecObservation['evidence'][];
  readonly extraction: { readonly method: SpecExtractionMethod; readonly confidence: number };
}
export interface SourceSnapshot {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly sourceKind: SpecSourceKind;
  readonly fetchedAt: string;
  readonly contentType: string;
  readonly contentHash: string;
  readonly extractorVersion: string;
  readonly targetKey: string;
}
/** Scope is source evidence, never filled from the requested target. */
export interface SourceScope {
  readonly applicabilityEvidence?: readonly SpecObservation['evidence'][];
  readonly evidenceText?: string;
  readonly configurationId?: string;
  readonly engineDesignation?: string;
  readonly fuel?: string;
  readonly transmission?: string;
  readonly component?: 'POWERTRAIN';
  readonly model: string | null;
  readonly version: string | null;
  readonly modelYear: number | null;
  readonly shared: boolean;
  readonly matrix: boolean;
  readonly currentLineup: boolean;
}
export interface SourceSection {
  readonly locator: string;
  readonly text: string;
  readonly scope: SourceScope;
}
export interface SourceFact extends SourceSection {
  readonly label: string;
  readonly value: string;
  readonly unit: string | null;
  readonly method: Exclude<SpecExtractionMethod, 'SEMANTIC'>;
}
export interface SpecSourceDocument {
  readonly pageContext?: SourceApplicabilityContext;
  readonly audit?: unknown;
  readonly rejectedFacts?: readonly { locator: string; text: string; reason: string }[];
  readonly snapshot: SourceSnapshot;
  readonly facts: readonly SourceFact[];
  readonly sections: readonly SourceSection[];
  readonly links: readonly string[];
  readonly issues: readonly string[];
}
export interface SpecSourceFormatAdapter {
  parse(body: string, snapshot: SourceSnapshot): SpecSourceDocument;
}
export interface SpecPdfAdapter {
  parse(bytes: Uint8Array, snapshot: SourceSnapshot): Promise<SpecSourceDocument>;
}
export interface SpecSemanticInput {
  readonly target: SpecSourceTarget;
  readonly snapshot: SourceSnapshot;
  readonly sections: readonly SourceSection[];
}
export interface SpecSemanticFact {
  readonly extractionConfidence?: number;
  readonly locator: string;
  readonly observedLabel: string;
  readonly rawValue: string;
  readonly rawUnit: string | null;
  readonly evidenceText: string;
}
export interface SpecSemanticProvider {
  extract(input: SpecSemanticInput): Promise<readonly SpecSemanticFact[]>;
}
