import 'server-only';

import type {
  SegmentedExtractionSource,
  StructuredExtractionProvider,
  StructuredExtractionRequest,
  StructuredExtractionSourceSession,
} from '@compra-car/core';

import {
  mapOpenAIError,
  openAIDiagnosticObservation,
  type OpenAIClientBoundary,
  type ProviderErrorCode,
  type ProviderObservation,
  type ProviderStage,
} from './openai-extraction-provider';

export interface StructuredProviderObservation extends ProviderObservation {
  readonly pipelineStage?: 'document_map' | 'unit_extraction';
  readonly unitId?: string;
  readonly unitOrdinal?: number;
}

export class OpenAIStructuredExtractionError extends Error {
  constructor(readonly code: ProviderErrorCode) {
    super(code);
    this.name = 'OpenAIStructuredExtractionError';
  }
}

const safeInteger = (value: unknown): number =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const hasRefusal = (output: readonly unknown[] | undefined): boolean =>
  (output ?? []).some((item) => JSON.stringify(item).includes('"type":"refusal"'));
const safeMetadataId = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/u.test(value) ? value : undefined;
const requestContext = (
  metadata: StructuredExtractionRequest['metadata'] | undefined,
): Pick<StructuredProviderObservation, 'pipelineStage' | 'unitId' | 'unitOrdinal'> => {
  if (!metadata) return {};
  const unitId = safeMetadataId(metadata.unitId);
  const unitOrdinal = safeInteger(metadata.unitOrdinal);
  return {
    pipelineStage: unitId ? 'unit_extraction' : 'document_map',
    ...(unitId ? { unitId } : {}),
    ...(unitId && unitOrdinal > 0 ? { unitOrdinal } : {}),
  };
};

export class OpenAIStructuredExtractionProvider implements StructuredExtractionProvider {
  constructor(
    private readonly client: OpenAIClientBoundary,
    private readonly model: string,
    private readonly diagnostics = false,
    private readonly observe: (event: StructuredProviderObservation) => void = (event) =>
      console.warn('OPENAI_STRUCTURED_PROVIDER', event),
  ) {
    if (!model.trim()) throw new OpenAIStructuredExtractionError('PROVIDER_INVALID_OUTPUT');
  }

  async openSource(
    source: SegmentedExtractionSource,
    options: { readonly signal: AbortSignal; readonly correlationId: string },
  ): Promise<StructuredExtractionSourceSession> {
    const fileIds: string[] = [];
    let lastMetadata: StructuredExtractionRequest['metadata'] | undefined;
    const observeDiagnostic = (
      error: unknown,
      stage: ProviderStage,
      code: ProviderErrorCode = mapOpenAIError(error, stage).code,
      metadata: StructuredExtractionRequest['metadata'] | undefined = lastMetadata,
    ): void => {
      if (!this.diagnostics) return;
      this.observe({
        code,
        ...openAIDiagnosticObservation(error, stage),
        ...requestContext(metadata),
      });
    };
    const deleteSources = async (
      metadata?: StructuredExtractionRequest['metadata'],
    ): Promise<number> => {
      let failures = 0;
      for (const id of fileIds) {
        try {
          await this.client.deleteFile(id);
        } catch (error) {
          failures += 1;
          observeDiagnostic(error, 'cleanup', 'PROVIDER_FILE_CLEANUP_FAILED', metadata);
        }
      }
      if (failures && this.diagnostics)
        this.observe({
          code: 'PROVIDER_FILE_CLEANUP_FAILED',
          count: failures,
          stage: 'cleanup',
          ...requestContext(metadata),
        });
      return failures;
    };

    try {
      for (const document of [...source.documents].sort(
        (left, right) => left.ordinal - right.ordinal,
      )) {
        const file = await this.client.upload(
          { bytes: document.bytes, filename: `document-${document.ordinal}.pdf` },
          { signal: options.signal },
        );
        fileIds.push(file.id);
      }
    } catch (error) {
      observeDiagnostic(error, 'file_upload');
      await deleteSources();
      const code = options.signal.aborted
        ? 'PROVIDER_TIMEOUT'
        : mapOpenAIError(error, 'file_upload').code;
      throw new OpenAIStructuredExtractionError(code);
    }

    let closed = false;
    return {
      extractStructured: async (request: StructuredExtractionRequest) => {
        lastMetadata = request.metadata;
        if (closed) throw new OpenAIStructuredExtractionError('PROVIDER_UNKNOWN_ERROR');
        let response: Awaited<ReturnType<OpenAIClientBoundary['respond']>>;
        try {
          response = await this.client.respond(
            {
              model: this.model,
              store: false,
              instructions: request.instructions,
              input: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: `Unit metadata: ${JSON.stringify(request.metadata)}`,
                    },
                    ...fileIds.map((fileId) => ({ type: 'input_file', file_id: fileId })),
                  ],
                },
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: request.schemaName,
                  strict: true,
                  schema: request.schema,
                },
              },
            },
            { signal: request.signal },
          );
        } catch (error) {
          const code = request.signal.aborted
            ? 'PROVIDER_TIMEOUT'
            : mapOpenAIError(error, 'response_create').code;
          observeDiagnostic(error, 'response_create', code, request.metadata);
          throw new OpenAIStructuredExtractionError(code);
        }
        if (hasRefusal(response.output)) {
          const refusal = new OpenAIStructuredExtractionError('PROVIDER_REFUSAL');
          observeDiagnostic(refusal, 'response_parse', refusal.code, request.metadata);
          throw refusal;
        }
        try {
          return {
            output: JSON.parse(response.output_text),
            providerRunId: response.id,
            usage: {
              inputUnits: safeInteger(response.usage?.input_tokens),
              outputUnits: safeInteger(response.usage?.output_tokens),
              totalUnits: safeInteger(response.usage?.total_tokens),
            },
          };
        } catch (error) {
          observeDiagnostic(error, 'response_parse', 'PROVIDER_INVALID_OUTPUT', request.metadata);
          throw new OpenAIStructuredExtractionError('PROVIDER_INVALID_OUTPUT');
        }
      },
      close: async () => {
        if (closed) return;
        closed = true;
        if ((await deleteSources(lastMetadata)) > 0)
          throw new OpenAIStructuredExtractionError('PROVIDER_FILE_CLEANUP_FAILED');
      },
    };
  }
}
