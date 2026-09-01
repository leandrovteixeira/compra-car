/* eslint-disable @typescript-eslint/no-explicit-any -- canonical payload assertions exercise JSON */
import { describe, expect, it, vi } from 'vitest';
import type {
  SegmentedArtifactManifest,
  StructuredExtractionProvider,
  StructuredExtractionRequest,
} from '@compra-car/core';
import {
  canonicalizeSegmentedArtifactBody,
  hashSegmentedArtifactBytes,
} from '@compra-car/core/segmented-artifact-lifecycle';
import { geelyLikeCommercialDocumentMapFixture } from '../../../packages/core/test/fixtures/import/commercial-document-map-fixtures';
import { geelyLikeCommercialDocumentExtractionFixture } from '../../../packages/core/test/fixtures/import/commercial-document-extraction-fixtures';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import { commercialDocumentMapSchemaV1 } from '@compra-car/core/commercial-document-map-schema';
import { projectCanonicalValueForOpenAITransport } from '../src/server/openai-structured-output-schema';

import {
  auditDocumentMapMetadataReferences,
  executeSegmentedImportRuntime,
  openAITransportDocumentExtractionSchema,
  openAITransportDocumentMapSchema,
  type SegmentedRuntimeArtifact,
  type SegmentedRuntimeArtifactStore,
} from '../src/server/segmented-import-runtime';
import { processAdminImportBatch } from '../src/server/import-engine-service';

const documentMapTransport = (): typeof geelyLikeCommercialDocumentMapFixture => {
  const projected = projectCanonicalValueForOpenAITransport(
    geelyLikeCommercialDocumentMapFixture,
    commercialDocumentMapSchemaV1,
  ) as typeof geelyLikeCommercialDocumentMapFixture;
  const ids = new Map<string, string>();
  let nextId = 0;
  const localId = /^(?:document|page|block|section|table|note|hint|edge)-/u;
  const replaceIds = (value: unknown): unknown => {
    if (typeof value === 'string' && localId.test(value)) {
      if (!ids.has(value)) ids.set(value, `Model Local ID ${++nextId}`);
      return ids.get(value)!;
    }
    if (Array.isArray(value)) return value.map(replaceIds);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, replaceIds(item)]),
      );
    return value;
  };
  return replaceIds(projected) as typeof geelyLikeCommercialDocumentMapFixture;
};

const documentMapTransportMissingSectionBackReference = () => {
  const map = documentMapTransport();
  const section = map.sections[0]!;
  const page = map.pages.find((item) => item.pageId === section.pageIds[0])!;
  (page as unknown as { sectionIds: string[] }).sectionIds = page.sectionIds.filter(
    (sectionId) => sectionId !== section.sectionId,
  );
  return map;
};

const extractionTransport = <T>(value: T): T =>
  projectCanonicalValueForOpenAITransport(value, commercialDocumentExtractionSchemaV1) as T;

const batch = {
  id: '10',
  title: 'Geely local fake',
  pluginKey: 'commercial_letters' as const,
  competence: null,
  notes: null,
  status: 'extracting' as const,
  documentCount: 1,
  mmvCount: 0,
  createdByName: null,
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
  lockVersion: 1,
  documents: [
    {
      id: 'document-main',
      batchId: '10',
      documentType: 'pdf' as const,
      originalFileName: 'geely.pdf',
      storageBucket: 'private',
      storageObjectPath: 'geely.pdf',
      mimeType: 'application/pdf' as const,
      fileSizeBytes: 4,
      contentSha256: 'a'.repeat(64),
      pageCount: 5,
      status: 'processing' as const,
      sourceOrder: 1,
      documentRole: 'primary' as const,
      errorCode: null,
      errorMessage: null,
      lockVersion: 1,
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    },
  ],
};

