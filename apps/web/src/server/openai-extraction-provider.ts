import 'server-only';

import OpenAI, {
  APIError,
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  toFile,
} from 'openai';
import type { ExtractionProvider, ExtractionRequest, ExtractionResult } from '@compra-car/core';

import {
  commercialLetterExtractionInstructions,
  commercialLetterExtractionSchema,
  reconstructCanonicalPayloads,
  validateCommercialLetterExtraction,
} from './commercial-letter-openai-extraction';
import { FakeExtractionProvider } from './fake-extraction-provider';

export type ProviderErrorCode =
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_INVALID_OUTPUT'
  | 'PROVIDER_REFUSAL'
  | 'PROVIDER_FILE_UPLOAD_FAILED'
  | 'PROVIDER_FILE_CLEANUP_FAILED'
  | 'PROVIDER_REQUEST_INVALID'
  | 'PROVIDER_UNKNOWN_ERROR';

export type ProviderStage =
  | 'client_create'
  | 'file_upload'
  | 'response_create'
  | 'response_parse'
  | 'extraction_validate'
  | 'canonical_normalization'
  | 'cleanup';

export const OPENAI_IMPORT_DEFAULT_TIMEOUT_MS = 480_000;
export const OPENAI_IMPORT_MIN_TIMEOUT_MS = 30_000;
export const OPENAI_IMPORT_MAX_TIMEOUT_MS = 600_000;

export function parseOpenAIImportTimeoutMs(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return OPENAI_IMPORT_DEFAULT_TIMEOUT_MS;
  if (!/^\d+$/u.test(value)) throw new OpenAIExtractionProviderError('PROVIDER_REQUEST_INVALID');
  const timeoutMs = Number(value);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < OPENAI_IMPORT_MIN_TIMEOUT_MS ||
    timeoutMs > OPENAI_IMPORT_MAX_TIMEOUT_MS
  )
    throw new OpenAIExtractionProviderError('PROVIDER_REQUEST_INVALID');
  return timeoutMs;
}

export interface ProviderObservation {
  readonly code: ProviderErrorCode;
  readonly count?: number;
  readonly stage?: ProviderStage;
  readonly errorName?: string;
  readonly httpStatus?: number;
  readonly openaiCode?: string;
  readonly openaiType?: string;
  readonly openaiParam?: string;
  readonly requestId?: string;
  readonly message?: string;
}

export class OpenAIExtractionProviderError extends Error {
  constructor(readonly code: ProviderErrorCode) {
    super(code);
    this.name = 'OpenAIExtractionProviderError';
  }
}

export interface OpenAIClientBoundary {
  upload(
    input: {
      readonly bytes: Uint8Array;
      readonly filename: string;
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<{ readonly id: string }>;
  respond(
    input: Readonly<Record<string, unknown>>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<{
    readonly id: string;
    readonly output_text: string;
    readonly output?: readonly unknown[];
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly total_tokens?: number;
    };
  }>;
  deleteFile(id: string): Promise<void>;
}

export class OfficialOpenAIClient implements OpenAIClientBoundary {
  private readonly client: OpenAI;
  constructor(apiKey: string, timeoutMs: number) {
    this.client = new OpenAI({ apiKey, maxRetries: 2, timeout: timeoutMs });
  }
  async upload(input: { bytes: Uint8Array; filename: string }, options?: { signal?: AbortSignal }) {
    return this.client.files.create(
      {
        file: await toFile(input.bytes, input.filename, { type: 'application/pdf' }),
        purpose: 'user_data',
        expires_after: { anchor: 'created_at', seconds: 3600 },
      },
      options,
    );
  }
  async respond(input: Readonly<Record<string, unknown>>, options?: { signal?: AbortSignal }) {
    return this.client.responses.create(input as never, options);
  }
  async deleteFile(id: string): Promise<void> {
    await this.client.files.delete(id);
  }
}

const safeInteger = (value: unknown): number =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  const status = Number(error.status);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

export function mapOpenAIError(
  error: unknown,
  stage?: ProviderStage,
): OpenAIExtractionProviderError {
  if (error instanceof OpenAIExtractionProviderError) return error;
  const status = errorStatus(error);
  const name = error instanceof Error ? error.name : '';
  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError ||
    status === 401 ||
    status === 403
  )
    return new OpenAIExtractionProviderError('PROVIDER_AUTH_ERROR');
  if (error instanceof RateLimitError || status === 429)
    return new OpenAIExtractionProviderError('PROVIDER_RATE_LIMITED');
  if (
    error instanceof APIConnectionTimeoutError ||
    name === 'APIConnectionTimeoutError' ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    status === 408
  )
    return new OpenAIExtractionProviderError('PROVIDER_TIMEOUT');
  if (stage === 'file_upload')
    return new OpenAIExtractionProviderError('PROVIDER_FILE_UPLOAD_FAILED');
  if (status === 400 || status === 422)
    return new OpenAIExtractionProviderError('PROVIDER_REQUEST_INVALID');
  return new OpenAIExtractionProviderError('PROVIDER_UNKNOWN_ERROR');
}

const safeDiagnosticScalar = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:/-]{1,160}$/u.test(value)) return undefined;
  return value;
};

const safeInvalidSchemaMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const sanitized = value
    .replace(/\b(?:sk|sess)-[A-Za-z0-9_-]{8,}\b/gu, '[REDACTED]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [REDACTED]')
    .replace(/https?:\/\/\S+/giu, '[URL_REDACTED]')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  return sanitized ? sanitized.slice(0, 500) : undefined;
};

export function openAIDiagnosticObservation(
  error: unknown,
  stage: ProviderStage,
): Omit<ProviderObservation, 'code'> {
  const sdkError = error instanceof APIError ? error : undefined;
  const status = errorStatus(error);
  const runtimeName =
    error instanceof Error && error.name !== 'Error' ? error.name : error?.constructor?.name;
  const errorName = safeDiagnosticScalar(runtimeName);
  const requestId = safeDiagnosticScalar(
    sdkError?.requestID ??
      (error && typeof error === 'object' && 'request_id' in error ? error.request_id : undefined),
  );
  const openaiCode = safeDiagnosticScalar(sdkError?.code);
  const openaiType = safeDiagnosticScalar(sdkError?.type);
  const openaiParam = safeDiagnosticScalar(sdkError?.param);
  const invalidSchemaMessage =
    openaiCode === 'invalid_json_schema' ? safeInvalidSchemaMessage(sdkError?.message) : undefined;
  return {
    stage,
    ...(errorName ? { errorName } : {}),
    ...(status ? { httpStatus: status } : {}),
    ...(openaiCode ? { openaiCode } : {}),
    ...(openaiType ? { openaiType } : {}),
    ...(openaiParam ? { openaiParam } : {}),
    ...(requestId ? { requestId } : {}),
    message:
      invalidSchemaMessage ??
      (status ? `OpenAI request failed with HTTP ${status}.` : `Provider failed at ${stage}.`),
  };
}

function hasRefusal(output: readonly unknown[] | undefined): boolean {
  return (output ?? []).some((item) => JSON.stringify(item).includes('"type":"refusal"'));
}

