import 'server-only';

import type {
  SegmentedExtractionSource,
  StructuredExtractionProvider,
  StructuredExtractionRequest,
  StructuredExtractionSourceSession,
} from '@compra-car/core';

import type { OpenAIClientBoundary } from './openai-extraction-provider';

export class OpenAIStructuredExtractionError extends Error {
  constructor(
    readonly code:
      | 'PROVIDER_TIMEOUT'
      | 'PROVIDER_FAILURE'
      | 'PROVIDER_INVALID_OUTPUT'
      | 'PROVIDER_FILE_CLEANUP_FAILED',
  ) {
    super(code);
    this.name = 'OpenAIStructuredExtractionError';
  }
}

const safeInteger = (value: unknown): number =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const hasRefusal = (output: readonly unknown[] | undefined): boolean =>
  (output ?? []).some((item) => JSON.stringify(item).includes('"type":"refusal"'));

export class OpenAIStructuredExtractionProvider implements StructuredExtractionProvider {
  constructor(
    private readonly client: OpenAIClientBoundary,
    private readonly model: string,
  ) {
    if (!model.trim()) throw new OpenAIStructuredExtractionError('PROVIDER_FAILURE');
  }

  async openSource(
    source: SegmentedExtractionSource,
    options: { readonly signal: AbortSignal; readonly correlationId: string },
  ): Promise<StructuredExtractionSourceSession> {
    const fileIds: string[] = [];
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
    } catch {
      await Promise.allSettled(fileIds.map((id) => this.client.deleteFile(id)));
      if (options.signal.aborted) throw new OpenAIStructuredExtractionError('PROVIDER_TIMEOUT');
      throw new OpenAIStructuredExtractionError('PROVIDER_FAILURE');
    }

    let closed = false;
    return {
      extractStructured: async (request: StructuredExtractionRequest) => {
        if (closed) throw new OpenAIStructuredExtractionError('PROVIDER_FAILURE');
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
        } catch {
          if (request.signal.aborted) throw new OpenAIStructuredExtractionError('PROVIDER_TIMEOUT');
          throw new OpenAIStructuredExtractionError('PROVIDER_FAILURE');
        }
        if (hasRefusal(response.output))
          throw new OpenAIStructuredExtractionError('PROVIDER_FAILURE');
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
        } catch {
          throw new OpenAIStructuredExtractionError('PROVIDER_INVALID_OUTPUT');
        }
      },
      close: async () => {
        if (closed) return;
        closed = true;
        const results = await Promise.allSettled(fileIds.map((id) => this.client.deleteFile(id)));
        if (results.some((result) => result.status === 'rejected'))
          throw new OpenAIStructuredExtractionError('PROVIDER_FILE_CLEANUP_FAILED');
      },
    };
  }
}
