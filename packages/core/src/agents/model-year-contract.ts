import type { AgentObject } from '../agent-platform/types';

export const MODEL_YEAR_STATUSES = [
  'ACTIVE',
  'LIKELY_ACTIVE',
  'DISCONTINUED',
  'UNKNOWN',
] as const;
export type ModelYearStatus = (typeof MODEL_YEAR_STATUSES)[number];

export const MODEL_YEAR_REASON_CODES = [
  'NEW_MODEL_YEAR',
  'CONFIRMED_MODEL_YEAR',
  'PRODUCTION_MODEL_YEAR_PAIR',
  'MODEL_YEAR_CONFLICT',
  'PRODUCTION_MODEL_YEAR_CONFLICT',
  'POSSIBLE_NEW_MMV',
  'POSSIBLE_DISCONTINUATION',
  'INSUFFICIENT_YEAR_EVIDENCE',
] as const;
export type ModelYearReasonCode = (typeof MODEL_YEAR_REASON_CODES)[number];

export interface CanonicalMmvModelYear {
  readonly id: string;
  readonly mmvId: string;
  readonly modelYear: number;
  readonly productionYear: number;
  readonly status: ModelYearStatus;
  readonly confidence: number | null;
  readonly sourceFindingId: string;
  readonly lastConfirmedFindingId: string;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModelYearObservation {
  readonly mmvId: string;
  readonly brand: string;
  readonly model: string;
  readonly officialVersionLabel: string;
  readonly modelYear: number;
  readonly productionYear: number;
  readonly confidence: number;
  readonly sourceUrls: readonly string[];
}

export interface ModelYearFindingDraft {
  readonly findingType:
    | 'NEW_PRODUCT_YEAR'
    | 'PRODUCT_YEAR_CONFLICT'
    | 'PRODUCT_YEAR_UNCERTAIN'
    | 'POSSIBLE_NEW_MMV'
    | 'PRODUCT_YEAR_DISCONTINUED'
    | 'PRODUCTION_MODEL_YEAR_CONFLICT';
  readonly reasonCode: ModelYearReasonCode;
  readonly mmvId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly confidence: number;
  readonly requiresReview: boolean;
  readonly subject: AgentObject;
  readonly proposal: AgentObject | null;
  readonly payload: AgentObject;
}


export interface CanonicalMmvModelYearRepository {
  listModelYears(filters?: {
    readonly mmvId?: string;
    readonly status?: ModelYearStatus;
  }): Promise<readonly CanonicalMmvModelYear[]>;
  applyAcceptedProposal(input: {
    readonly findingId: string;
    readonly actor: string;
    readonly proposal: AgentObject;
    readonly expectedFingerprint: string;
  }): Promise<readonly CanonicalMmvModelYear[]>;
}
