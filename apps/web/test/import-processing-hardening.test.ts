/* eslint-disable @typescript-eslint/no-explicit-any -- semantic projection reads untrusted fixture JSON */
import { describe, expect, it, vi } from 'vitest';
import { FakeExtractionProvider } from '../src/server/fake-extraction-provider';
import { processAdminImportBatch } from '../src/server/import-engine-service';
import { OpenAIExtractionProviderError } from '../src/server/openai-extraction-provider';

const semanticProjection = (payload: any) => ({
  mmv: payload.mmv,
  competence: payload.commercialPeriod.competence,
  commercialPeriod: payload.commercialPeriod,
  publicPrice: payload.publicPrice,
  policies: payload.policies,
  offers: payload.offers,
});

describe('Import processing hardening', () => {
  it('routes PROVIDER_TIMEOUT through the atomic fail path without partial rows', async () => {
    const fail = vi.fn(async () => undefined);
    const finalize = vi.fn(async () => ({ idempotentReplay: false, rowCount: 0 }));
    const repository = {
      getBatch: vi.fn(async () => ({
        id: '111',
        documents: [
          {
            id: '42',
            status: 'ready',
            sourceOrder: 1,
            documentRole: 'primary',
            contentSha256: 'a'.repeat(64),
            originalFileName: 'Fiat.pdf',
            storageBucket: 'private',
            storageObjectPath: 'safe/path.pdf',
          },
        ],
      })),
    } as any;
    const processingRepository = {
      enqueue: vi.fn(async () => ({ jobId: '32', idempotentReplay: false })),
      claim: vi.fn(async () => ({ jobId: '32', idempotentReplay: false })),
      downloadDocument: vi.fn(async () => new Uint8Array([1])),
      findMatchCandidates: vi.fn(async () => []),
      finalize,
      fail,
    } as any;
    const extractionProvider = {
      key: 'timeout-fixture',
      version: '1',
      extract: vi.fn(async () => {
        throw new OpenAIExtractionProviderError('PROVIDER_TIMEOUT');
      }),
    };

    await expect(
      processAdminImportBatch('111', {
        repository,
        processingRepository,
        authorize: async () => ({ actorId: 'a2000000-0000-4000-8000-000000000001' }),
        createCorrelationId: () => 'c2000000-0000-4000-8000-000000000001',
        extractionProvider,
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: '32', errorCode: 'PROVIDER_TIMEOUT' }),
    );
    expect(finalize).not.toHaveBeenCalled();
  });

  it('keeps filename provenance outside semantic extraction decisions', async () => {
    const provider = new FakeExtractionProvider();
    const bytes = new TextEncoder().encode('%PDF-1.7\nsame-document');
    const request = (originalFileName: string) => ({
      documents: [
        {
          id: '1',
          role: 'primary',
          mimeType: 'application/pdf' as const,
          contentSha256: 'a'.repeat(64),
          originalFileName,
          bytes,
        },
      ],
      schemaVersion: 'commercial-letter/mmv-payload/1',
      schema: {},
      instructions: 'fixture',
    });
    const descriptive = await provider.extract(request('Carta_Comercial_Geely_Julho_2026.pdf'));
    const opaque = await provider.extract(request('opaque-8f9282.pdf'));
    expect(descriptive.providerRunId).toBe(opaque.providerRunId);
    expect(semanticProjection(descriptive.payloads[0])).toEqual(
      semanticProjection(opaque.payloads[0]),
    );
  });

  it('accepts deterministic fixture scenarios while preserving dossier roles in the request boundary', async () => {
    const provider = new FakeExtractionProvider([
      { scenario: 'primary-errata' },
      { scenario: 'complement-mmv' },
    ]);
    const bytes = new TextEncoder().encode('%PDF-1.7');
    const result = await provider.extract({
      documents: [
        {
          id: '1',
          role: 'primary',
          mimeType: 'application/pdf',
          contentSha256: 'a'.repeat(64),
          originalFileName: 'primary.pdf',
          bytes,
        },
        {
          id: '2',
          role: 'errata',
          mimeType: 'application/pdf',
          contentSha256: 'b'.repeat(64),
          originalFileName: 'errata.pdf',
          bytes,
        },
        {
          id: '3',
          role: 'complement',
          mimeType: 'application/pdf',
          contentSha256: 'c'.repeat(64),
          originalFileName: 'complement.pdf',
          bytes,
        },
      ],
      schemaVersion: 'commercial-letter/mmv-payload/1',
      schema: {},
      instructions: 'fixture',
    });
    expect(result.payloads).toHaveLength(2);
    expect(result.usage).toEqual({ inputUnits: bytes.byteLength * 3, outputUnits: 2 });
  });
});