const store = (): SegmentedRuntimeArtifactStore & { values: SegmentedRuntimeArtifact[] } => {
  const values: SegmentedRuntimeArtifact[] = [];
  return {
    values,
    async load(selector) {
      return values.find(
        ({ manifest }) =>
          manifest.batchId === selector.batchId &&
          manifest.jobId === selector.jobId &&
          manifest.stage === selector.stage &&
          manifest.documentId === selector.documentId &&
          manifest.unitId === selector.unitId,
      );
    },
    async publish(input) {
      const id = `artifact-${values.length + 1}`;
      const bytes = canonicalizeSegmentedArtifactBody(input.body);
      const sha256 = await hashSegmentedArtifactBytes(bytes);
      expect(await hashSegmentedArtifactBytes(bytes)).toBe(sha256);
      const manifest = {
        schemaVersion: 'SegmentedImportArtifactManifest/1',
        pipelineVersion: 'segmented-import/1',
        artifactSchemaVersion: input.artifactSchemaVersion,
        artifactId: id,
        artifactVersion: 1,
        batchId: input.batchId,
        jobId: input.jobId,
        ...(input.documentId ? { documentId: input.documentId } : {}),
        ...(input.unitId ? { unitId: input.unitId } : {}),
        stage: input.stage,
        attempt: input.attempt,
        status: 'succeeded',
        correlationId: input.correlationId,
        idempotencyKey: id,
        sourceArtifactIds: input.sourceArtifacts.map((item) => item.artifactId),
        content: { sha256, byteLength: bytes.byteLength, canonicalization: 'canonical-json/1' },
        storage: { bucket: 'import-processing-artifacts', objectPath: `${id}.json` },
        ...(input.provider ? { provider: input.provider } : {}),
        createdAt: '2026-08-21T00:00:00.000Z',
        startedAt: '2026-08-21T00:00:00.000Z',
        completedAt: '2026-08-21T00:00:00.000Z',
      } satisfies SegmentedArtifactManifest;
      const value = { manifest, body: input.body };
      values.push(value);
      return value;
    },
  };
};

