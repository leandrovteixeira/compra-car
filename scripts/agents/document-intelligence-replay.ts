import type {
  DocumentModelTransport,
  DocumentModelRequest,
  DocumentIntelligenceSource,
  TechnicalSheetContent,
  DocumentIntelligenceTarget,
  DocumentModelResponse,
} from '@compra-car/core/agents';
import {
  ValidatedDocumentIntelligence,
  validateDocumentExtraction,
  documentCost,
} from '@compra-car/core/agents';
export interface CapturedDocumentResponse {
  model: string;
  id: string;
  status: string;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  };
}
export class ReplayDocumentTransport implements DocumentModelTransport {
  calls = 0;
  constructor(private readonly responses: readonly DocumentModelResponse[]) {}
  async count() {
    return this.responses[this.calls]?.usage.inputTokens ?? 0;
  }
  async generate(r: DocumentModelRequest) {
    const v = this.responses[this.calls++];
    if (!v || v.model !== r.model) throw new Error('REPLAY_SEQUENCE_MISMATCH');
    return structuredClone(v);
  }
}
/** Versioned adapter for historical benchmark shape; does not fabricate evidence absent from capture. */
export function adaptBenchmarkCapture(
  c: CapturedDocumentResponse,
  source: DocumentIntelligenceSource,
): DocumentModelResponse {
  const raw = JSON.parse(
    c.output
      ?.flatMap((o) => o.content ?? [])
      .filter((x) => x.type === 'output_text')
      .map((x) => x.text ?? '')
      .join('') ?? 'null',
  ) as {
    documentIdentity: {
      brand: string | null;
      model: string | null;
      version: string | null;
      modelYear: number | null;
    };
    sections: {
      sourceHeading: string;
      items: {
        subgroup: string | null;
        sourceLabel: string;
        rawValue: string | null;
        rawUnit: string | null;
        kind: TechnicalSheetContent['sections'][number]['items'][number]['kind'];
        present: boolean | null;
        sourceEvidence: string;
        page: number;
      }[];
    }[];
  };
  const app = {
    model: raw.documentIdentity.model,
    version: raw.documentIdentity.version,
    modelYear: raw.documentIdentity.modelYear,
    versionBinding: 'UNRESOLVED' as const,
    yearBinding: 'UNRESOLVED' as const,
  };
  const content: TechnicalSheetContent = {
    documentIdentity: {
      brand: raw.documentIdentity.brand,
      model: raw.documentIdentity.model,
      version: raw.documentIdentity.version,
      modelYear: raw.documentIdentity.modelYear,
      evidence: [],
    },
    sections: raw.sections.map((s) => ({
      sourceHeading: s.sourceHeading,
      normalizedHeading: null,
      applicability: app,
      items: s.items.map((i) => ({
        sourceLabel: i.sourceLabel,
        rawValue: i.rawValue,
        rawUnit: i.rawUnit,
        kind: i.kind,
        present: i.present,
        subgroup: i.subgroup,
        parentGroup: null,
        rawText: i.sourceEvidence,
        evidence: [
          { sourceHash: source.sourceHash, locator: 'page/' + i.page, quote: i.sourceEvidence },
        ],
        applicability: app,
      })),
    })),
  };
  return {
    content,
    model: c.model,
    responseId: c.id,
    completed: c.status === 'completed',
    durationMs: 0,
    usage: {
      inputTokens: c.usage.input_tokens,
      cachedInputTokens: c.usage.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: c.usage.output_tokens,
      reasoningTokens: c.usage.output_tokens_details?.reasoning_tokens ?? 0,
    },
  };
}
export async function replayDocuments(
  source: DocumentIntelligenceSource,
  target: DocumentIntelligenceTarget,
  primary: DocumentModelResponse,
  repair?: DocumentModelResponse,
) {
  const transport = new ReplayDocumentTransport([primary, ...(repair ? [repair] : [])]);
  const pipeline = await new ValidatedDocumentIntelligence(transport).extract(source, target);
  return {
    pipeline,
    replayCalls: transport.calls,
    currentApiCalls: 0,
    currentApiCostUsd: 0,
    capturedPrimaryValidation: validateDocumentExtraction(source, target, primary.content),
    capturedRepairValidation: repair
      ? validateDocumentExtraction(source, target, repair.content)
      : null,
    historicalPrimaryCostUsd: documentCost(primary.model, primary.usage),
    historicalTotalCostUsd:
      documentCost(primary.model, primary.usage) +
      (repair ? documentCost(repair.model, repair.usage) : 0),
  };
}
