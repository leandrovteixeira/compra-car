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
import { validateCommercialDocumentExtraction } from '../../../packages/core/src/import/commercial-document-extraction-validator';

import {
  executeSegmentedImportRuntime,
  type SegmentedRuntimeArtifact,
  type SegmentedRuntimeArtifactStore,
} from '../src/server/segmented-import-runtime';
import { processAdminImportBatch } from '../src/server/import-engine-service';

const batch = {
  id: '10',
  title: 'Geely local fake',
  pluginKey: 'commercial_letters' as const,
  competence: '2026-08',
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
                expectedUnitCount: 1,
                completedUnitCount: 1,
                expectedVehicleCount: selectedVehicleIds.size,
                extractedVehicleCount: selectedVehicleIds.size,
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
            if (calls > 1) validateCommercialDocumentExtraction(unitArtifact);
            return {
              output: calls === 1 ? geelyLikeCommercialDocumentMapFixture : unitArtifact,
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
    const planManifest = artifacts.values.find(
      (item) => item.manifest.stage === 'unit_plan',
    )!.manifest;
    const units = artifacts.values.filter((item) => item.manifest.stage === 'unit_extraction');
    expect(new Set(units.map((item) => item.manifest.content.sha256)).size).toBe(6);
    const merge = artifacts.values.find((item) => item.manifest.stage === 'merge')!.manifest;
    const semantic = artifacts.values.find(
      (item) => item.manifest.stage === 'semantic_reconciliation',
    )!.manifest;
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
    const rows = first.payloads as Record<string, any>[];
    expect(new Set(rows.map((row) => JSON.stringify(row.mmv))).size).toBe(4);
    expect(rows.every((row) => row.mmv.productionYear.value === '2025')).toBe(true);
    expect(rows.every((row) => row.mmv.modelYear.value === '2026')).toBe(true);
    for (const row of rows) {
      const policyIds = new Set(
        row.policies.map((policy: { clientPolicyId: string }) => policy.clientPolicyId),
      );
      for (const offer of row.offers as { policyClientIds: string[] }[])
        expect(offer.policyClientIds.every((id) => policyIds.has(id))).toBe(true);
    }
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
});