describe('segmented import runtime', () => {
  it('runs all stages with one source open and replays without provider calls', async () => {
    let opens = 0;
    let calls = 0;
    let closes = 0;
    const requests: StructuredExtractionRequest[] = [];
    const provider: StructuredExtractionProvider = {
      async openSource() {
        opens += 1;
        return {
          async extractStructured(request) {
            calls += 1;
            requests.push(request);
            const selectedVehicleIds = new Set(
              geelyLikeCommercialDocumentExtractionFixture.vehicleIdentities
                .slice(calls === 2 ? 0 : calls === 3 ? 2 : 0, calls === 2 ? 2 : calls === 3 ? 4 : 0)
                .map((item) => item.vehicleIdentityId),
            );
            const unitScopes = geelyLikeCommercialDocumentExtractionFixture.scopes.flatMap(
              (scope) => {
                if (scope.scopeType === 'GROUP') return [];
                const vehicleIdentityIds = scope.selector.vehicleIdentityIds?.filter((id) =>
                  selectedVehicleIds.has(id),
                );
                if (scope.scopeType === 'VEHICLE' && !vehicleIdentityIds?.length) return [];
                return [
                  {
                    ...structuredClone(scope),
                    selector: {
                      ...scope.selector,
                      ...(scope.selector.vehicleIdentityIds ? { vehicleIdentityIds } : {}),
                    },
                    exclusions: {
                      ...scope.exclusions,
                      ...(scope.exclusions.vehicleIdentityIds
                        ? {
                            vehicleIdentityIds: scope.exclusions.vehicleIdentityIds.filter((id) =>
                              selectedVehicleIds.has(id),
                            ),
                          }
                        : {}),
                    },
                  },
                ];
              },
            );
            const unitScopeIds = new Set(unitScopes.map((scope) => scope.scopeId));
            const unitArtifact = {
              ...structuredClone(geelyLikeCommercialDocumentExtractionFixture),
              vehicleIdentities:
                geelyLikeCommercialDocumentExtractionFixture.vehicleIdentities.filter((item) =>
                  selectedVehicleIds.has(item.vehicleIdentityId),
                ),
              ...(calls === 2
                ? {
                    scopes: unitScopes,
                    facts: geelyLikeCommercialDocumentExtractionFixture.facts.flatMap((fact) => {
                      const scopeIds = fact.scopeIds.filter((id) => unitScopeIds.has(id));
                      return scopeIds.length ? [{ ...structuredClone(fact), scopeIds }] : [];
                    }),
                    composition: { groups: [], relationships: [] },
                  }
                : { facts: [], scopes: [], composition: { groups: [], relationships: [] } }),
              coverage: {
                status: 'complete' as const,
                expectedUnitCount: 0,
                completedUnitCount: 0,
                expectedVehicleCount: selectedVehicleIds.size,
                extractedVehicleCount: 0,
                expectedFamilies: selectedVehicleIds.size ? ['Linha Aurora'] : [],
                extractedFamilies: selectedVehicleIds.size ? ['Linha Aurora'] : [],
                units: [
                  {
                    unitId: `unit-fake-${calls - 1}`,
                    status: 'complete' as const,
                    sourceBlockIds: ['block-heading'],
                    expectedItemCount: selectedVehicleIds.size,
                    extractedItemCount: selectedVehicleIds.size,
                  },
                ],
                gaps: [],
                incompleteBlockIds: [],
                unresolvedTableRows: [],
                unresolvedScopeIds: [],
              },
            };
            return {
              output:
                calls === 1
                  ? documentMapTransportMissingSectionBackReference()
                  : extractionTransport(unitArtifact),
              providerRunId: `fake-${calls}`,
              usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
            };
          },
          async close() {
            closes += 1;
          },
        };
      },
    };
    const artifacts = store();
    const input = {
      batch,
      jobId: '20',
      attempt: 1,
      correlationId: '00000000-0000-4000-8000-000000000001',
      source: {
        documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
      },
      provider,
      artifacts,
    };
    const first = await executeSegmentedImportRuntime(input);
    const firstCalls = calls;
    expect(first.payloads).toHaveLength(4);
    expect(first.summary.unitCount).toBe(6);
    expect(calls).toBe(7);
    expect(requests[0]?.metadata.schemaVersion).toBe('CommercialDocumentMap/1');
    expect(requests[0]?.metadata.promptVersion).toBe('5');
    expect(requests[0]?.instructions).toContain(
      'Always emit every required collection from the schema',
    );
    expect(requests[0]?.instructions).toContain(
      'always emit titleHints, issuerHints, competenceHints and validityHints',
    );
    expect(requests[0]?.instructions).toContain(
      'Return [] for a hint collection when no supported candidate exists',
    );
    expect(requests[0]?.instructions).toContain('never omit a required collection');
    expect(requests[0]?.instructions).toContain(
      'never omit a required collection or invent an entry merely to avoid an empty collection',
    );
    expect(requests[0]?.instructions).toContain(
      'Every table.headerBlockIds must contain at least one real',
    );
    expect(requests[0]?.instructions).toContain(
      'Every local reference must resolve to a real object emitted in the same map',
    );
    expect(requests[0]?.instructions).toContain(
      'every referenced local ID must have a corresponding definition in the same artifact',
    );
    expect(requests[0]?.instructions).toContain(
      'metadata hint sourceBlockIds, page refs, section refs, table refs, note refs',
    );
    expect(requests[0]?.instructions).toContain(
      'Keep IDs model-local; do not rewrite them to canonical server IDs',
    );
    expect(requests[0]?.instructions).toContain(
      'if no source block is identifiable, omit the hint instead of inventing an ID',
    );
    expect(requests[0]?.schema).toBe(openAITransportDocumentMapSchema);
    expect(
      requests
        .slice(1)
        .every((request) => request.schema === openAITransportDocumentExtractionSchema),
    ).toBe(true);
    expect(requests.slice(1).every((request) => request.metadata.promptVersion === '10')).toBe(
      true,
    );
    expect(requests[1]?.instructions).toContain(
      'A row cell is keyed by columnId, not by its array position',
    );
    expect(requests[1]?.instructions).toContain(
      'For a visually blank cell, omit that cell while keeping every other cell',
    );
    expect(requests[1]?.instructions).toContain(
      'Never replace a blank with whitespace, "-", "N/A", "unknown"',
    );
    expect(requests[1]?.instructions).toContain(
      'literal visible text or symbols may be emitted only when the source displays them',
    );
    expect(requests[1]?.instructions).toContain('never copy a merged, repeated or inherited value');
    expect(requests[1]?.instructions).toContain('report a genuine coverage gap/unresolved row');
    expect(requests[1]?.instructions).toContain(
      'Use complete only when every coverage unit is complete',
    );
    expect(requests[1]?.instructions).toContain(
      'gaps, incompleteBlockIds, unresolvedTableRows and unresolvedScopeIds are all empty',
    );
    expect(requests[1]?.instructions).toContain('never use optimistic complete');
    expect(requests[1]?.instructions).toContain('Use partial for known missing or incomplete');
    expect(requests[1]?.instructions).toContain('Use ambiguous when unresolved interpretation');
    expect(requests[1]?.instructions).toContain(
      'Never emit a composition relationship with an empty factIds array',
    );
    expect(requests[1]?.instructions).toContain('groupIds never substitute for the required fact');
    expect(requests[1]?.instructions).toContain(
      'Interpret section and channel before classifying any value',
    );
    expect(requests[1]?.instructions).toContain('A documentary "de X por Y" emits both facts');
    expect(requests[1]?.instructions).toContain(
      'A value explicitly labeled PREÇO CLIENTE is promotional_price',
    );
    expect(requests[1]?.instructions).toContain('Preserve AND/OR literally');
    expect(requests[1]?.instructions).toContain('productionYear and modelYear form an atomic pair');
    expect(requests[1]?.instructions).toContain(
      'If only one side is known, omit both structured fields',
    );
    expect(requests[1]?.instructions).toContain(
      'PY/MY may be inherited from a table or section header',
    );
    expect(requests.slice(1).map((request) => request.metadata.unitOrdinal)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(new Set(requests.slice(1).map((request) => request.metadata.unitId)).size).toBe(6);
    expect(first.summary.usage).toEqual({ inputUnits: 7, outputUnits: 7, totalUnits: 14 });
    expect(opens).toBe(1);
    expect(closes).toBe(1);
    expect(artifacts.values.map((item) => item.manifest.stage)).toEqual([
      'document_map',
      'unit_plan',
      ...Array.from({ length: first.summary.unitCount }, () => 'unit_extraction'),
      'merge',
      'semantic_reconciliation',
      'domain_mapping',
    ]);
    const mapManifest = artifacts.values.find(
      (item) => item.manifest.stage === 'document_map',
    )!.manifest;
    const mapBody = artifacts.values.find((item) => item.manifest.stage === 'document_map')!
      .body as typeof geelyLikeCommercialDocumentMapFixture;
    expect(mapBody.documents[0]?.documentId).toBe('document-0001');
    expect(mapBody.pages[0]?.pageId).toBe('page-0001');
    expect(mapBody.contentBlocks[0]?.contentBlockId).toBe('block-0001');
    expect(mapBody.pages[0]?.sectionIds).toContain('section-0001');
    const planManifest = artifacts.values.find(
      (item) => item.manifest.stage === 'unit_plan',
    )!.manifest;
    const units = artifacts.values.filter((item) => item.manifest.stage === 'unit_extraction');
    units.forEach((item) => {
      const artifact = item.body as any;
      expect(artifact.coverage.expectedUnitCount).toBe(artifact.coverage.units.length);
      expect(artifact.coverage.completedUnitCount).toBe(
        artifact.coverage.units.filter((unit: { status: string }) => unit.status === 'complete')
          .length,
      );
      expect(artifact.coverage.extractedVehicleCount).toBe(artifact.vehicleIdentities.length);
    });
    expect(new Set(units.map((item) => item.manifest.content.sha256)).size).toBe(6);
    const merge = artifacts.values.find((item) => item.manifest.stage === 'merge')!.manifest;
    const mergeBody = artifacts.values.find((item) => item.manifest.stage === 'merge')!.body as any;
    const semantic = artifacts.values.find(
      (item) => item.manifest.stage === 'semantic_reconciliation',
    )!.manifest;
    const semanticBody = artifacts.values.find(
      (item) => item.manifest.stage === 'semantic_reconciliation',
    )!.body as any;
    const domain = artifacts.values.find(
      (item) => item.manifest.stage === 'domain_mapping',
    )!.manifest;
    expect(planManifest.sourceArtifactIds).toEqual([mapManifest.artifactId]);
    units.forEach((item) =>
      expect(item.manifest.sourceArtifactIds).toEqual([planManifest.artifactId]),
    );
    expect(merge.sourceArtifactIds).toEqual(units.map((item) => item.manifest.artifactId));
    expect(semantic.sourceArtifactIds).toEqual([merge.artifactId]);
    expect(domain.sourceArtifactIds).toEqual([semantic.artifactId]);
    expect(mergeBody.documents[0].competenceCandidates[0].value).toBe('2026-08');
    expect(semanticBody.documents[0].validityCandidates[0]).toMatchObject({
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
    });
    const rows = first.payloads as Record<string, any>[];
    expect(new Set(rows.map((row) => JSON.stringify(row.mmv))).size).toBe(4);
    expect(rows.every((row) => row.mmv.productionYear.value === '2025')).toBe(true);
    expect(rows.every((row) => row.mmv.modelYear.value === '2026')).toBe(true);
    expect(rows.every((row) => row.commercialPeriod.competence === '2026-08')).toBe(true);
    for (const row of rows) {
      const policyIds = new Set(
        row.policies.map((policy: { clientPolicyId: string }) => policy.clientPolicyId),
      );
      for (const offer of row.offers as { policyClientIds: string[] }[])
        expect(offer.policyClientIds.every((id) => policyIds.has(id))).toBe(true);
    }
    const mapOnly = await executeSegmentedImportRuntime({
      ...input,
      stopAfter: 'document_map',
    });
    expect(mapOnly.payloads).toEqual([]);
    expect(mapOnly.documentMap).toEqual(mapBody);
    expect(mapOnly.documentary).toBeUndefined();
    expect(mapOnly.summary.unitCount).toBe(0);
    expect(mapOnly.summary.artifacts.map((artifact) => artifact.stage)).toEqual(['document_map']);
    expect(calls).toBe(firstCalls);
    const documentary = await executeSegmentedImportRuntime({
      ...input,
      stopAfter: 'semantic_reconciliation',
    });
    expect(documentary.payloads).toEqual([]);
    expect(documentary.documentary?.documentMap).toEqual(mapBody);
    expect(documentary.documentary?.unitExtractions).toHaveLength(first.summary.unitCount);
    expect(documentary.documentary?.reconciliation).toEqual(mergeBody);
    expect(documentary.documentary?.semanticReconciliation).toEqual(semanticBody);
    expect(documentary.summary.artifacts.map((artifact) => artifact.stage)).not.toContain(
      'domain_mapping',
    );
    expect(calls).toBe(firstCalls);
    const replay = await executeSegmentedImportRuntime(input);
    expect(replay.payloads).toEqual(first.payloads);
    expect(calls).toBe(firstCalls);
    expect(opens).toBe(1);
    expect(replay.summary.reusedArtifactCount).toBe(5 + first.summary.unitCount);

    const finalize = vi.fn(async (value: { readonly rows: readonly unknown[] }) => ({
      jobId: '20',
      rowCount: value.rows.length,
      idempotentReplay: false,
    }));
    const matching = vi.fn(async (inputs: readonly unknown[]) => inputs.map(() => []));
    const oneShotExtract = vi.fn(async () => {
      throw new Error('ONE_SHOT_MUST_NOT_RUN');
    });
    const processed = await processAdminImportBatch('10', {
      extractionMode: 'segmented',
      repository: { getBatch: vi.fn(async () => batch) } as any,
      processingRepository: {
        enqueue: vi.fn(async () => ({ jobId: '20', attempt: 1, idempotentReplay: false })),
        claim: vi.fn(async () => ({ jobId: '20', lockVersion: 1, idempotentReplay: false })),
        downloadDocument: vi.fn(async () => new Uint8Array([1])),
        findMatchCandidatesBatch: matching,
        finalize,
        fail: vi.fn(async () => undefined),
      } as any,
      extractionProvider: { key: 'fake', version: '1', extract: oneShotExtract },
      structuredExtractionProvider: provider,
      segmentedArtifactStore: artifacts,
      authorize: async () => ({ actorId: 'a0000000-0000-4000-8000-000000000001' }),
      createCorrelationId: () => '00000000-0000-4000-8000-000000000001',
    });
    expect(processed.rowCount).toBe(4);
    expect(matching).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ rows: expect.arrayContaining([expect.any(Object)]) }),
    );
    expect(oneShotExtract).not.toHaveBeenCalled();
  });

  it('rejects missing structured provider configuration before authorization or job creation', async () => {
    vi.stubEnv('IMPORT_EXTRACTION_PROVIDER', '');
    const authorize = vi.fn(async () => ({ actorId: 'unused' }));
    const enqueue = vi.fn();
    try {
      await expect(
        processAdminImportBatch('10', {
          extractionMode: 'segmented',
          authorize,
          processingRepository: { enqueue } as any,
        }),
      ).rejects.toThrow('SEGMENTED_STRUCTURED_PROVIDER_NOT_CONFIGURED');
      expect(authorize).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('closes the source session after Document Map response failure without publishing artifacts', async () => {
    const close = vi.fn(async () => undefined);
    const publish = vi.fn();
    const failingProvider: StructuredExtractionProvider = {
      openSource: vi.fn(async () => ({
        extractStructured: vi.fn(async () => {
          throw new Error('PROVIDER_REQUEST_INVALID');
        }),
        close,
      })),
    };
    await expect(
      executeSegmentedImportRuntime({
        batch: batch as any,
        jobId: 'diagnostic-job',
        attempt: 3,
        correlationId: '00000000-0000-4000-8000-000000000003',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider: failingProvider,
        artifacts: {
          load: vi.fn(async () => undefined),
          publish,
        },
      }),
    ).rejects.toThrow('PROVIDER_REQUEST_INVALID');
    expect(close).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('emits opt-in structural Document Map diagnostics without persisting or exposing output', async () => {
    const secret = 'commercial-value-must-not-escape';
    const observeDocumentMapValidation = vi.fn();
    const publish = vi.fn();
    const close = vi.fn(async () => undefined);
    const invalidProvider: StructuredExtractionProvider = {
      openSource: vi.fn(async () => ({
        extractStructured: vi.fn(async () => ({
          output: { ...documentMapTransport(), [secret]: secret },
          providerRunId: 'provider-run-safe',
          usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
        })),
        close,
      })),
    };
    await expect(
      executeSegmentedImportRuntime({
        batch: batch as any,
        jobId: 'diagnostic-job',
        attempt: 5,
        correlationId: '00000000-0000-4000-8000-000000000005',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider: invalidProvider,
        artifacts: { load: vi.fn(async () => undefined), publish },
        diagnostics: true,
        observeDocumentMapValidation,
      }),
    ).rejects.toMatchObject({ code: 'COMMERCIAL_DOCUMENT_MAP_INVALID' });
    expect(observeDocumentMapValidation).toHaveBeenCalledWith({
      totalViolations: 1,
      sampledViolations: [{ path: '/', keyword: 'additionalProperties', category: 'schema' }],
      truncated: false,
      categories: { additionalProperties: 1 },
      broadCategories: { schema: 1, referential: 0, semantic: 0, invariant: 0 },
    });
    expect(JSON.stringify(observeDocumentMapValidation.mock.calls)).not.toContain(secret);
    expect(publish).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('identifies missing static Document Map properties in safe transport diagnostics', async () => {
    const invalidMap = documentMapTransport();
    const document = invalidMap.documents[0] as unknown as Record<string, unknown>;
    delete document.competenceHints;
    delete document.validityHints;
    const observeDocumentMapValidation = vi.fn();
    const publish = vi.fn();
    const close = vi.fn(async () => undefined);
    const invalidProvider: StructuredExtractionProvider = {
      openSource: vi.fn(async () => ({
        extractStructured: vi.fn(async () => ({
          output: invalidMap,
          providerRunId: 'provider-run-required-diagnostic',
          usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
        })),
        close,
      })),
    };

    await expect(
      executeSegmentedImportRuntime({
        batch: batch as any,
        jobId: 'required-diagnostic-job',
        attempt: 11,
        correlationId: '00000000-0000-4000-8000-000000000011',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider: invalidProvider,
        artifacts: { load: vi.fn(async () => undefined), publish },
        diagnostics: true,
        observeDocumentMapValidation,
      }),
    ).rejects.toMatchObject({ code: 'COMMERCIAL_DOCUMENT_MAP_INVALID' });
    expect(observeDocumentMapValidation).toHaveBeenCalledWith({
      totalViolations: 2,
      sampledViolations: [
        {
          path: '/documents/0',
          keyword: 'required',
          category: 'schema',
          missingProperty: 'competenceHints',
        },
        {
          path: '/documents/0',
          keyword: 'required',
          category: 'schema',
          missingProperty: 'validityHints',
        },
      ],
      truncated: false,
      categories: { required: 2 },
      broadCategories: { schema: 2, referential: 0, semantic: 0, invariant: 0 },
    });
    expect(publish).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('emits safe opt-in Document Map canonicalization diagnostics for dangling metadata refs', async () => {
    const secret = 'raw-metadata-block-must-not-escape';
    const invalidMap = documentMapTransport();
    (
      invalidMap.documents[0]!.titleHints[0] as unknown as {
        sourceBlockIds: string[];
      }
    ).sourceBlockIds = [secret];
    const observeDocumentMapCanonicalization = vi.fn();
    const observeDocumentMapMetadataReferences = vi.fn();
    const publish = vi.fn();
    const close = vi.fn(async () => undefined);
    const invalidProvider: StructuredExtractionProvider = {
      openSource: vi.fn(async () => ({
        extractStructured: vi.fn(async () => ({
          output: invalidMap,
          providerRunId: 'provider-run-dangling-metadata',
          usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
        })),
        close,
      })),
    };

    await expect(
      executeSegmentedImportRuntime({
        batch: batch as any,
        jobId: 'canonicalization-diagnostic-job',
        attempt: 10,
        correlationId: '00000000-0000-4000-8000-000000000010',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider: invalidProvider,
        artifacts: { load: vi.fn(async () => undefined), publish },
        diagnostics: true,
        observeDocumentMapCanonicalization,
        observeDocumentMapMetadataReferences,
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED' });
    expect(observeDocumentMapCanonicalization).toHaveBeenCalledWith({
      totalViolations: 1,
      categories: { unknown_reference: 1 },
      sampledViolations: [
        {
          path: '/documents/0/titleHints/0/sourceBlockIds/0',
          kind: 'block',
          category: 'unknown_reference',
        },
      ],
      truncated: false,
    });
    expect(JSON.stringify(observeDocumentMapCanonicalization.mock.calls)).not.toContain(secret);
    expect(observeDocumentMapMetadataReferences).toHaveBeenCalledTimes(3);
    const metadataAudits = observeDocumentMapMetadataReferences.mock.calls.map(
      ([observation]) => observation,
    );
    expect(metadataAudits.map((observation) => observation.stage)).toEqual([
      'raw_structured_output',
      'reconstructed',
      'pre_canonicalization',
    ]);
    for (const observation of metadataAudits) {
      expect(observation.definitionCounts.contentBlocks).toBe(invalidMap.contentBlocks.length);
      expect(observation.orphanCount).toBe(1);
      expect(observation.collections.titleHints).toMatchObject({
        hintCount: 1,
        referenceCount: 1,
        orphanCount: 1,
        hints: [
          {
            documentIndex: 0,
            hintIndex: 0,
            sourceBlockCount: 1,
            references: [
              {
                path: '/documents/0/titleHints/0/sourceBlockIds/0',
                definitionExists: false,
              },
            ],
          },
        ],
      });
    }
    expect(JSON.stringify(metadataAudits)).not.toContain(secret);
    expect(publish).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each(['titleHints', 'issuerHints', 'competenceHints', 'validityHints'] as const)(
    'preflights orphan metadata references in %s without filtering them',
    (collection) => {
      const map = documentMapTransport();
      const orphan = `orphan-${collection}`;
      (
        map.documents[0] as unknown as Record<
          typeof collection,
          Array<{ value: string; sourceBlockIds: string[] }>
        >
      )[collection] = [{ value: 'not observed', sourceBlockIds: [orphan] }];
      const audit = auditDocumentMapMetadataReferences(map, 'raw_structured_output');
      expect(audit.orphanCount).toBe(1);
      expect(audit.collections[collection]).toMatchObject({
        hintCount: 1,
        referenceCount: 1,
        orphanCount: 1,
        hints: [
          {
            documentIndex: 0,
            hintIndex: 0,
            sourceBlockCount: 1,
            references: [expect.objectContaining({ definitionExists: false })],
          },
        ],
      });
      expect(JSON.stringify(audit)).not.toContain(orphan);
      expect(
        (map.documents[0] as unknown as Record<typeof collection, unknown>)[collection],
      ).toEqual([{ value: 'not observed', sourceBlockIds: [orphan] }]);
    },
  );

  it('rejects empty table headers at the raw Document Map transport boundary', async () => {
    const invalidMap = documentMapTransport();
    (invalidMap.tables[0] as unknown as { headerBlockIds: string[] }).headerBlockIds = [];
    const observeDocumentMapValidation = vi.fn();
    const publish = vi.fn();
    const close = vi.fn(async () => undefined);
    const invalidProvider: StructuredExtractionProvider = {
      openSource: vi.fn(async () => ({
        extractStructured: vi.fn(async () => ({
          output: invalidMap,
          providerRunId: 'provider-run-min-items',
          usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
        })),
        close,
      })),
    };

    await expect(
      executeSegmentedImportRuntime({
        batch: batch as any,
        jobId: 'min-items-job',
        attempt: 9,
        correlationId: '00000000-0000-4000-8000-000000000009',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider: invalidProvider,
        artifacts: { load: vi.fn(async () => undefined), publish },
        diagnostics: true,
        observeDocumentMapValidation,
      }),
    ).rejects.toMatchObject({ code: 'COMMERCIAL_DOCUMENT_MAP_INVALID' });
    expect(observeDocumentMapValidation).toHaveBeenCalledWith({
      totalViolations: 1,
      sampledViolations: [
        { path: '/tables/0/headerBlockIds', keyword: 'minItems', category: 'schema' },
      ],
      truncated: false,
      categories: { minItems: 1 },
      broadCategories: { schema: 1, referential: 0, semantic: 0, invariant: 0 },
    });
    expect(publish).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('routes safe Unit Extraction diagnostics without persisting unit output', async () => {
    const secret = 'unit-commercial-value-must-not-escape';
    const observeUnitExtractionValidation = vi.fn();
    let calls = 0;
    const provider: StructuredExtractionProvider = {
      async openSource() {
        return {
          async extractStructured(request) {
            calls += 1;
            if (calls === 1)
              return {
                output: documentMapTransport(),
                providerRunId: 'map-run',
                usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
              };
            if (calls === 2)
              return {
                output: { schemaVersion: secret },
                providerRunId: 'unit-invalid-run',
                usage: { inputUnits: 3, outputUnits: 4, totalUnits: 7 },
              };
            return new Promise((_resolve, reject) =>
              request.signal.addEventListener(
                'abort',
                () =>
                  reject(Object.assign(new Error('provider abort'), { code: 'PROVIDER_TIMEOUT' })),
                { once: true },
              ),
            );
          },
          async close() {},
        };
      },
    };
    const artifacts = store();
    await expect(
      executeSegmentedImportRuntime({
        batch,
        jobId: 'unit-diagnostic-job',
        attempt: 7,
        correlationId: '00000000-0000-4000-8000-000000000007',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider,
        artifacts,
        diagnostics: true,
        observeUnitExtractionValidation,
      }),
    ).rejects.toThrow('UNIT_EXTRACTION_INVALID_STRUCTURED_OUTPUT');
    expect(observeUnitExtractionValidation).toHaveBeenCalledWith(
      expect.objectContaining({
        unitOrdinal: 1,
        phase: 'transport_validation',
        totalViolations: expect.any(Number),
        truncated: expect.any(Boolean),
      }),
    );
    expect(JSON.stringify(observeUnitExtractionValidation.mock.calls)).not.toContain(secret);
    expect(artifacts.values.map((item) => item.manifest.stage)).toEqual([
      'document_map',
      'unit_plan',
    ]);
  });

  it('routes static COMPLETE blocker reasons without exposing coverage values', async () => {
    const secretGapMessage = 'private gap message with commercial value 987654';
    const original = geelyLikeCommercialDocumentExtractionFixture;
    const invalidComplete = {
      ...structuredClone(original),
      coverage: {
        ...structuredClone(original.coverage),
        gaps: [
          {
            gapId: 'gap-runtime-observed',
            gapType: 'OTHER' as const,
            message: secretGapMessage,
            unitId: original.coverage.units[0]!.unitId,
          },
        ],
      },
    };
    const observeUnitExtractionValidation = vi.fn();
    let calls = 0;
    const provider: StructuredExtractionProvider = {
      async openSource() {
        return {
          async extractStructured(request) {
            calls += 1;
            if (calls === 1)
              return {
                output: documentMapTransport(),
                providerRunId: 'map-run',
                usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
              };
            if (calls === 2)
              return {
                output: extractionTransport(invalidComplete),
                providerRunId: 'unit-incomplete-complete-run',
                usage: { inputUnits: 3, outputUnits: 4, totalUnits: 7 },
              };
            return new Promise((_resolve, reject) =>
              request.signal.addEventListener('abort', () => reject(new Error('sibling aborted')), {
                once: true,
              }),
            );
          },
          async close() {},
        };
      },
    };
    const artifacts = store();

    await expect(
      executeSegmentedImportRuntime({
        batch,
        jobId: 'coverage-reason-diagnostic-job',
        attempt: 12,
        correlationId: '00000000-0000-4000-8000-000000000012',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider,
        artifacts,
        diagnostics: true,
        observeUnitExtractionValidation,
      }),
    ).rejects.toThrow('UNIT_EXTRACTION_CANONICAL_VALIDATION_FAILED');
    expect(observeUnitExtractionValidation).toHaveBeenCalledWith(
      expect.objectContaining({
        unitOrdinal: 1,
        phase: 'canonical_validation',
        totalViolations: 1,
        categories: { incompleteDataMarkedComplete: 1 },
        sampledViolations: [
          {
            path: '/coverage/status',
            keyword: 'incompleteDataMarkedComplete',
            category: 'semantic',
            reasons: ['GAPS_PRESENT'],
          },
        ],
        truncated: false,
      }),
    );
    expect(JSON.stringify(observeUnitExtractionValidation.mock.calls)).not.toContain(
      secretGapMessage,
    );
    expect(artifacts.values.map((item) => item.manifest.stage)).toEqual([
      'document_map',
      'unit_plan',
    ]);
  });

  it('reports a causal canonical failure instead of an earlier sibling abort', async () => {
    let calls = 0;
    const dangling = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const danglingEvidence = dangling.documents[0]!.competenceCandidates[0]!.evidence as {
      blockIds: string[];
    };
    danglingEvidence.blockIds = ['block-source-without-extraction-block'];
    const provider: StructuredExtractionProvider = {
      async openSource() {
        return {
          async extractStructured(request) {
            calls += 1;
            if (calls === 1)
              return {
                output: documentMapTransport(),
                providerRunId: 'map-run',
                usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
              };
            if (calls === 2)
              return new Promise((_resolve, reject) =>
                request.signal.addEventListener(
                  'abort',
                  () => reject(new Error('sibling aborted')),
                  { once: true },
                ),
              );
            return {
              output: extractionTransport(dangling),
              providerRunId: 'unit-causal-run',
              usage: { inputUnits: 3, outputUnits: 4, totalUnits: 7 },
            };
          },
          async close() {},
        };
      },
    };
    const artifacts = store();

    await expect(
      executeSegmentedImportRuntime({
        batch,
        jobId: 'causal-failure-job',
        attempt: 8,
        correlationId: '00000000-0000-4000-8000-000000000008',
        source: {
          documents: [{ documentId: 'document-main', ordinal: 1, bytes: new Uint8Array([1]) }],
        },
        provider,
        artifacts,
      }),
    ).rejects.toThrow('UNIT_EXTRACTION_CANONICAL_VALIDATION_FAILED');
    expect(artifacts.values.map((item) => item.manifest.stage)).toEqual([
      'document_map',
      'unit_plan',
    ]);
  });
});
