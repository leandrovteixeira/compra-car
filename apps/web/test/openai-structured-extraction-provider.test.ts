import { describe, expect, it, vi } from 'vitest';
import { APIConnectionTimeoutError, APIError } from 'openai';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import { validateCommercialDocumentExtraction } from '@compra-car/core/commercial-document-extraction-validator';

import { geelyLikeCommercialDocumentExtractionFixture } from '../../../packages/core/test/fixtures/import/commercial-document-extraction-fixtures';
import type { OpenAIClientBoundary } from '../src/server/openai-extraction-provider';
import {
  OpenAIStructuredExtractionProvider,
  type StructuredProviderObservation,
} from '../src/server/openai-structured-extraction-provider';
import {
  createOpenAIStructuredOutputProjection,
  projectCanonicalValueForOpenAITransport,
  reconstructCanonicalValueFromOpenAITransport,
} from '../src/server/openai-structured-output-schema';

function createClient(options: { failResponse?: boolean; failCleanup?: boolean } = {}) {
  const uploads: string[] = [];
  const responses: Readonly<Record<string, unknown>>[] = [];
  const deletes: string[] = [];
  const client: OpenAIClientBoundary = {
    async upload(input) {
      uploads.push(input.filename);
      return { id: `file-${uploads.length}` };
    },
    async respond(input) {
      responses.push(input);
      if (options.failResponse) throw new Error('opaque');
      return {
        id: `response-${responses.length}`,
        output_text: JSON.stringify(geelyLikeCommercialDocumentExtractionFixture),
        usage: {
          input_tokens: responses.length,
          output_tokens: 2,
          total_tokens: responses.length + 2,
        },
      };
    },
    async deleteFile(id) {
      deletes.push(id);
      if (options.failCleanup) throw new Error('opaque');
    },
  };
  return { client, uploads, responses, deletes };
}

const request = (signal: AbortSignal) => ({
  instructions: 'Generic unit instructions.',
  schemaName: 'commercial_document_extraction_unit_v1',
  schema: createOpenAIStructuredOutputProjection(commercialDocumentExtractionSchemaV1),
  signal,
  metadata: { unitId: 'unit-0001', unitOrdinal: 1 },
});

function sdkError(
  status: number,
  message = 'safe fixture error',
  code = 'invalid_request_error',
  param?: string,
) {
  return APIError.generate(
    status,
    { error: { code, type: 'invalid_request_error', message, param } },
    'raw-body-must-not-escape',
    new Headers({ authorization: 'Bearer secret-must-not-escape', 'x-request-id': 'req_safe' }),
  );
}

