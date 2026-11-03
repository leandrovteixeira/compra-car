import type { SpecTarget27 } from './spec-agent-reconciliation';

export const SPEC_AGENT_TRIGGERS_27 = [
  'MMV_VALIDATED','MMV_MANUALLY_CREATED','MODEL_YEAR_CHANGED',
  'DOCUMENT_IMPORTED','OPERATOR_REPROCESS','OFFICIAL_SOURCE_UPDATED',
] as const;
export type SpecAgentTrigger27 = (typeof SPEC_AGENT_TRIGGERS_27)[number];
export interface SpecAgentWorkItem27 {
  target: SpecTarget27;
  trigger: SpecAgentTrigger27;
  /** Stable external event identifier; no dedupe by execution time. */
  eventId: string;
  sourceDocumentId?: string;
  sourceRevision?: string;
  /** For MY events, actual predecessor MY, not assumed modelYear - 1. */
  predecessorModelYear?: number;
  createdAt: string;
  dryRun: boolean;
}
export function planSpecAgentEvent27(input: SpecAgentWorkItem27): {
  dedupeKey: string;
  requiresDocument: boolean;
  runMode: 'DRY_RUN'|'EVENT';
} {
  if (!SPEC_AGENT_TRIGGERS_27.includes(input.trigger)) throw new Error('UNKNOWN_SPEC_TRIGGER');
  if (!input.eventId?.trim() || !input.target.productId?.trim() ||
      !Number.isInteger(input.target.modelYear) ||
      input.target.modelYear < 2000 || input.target.modelYear > 2100 ||
      !Number.isFinite(Date.parse(input.createdAt)))
    throw new Error('INVALID_SPEC_EVENT');
  if (input.trigger === 'DOCUMENT_IMPORTED' && !input.sourceDocumentId?.trim())
    throw new Error('SPEC_IMPORT_REQUIRES_DOCUMENT');
  if (input.trigger === 'MODEL_YEAR_CHANGED' &&
      (!Number.isInteger(input.predecessorModelYear) ||
       input.predecessorModelYear! >= input.target.modelYear))
    throw new Error('INVALID_SPEC_PREDECESSOR');
  const dedupeKey=JSON.stringify([
    'SPEC_INTELLIGENCE',input.target.productId,input.target.modelYear,
    input.trigger,input.eventId,input.sourceDocumentId ?? null,input.sourceRevision ?? null
  ]);
  return {
    dedupeKey,
    requiresDocument:input.trigger === 'DOCUMENT_IMPORTED',
    runMode:input.dryRun ? 'DRY_RUN' : 'EVENT'
  };
}