export class OpenAIExtractionProvider implements ExtractionProvider {
  readonly key = 'openai';
  readonly version = '4';
  private readonly client: OpenAIClientBoundary;
  constructor(
    private readonly config: {
      readonly apiKey: string;
      readonly model: string;
      readonly diagnostics?: boolean;
      readonly timeoutMs?: number;
    },
    client?: OpenAIClientBoundary,
    private readonly observe: (event: ProviderObservation) => void = (event) =>
      console.warn('OPENAI_IMPORT_PROVIDER', event),
  ) {
    if (!config.apiKey.trim()) throw new OpenAIExtractionProviderError('PROVIDER_AUTH_ERROR');
    if (!config.model.trim()) throw new OpenAIExtractionProviderError('PROVIDER_INVALID_OUTPUT');
    const timeoutMs = config.timeoutMs ?? OPENAI_IMPORT_DEFAULT_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < OPENAI_IMPORT_MIN_TIMEOUT_MS ||
      timeoutMs > OPENAI_IMPORT_MAX_TIMEOUT_MS
    )
      throw new OpenAIExtractionProviderError('PROVIDER_REQUEST_INVALID');
    try {
      this.client = client ?? new OfficialOpenAIClient(config.apiKey, timeoutMs);
    } catch (error) {
      this.observeDiagnostic(error, 'client_create');
      throw mapOpenAIError(error, 'client_create');
    }
  }

  private observeDiagnostic(
    error: unknown,
    stage: ProviderStage,
    code: ProviderErrorCode = mapOpenAIError(error, stage).code,
  ): void {
    if (!this.config.diagnostics) return;
    this.observe({ code, ...openAIDiagnosticObservation(error, stage) });
  }

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const fileIds: string[] = [];
    let primaryError: unknown;
    const deadline = Date.now() + (this.config.timeoutMs ?? OPENAI_IMPORT_DEFAULT_TIMEOUT_MS);
    const runTimed = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new OpenAIExtractionProviderError('PROVIDER_TIMEOUT');
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new OpenAIExtractionProviderError('PROVIDER_TIMEOUT'));
        }, remainingMs);
      });
      try {
        return await Promise.race([operation(controller.signal), timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    try {
      const orderedDocuments = request.documents
        .map((document, index) => ({
          document,
          ordinal: document.ordinal ?? index + 1,
        }))
        .sort((a, b) => a.ordinal - b.ordinal);
      for (const { document, ordinal } of orderedDocuments) {
        try {
          const file = await runTimed((signal) =>
            this.client.upload(
              { bytes: document.bytes, filename: `document-${ordinal}.pdf` },
              { signal },
            ),
          );
          fileIds.push(file.id);
        } catch (error) {
          this.observeDiagnostic(error, 'file_upload');
          throw mapOpenAIError(error, 'file_upload');
        }
      }
      const dossier = orderedDocuments
        .map(
          ({ document, ordinal }, index) =>
            `Documento ${index + 1}: documentId=${document.id}; role=${document.role}; ordinal=${ordinal}; filename(provenance only)=${document.originalFileName}`,
        )
        .join('\n');
      let response: Awaited<ReturnType<OpenAIClientBoundary['respond']>>;
      try {
        response = await runTimed((signal) =>
          this.client.respond(
            {
              model: this.config.model,
              store: false,
              instructions: `${commercialLetterExtractionInstructions}\n\n${request.instructions}`,
              input: [
                {
                  role: 'user',
                  content: [
                    { type: 'input_text', text: `Contexto do dossiê:\n${dossier}` },
                    ...fileIds.map((fileId) => ({ type: 'input_file', file_id: fileId })),
                  ],
                },
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'commercial_letter_extraction_v1',
                  strict: true,
                  schema: commercialLetterExtractionSchema,
                },
              },
            },
            { signal },
          ),
        );
      } catch (error) {
        this.observeDiagnostic(error, 'response_create');
        throw mapOpenAIError(error, 'response_create');
      }
      if (hasRefusal(response.output)) {
        const refusal = new OpenAIExtractionProviderError('PROVIDER_REFUSAL');
        this.observeDiagnostic(refusal, 'response_parse');
        throw refusal;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.output_text);
      } catch (error) {
        this.observeDiagnostic(error, 'response_parse', 'PROVIDER_INVALID_OUTPUT');
        throw new OpenAIExtractionProviderError('PROVIDER_INVALID_OUTPUT');
      }
      try {
        validateCommercialLetterExtraction(parsed);
      } catch (error) {
        this.observeDiagnostic(error, 'extraction_validate', 'PROVIDER_INVALID_OUTPUT');
        throw new OpenAIExtractionProviderError('PROVIDER_INVALID_OUTPUT');
      }
      let payloads: readonly Record<string, unknown>[];
      try {
        payloads = reconstructCanonicalPayloads(parsed);
      } catch (error) {
        this.observeDiagnostic(error, 'canonical_normalization', 'PROVIDER_INVALID_OUTPUT');
        throw new OpenAIExtractionProviderError('PROVIDER_INVALID_OUTPUT');
      }
      return {
        providerRunId: response.id,
        payloads,
        usage: {
          inputUnits: safeInteger(response.usage?.input_tokens),
          outputUnits: safeInteger(response.usage?.output_tokens),
          totalUnits: safeInteger(response.usage?.total_tokens),
        },
      };
    } catch (error) {
      primaryError = error;
      throw mapOpenAIError(error);
    } finally {
      const cleanupFailures = (
        await Promise.all(
          fileIds.map(async (id) => {
            try {
              await this.client.deleteFile(id);
              return false;
            } catch (error) {
              this.observeDiagnostic(error, 'cleanup', 'PROVIDER_FILE_CLEANUP_FAILED');
              return true;
            }
          }),
        )
      ).filter(Boolean).length;
      if (cleanupFailures) {
        this.observe({ code: 'PROVIDER_FILE_CLEANUP_FAILED', count: cleanupFailures });
        if (!primaryError && fileIds.length === cleanupFailures) {
          // Cleanup is observable but deliberately does not replace a successful extraction.
        }
      }
    }
  }
}

export function createConfiguredExtractionProvider(
  env: NodeJS.ProcessEnv = process.env,
): ExtractionProvider {
  const key = env.IMPORT_EXTRACTION_PROVIDER?.trim() || 'fake';
  if (key === 'fake') {
    return new FakeExtractionProvider();
  }
  if (key !== 'openai') throw new OpenAIExtractionProviderError('PROVIDER_UNKNOWN_ERROR');
  return new OpenAIExtractionProvider({
    apiKey: env.OPENAI_API_KEY ?? '',
    model: env.OPENAI_IMPORT_MODEL ?? '',
    diagnostics: env.NODE_ENV !== 'production' && env.OPENAI_IMPORT_DIAGNOSTICS === '1',
    timeoutMs: parseOpenAIImportTimeoutMs(env.OPENAI_IMPORT_TIMEOUT_MS),
  });
}