describe('generic OpenAI structured extraction source session', () => {
  it('uploads each source document once, reuses it across units and cleans it after all responses', async () => {
    const fake = createClient();
    const provider = new OpenAIStructuredExtractionProvider(fake.client, 'test-model');
    const controller = new AbortController();
    const session = await provider.openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: controller.signal, correlationId: 'correlation-test' },
    );
    await session.extractStructured(request(controller.signal));
    await session.extractStructured({
      ...request(controller.signal),
      metadata: { unitId: 'unit-0002', unitOrdinal: 2 },
    });
    expect(fake.uploads).toEqual(['document-1.pdf']);
    expect(fake.responses).toHaveLength(2);
    expect(fake.responses.every((response) => response.store === false)).toBe(true);
    expect(fake.deletes).toEqual([]);
    await session.close();
    expect(fake.deletes).toEqual(['file-1']);
  });

  it('keeps response usage and provider run IDs unit-specific', async () => {
    const fake = createClient();
    const provider = new OpenAIStructuredExtractionProvider(fake.client, 'test-model');
    const controller = new AbortController();
    const session = await provider.openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: controller.signal, correlationId: 'correlation-test' },
    );
    const first = await session.extractStructured(request(controller.signal));
    const second = await session.extractStructured(request(controller.signal));
    expect(first.providerRunId).toBe('response-1');
    expect(second.providerRunId).toBe('response-2');
    expect(first.usage).not.toEqual(second.usage);
    await session.close();
  });

  it('uses compact IR context without repeating source files when explicitly requested', async () => {
    const fake = createClient();
    const session = await new OpenAIStructuredExtractionProvider(
      fake.client,
      'test-model',
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    await session.extractStructured({
      ...request(new AbortController().signal),
      documentContext: '{"schemaVersion":"CommercialTableIR/1","tables":[]}',
      includeSourceDocuments: false,
    });
    const serialized = JSON.stringify(fake.responses[0]);
    expect(serialized).toContain('Compact documentary context');
    expect(serialized).toContain('CommercialTableIR/1');
    expect(serialized).not.toContain('input_file');
    expect(fake.uploads).toEqual(['document-1.pdf']);
    await session.close();
  });

  it.each([
    [sdkError(400), 'PROVIDER_REQUEST_INVALID'],
    [sdkError(422), 'PROVIDER_REQUEST_INVALID'],
    [sdkError(401), 'PROVIDER_AUTH_ERROR'],
    [sdkError(403), 'PROVIDER_AUTH_ERROR'],
    [sdkError(429), 'PROVIDER_RATE_LIMITED'],
    [new APIConnectionTimeoutError(), 'PROVIDER_TIMEOUT'],
    [new Error('opaque unknown failure'), 'PROVIDER_UNKNOWN_ERROR'],
  ])('maps response_create failure %# without external calls', async (external, code) => {
    const fake = createClient();
    fake.client.respond = vi.fn(async () => {
      throw external;
    });
    const session = await new OpenAIStructuredExtractionProvider(
      fake.client,
      'test-model',
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    await expect(
      session.extractStructured(request(new AbortController().signal)),
    ).rejects.toMatchObject({ code });
    await session.close();
  });

  it('maps an aborted response to timeout', async () => {
    const fake = createClient();
    fake.client.respond = vi.fn(async () => {
      throw new Error('opaque abort detail');
    });
    const session = await new OpenAIStructuredExtractionProvider(
      fake.client,
      'test-model',
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    const controller = new AbortController();
    controller.abort();
    await expect(session.extractStructured(request(controller.signal))).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
    });
    await session.close();
  });

  it('distinguishes file upload failure', async () => {
    const fake = createClient();
    fake.client.upload = vi.fn(async () => {
      throw new Error('opaque upload detail');
    });
    await expect(
      new OpenAIStructuredExtractionProvider(fake.client, 'test-model').openSource(
        { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
        { signal: new AbortController().signal, correlationId: 'correlation-test' },
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_FILE_UPLOAD_FAILED' });
  });

  it('distinguishes refusal and invalid JSON output', async () => {
    const refusal = createClient();
    refusal.client.respond = vi.fn(async () => ({
      id: 'response-refusal',
      output_text: '',
      output: [{ type: 'message', content: [{ type: 'refusal' }] }],
    }));
    const refusalSession = await new OpenAIStructuredExtractionProvider(
      refusal.client,
      'test-model',
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    await expect(
      refusalSession.extractStructured(request(new AbortController().signal)),
    ).rejects.toMatchObject({ code: 'PROVIDER_REFUSAL' });
    await refusalSession.close();

    const invalid = createClient();
    invalid.client.respond = vi.fn(async () => ({
      id: 'response-invalid',
      output_text: '{',
      output: [],
    }));
    const invalidSession = await new OpenAIStructuredExtractionProvider(
      invalid.client,
      'test-model',
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    await expect(
      invalidSession.extractStructured(request(new AbortController().signal)),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_OUTPUT' });
    await invalidSession.close();
  });

  it('emits bounded invalid-schema diagnostics without raw body, headers, keys or URLs', async () => {
    const observe = vi.fn<(event: StructuredProviderObservation) => void>();
    const fake = createClient();
    fake.client.respond = vi.fn(async () => {
      throw sdkError(
        400,
        'Invalid schema sk-secret-must-not-escape\nhttps://signed.invalid/file?token=secret',
        'invalid_json_schema',
        'text.format.schema',
      );
    });
    const session = await new OpenAIStructuredExtractionProvider(
      fake.client,
      'test-model',
      true,
      observe,
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    await expect(
      session.extractStructured(request(new AbortController().signal)),
    ).rejects.toMatchObject({ code: 'PROVIDER_REQUEST_INVALID' });
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROVIDER_REQUEST_INVALID',
        stage: 'response_create',
        pipelineStage: 'unit_extraction',
        unitId: 'unit-0001',
        unitOrdinal: 1,
        httpStatus: 400,
        openaiCode: 'invalid_json_schema',
        openaiType: 'invalid_request_error',
        openaiParam: 'text.format.schema',
        requestId: 'req_safe',
        message: expect.stringContaining('[REDACTED]'),
      }),
    );
    const serialized = JSON.stringify(observe.mock.calls);
    expect(serialized).not.toContain('secret-must-not-escape');
    expect(serialized).not.toContain('signed.invalid');
    expect(serialized).not.toContain('raw-body-must-not-escape');
    expect(serialized).not.toContain('authorization');
    expect((observe.mock.calls[0]![0].message ?? '').length).toBeLessThanOrEqual(500);
    await session.close();
  });

  it('classifies metadata without exposing unsafe unit identifiers', async () => {
    const documentObserve = vi.fn<(event: StructuredProviderObservation) => void>();
    const document = createClient();
    document.client.respond = vi.fn(async () => {
      throw sdkError(400);
    });
    const documentSession = await new OpenAIStructuredExtractionProvider(
      document.client,
      'test-model',
      true,
      documentObserve,
    ).openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: new AbortController().signal, correlationId: 'correlation-test' },
    );
    await expect(
      documentSession.extractStructured({
        ...request(new AbortController().signal),
        metadata: { schemaVersion: 'CommercialDocumentMap/1' },
      }),
    ).rejects.toBeTruthy();
    expect(documentObserve).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineStage: 'document_map' }),
    );
    await documentSession.close();
  });

  it('does not delete a shared source on unit failure and reports cleanup independently', async () => {
    const fake = createClient({ failResponse: true, failCleanup: true });
    const observe = vi.fn<(event: StructuredProviderObservation) => void>();
    const provider = new OpenAIStructuredExtractionProvider(
      fake.client,
      'test-model',
      true,
      observe,
    );
    const controller = new AbortController();
    const session = await provider.openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: controller.signal, correlationId: 'correlation-test' },
    );
    await expect(session.extractStructured(request(controller.signal))).rejects.toMatchObject({
      code: 'PROVIDER_UNKNOWN_ERROR',
    });
    expect(fake.deletes).toEqual([]);
    await expect(session.close()).rejects.toMatchObject({ code: 'PROVIDER_FILE_CLEANUP_FAILED' });
    expect(fake.deletes).toEqual(['file-1']);
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROVIDER_FILE_CLEANUP_FAILED',
        stage: 'cleanup',
        pipelineStage: 'unit_extraction',
      }),
    );
  });

  it('round-trips the strict transport projection into the canonical contract', () => {
    const projectedSchema = createOpenAIStructuredOutputProjection(
      commercialDocumentExtractionSchemaV1,
    );
    const transport = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    );
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      transport,
      commercialDocumentExtractionSchemaV1,
    );
    expect(reconstructed).toEqual(geelyLikeCommercialDocumentExtractionFixture);
    expect(() => validateCommercialDocumentExtraction(reconstructed)).not.toThrow();
    expect(JSON.stringify(projectedSchema)).not.toMatch(
      /"oneOf"|"uniqueItems"|"minLength"|"maxLength"/u,
    );
  });

  it('contains no commercial-domain operation in the generic provider API', () => {
    expect(Object.getOwnPropertyNames(OpenAIStructuredExtractionProvider.prototype)).toEqual([
      'constructor',
      'openSource',
    ]);
  });
});
