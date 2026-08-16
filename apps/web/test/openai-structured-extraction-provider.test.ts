import { describe, expect, it } from 'vitest';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import { validateCommercialDocumentExtraction } from '@compra-car/core/commercial-document-extraction-validator';

import { geelyLikeCommercialDocumentExtractionFixture } from '../../../packages/core/test/fixtures/import/commercial-document-extraction-fixtures';
import type { OpenAIClientBoundary } from '../src/server/openai-extraction-provider';
import { OpenAIStructuredExtractionProvider } from '../src/server/openai-structured-extraction-provider';
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

  it('does not delete a shared source on unit failure and reports cleanup independently', async () => {
    const fake = createClient({ failResponse: true, failCleanup: true });
    const provider = new OpenAIStructuredExtractionProvider(fake.client, 'test-model');
    const controller = new AbortController();
    const session = await provider.openSource(
      { documents: [{ documentId: 'document-1', ordinal: 1, bytes: new Uint8Array([1]) }] },
      { signal: controller.signal, correlationId: 'correlation-test' },
    );
    await expect(session.extractStructured(request(controller.signal))).rejects.toMatchObject({
      code: 'PROVIDER_FAILURE',
    });
    expect(fake.deletes).toEqual([]);
    await expect(session.close()).rejects.toMatchObject({ code: 'PROVIDER_FILE_CLEANUP_FAILED' });
    expect(fake.deletes).toEqual(['file-1']);
  });

  it('round-trips the strict transport projection into the canonical contract', () => {
    const projectedSchema = createOpenAIStructuredOutputProjection(
      commercialDocumentExtractionSchemaV1,
    );
    const transport = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    );
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(transport);
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
