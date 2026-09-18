import { DOCUMENT_STRATEGY, documentCost, maximumDocumentCost } from './document-intelligence-cost';
import { validateDocumentExtraction } from './document-intelligence-validator';
import { routeSpecSource, classifyDocumentSource } from './spec-source-policy';
import type { DocumentIntelligenceTarget } from './document-intelligence-types';
import type {
  DocumentIntelligenceProvider,
  DocumentIntelligenceSource,
  DocumentIntelligenceOptions,
  DocumentIntelligenceResult,
  DocumentModelTransport,
  DocumentModelRequest,
  ExtractionValidation,
} from './document-intelligence-types';
/** Shared by real OpenAI and replay transports. No Golden, database or network dependency. */
export class ValidatedDocumentIntelligence implements DocumentIntelligenceProvider {
  constructor(private readonly transport: DocumentModelTransport) {}
  async extract(
    source: DocumentIntelligenceSource,
    target: DocumentIntelligenceTarget,
    options: DocumentIntelligenceOptions = {},
  ): Promise<DocumentIntelligenceResult> {
    source = {
      ...source,
      sourceClass: classifyDocumentSource(source.reference, source.title ?? '', source.sourceClass),
    };
    const started = Date.now(),
      { bytes: _bytes, ...safeSource } = source;
    void _bytes;
    const result: DocumentIntelligenceResult = {
      status: 'HUMAN_REVIEW_REQUIRED',
      reason: null,
      strategy: routeSpecSource(source),
      target,
      source: safeSource,
      extraction: null,
      observations: [],
      validations: [],
      requests: [],
      totalCostUsd: 0,
      durationMs: 0,
      softCostWarning: false,
    };
    const finish = (reason: string | null) => {
      result.reason = reason;
      result.durationMs = Date.now() - started;
      result.softCostWarning = result.totalCostUsd > DOCUMENT_STRATEGY.softWarningUsd;
      return result;
    };
    if (result.strategy === 'REJECT_SOURCE') return finish('SOURCE_KIND_EXCLUDED');
    // This provider is the model route; a caller may choose a separate lossless adapter.
    result.strategy = 'DOCUMENT_INTELLIGENCE';
    const cap = options.hardCostCapUsd ?? DOCUMENT_STRATEGY.documentHardCostCapUsd,
      limit = options.maxOutputTokens ?? DOCUMENT_STRATEGY.maxOutputTokens,
      repairs = options.maxRepairCalls ?? 1;
    if (
      !Number.isFinite(cap) ||
      cap <= 0 ||
      cap > 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 18000 ||
      ![0, 1].includes(repairs)
    )
      return finish('INVALID_DOCUMENT_OPTIONS');
    if (source.truncated) return finish('STRUCTURE_INCOMPLETE');
    let proposal: unknown;
    let validation: ExtractionValidation | undefined;
    for (let pass = 0; pass <= repairs; pass++) {
      const model = pass ? DOCUMENT_STRATEGY.repairModel : DOCUMENT_STRATEGY.primaryModel;
      const request: DocumentModelRequest = {
        model,
        source,
        target,
        ...(pass ? { repair: { proposal, issues: validation!.issues } } : {}),
      };
      try {
        const input = await this.transport.count(request);
        if (!Number.isInteger(input) || input < 0) return finish('INVALID_TOKEN_COUNT');
        const maximum = maximumDocumentCost(model, input, limit);
        if (result.totalCostUsd + maximum > cap) return finish('COST_CAP');
        const response = await this.transport.generate(request, limit);
        const actual = documentCost(model, response.usage);
        result.requests.push({
          model: response.model,
          responseId: response.responseId,
          usage: response.usage,
          durationMs: response.durationMs,
          extractionPass: pass ? 'REPAIR' : 'PRIMARY',
          countedInputTokens: input,
          maximumCostUsd: maximum,
          actualCostUsd: actual,
        });
        result.totalCostUsd += actual;
        proposal = response.content;
        if (response.model !== model) return finish('REPAIR_FAILED');
        if (result.totalCostUsd > cap) return finish('COST_CAP');
        validation = validateDocumentExtraction(source, target, proposal);
        if (!response.completed) {
          validation.issues.push({
            code: 'STRUCTURE_INCOMPLETE',
            path: 'response',
            severity: 'REPAIR',
            detail: 'Model response incomplete; return complete bounded extraction',
          });
          if (validation.status === 'PASS') validation.status = 'REPAIR_REQUIRED';
          validation.observations = [];
        }
        result.validations.push(validation);
        if (validation.inventory)
          result.extraction = {
            ...validation.inventory,
            extractionMetadata: {
              ...result.requests[result.requests.length - 1]!,
              sourceHash: source.sourceHash,
            },
          };
        if (validation.status === 'PASS') {
          result.status = 'PASS';
          result.observations = validation.observations;
          return finish(null);
        }
        if (validation.status === 'HUMAN_REVIEW_REQUIRED')
          return finish(
            validation.issues.some((i) =>
              ['DOCUMENT_IDENTITY_UNRESOLVED', 'IDENTITY_SOURCE_AMBIGUOUS'].includes(i.code),
            )
              ? 'IDENTITY_AMBIGUOUS'
              : validation.issues.some((i) => i.code === 'TARGET_VERSION_CONFLICT')
                ? 'VERSION_AMBIGUOUS'
                : 'LOW_EXTRACTION_QUALITY',
          );
        if (pass === repairs) return finish(pass ? 'REPAIR_FAILED' : 'LOW_EXTRACTION_QUALITY');
      } catch {
        return finish('PROVIDER_FAILED');
      }
    }
    return finish('REPAIR_FAILED');
  }
}
