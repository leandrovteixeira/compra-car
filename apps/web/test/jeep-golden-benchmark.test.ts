import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

import type {
  CommercialDocumentMapV1,
  ImportBatchDetails,
  SegmentedArtifactManifest,
} from '@compra-car/core';
import {
  canonicalizeSegmentedArtifactBody,
  hashSegmentedArtifactBytes,
} from '@compra-car/core/segmented-artifact-lifecycle';
import {
  formatCommercialDocumentGoldenBenchmark,
  runCommercialDocumentGoldenBenchmark,
} from '@compra-car/core/commercial-document-golden-benchmark';
import {
  CommercialExtractionUnitContextLimitError,
  createCommercialExtractionUnitPlan,
} from '@compra-car/core/commercial-document-map-planner';
import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_LETTER_GOLDEN_FACTS,
  COMMERCIAL_LETTER_GOLDEN_OFFERS,
} from '../../../packages/core/test/fixtures/commercial-letter-golden-dataset';
import { createConfiguredStructuredExtractionProvider } from '../src/server/structured-extraction-provider';
import {
  executeSegmentedImportRuntime,
  type SegmentedDocumentMapMetadataAuditObservation,
  type SegmentedExtractionUnitYearDiagnosticObservation,
  type SegmentedExtractionUnitValidationObservation,
  type SegmentedRuntimeArtifact,
  type SegmentedRuntimeArtifactStore,
} from '../src/server/segmented-import-runtime';

const JEEP_DOCUMENT = 'Jeep 202606-01.pdf';
const enabled = process.env.RUN_JEEP_GOLDEN_BENCHMARK === '1';
const documentMapOnly = process.env.JEEP_GOLDEN_DOCUMENT_MAP_ONLY === '1';
const savedMapResultPath = process.env.JEEP_GOLDEN_MAP_RESULT_PATH;
const savedMapDiagnosticPath = process.env.JEEP_GOLDEN_PLAN_DIAGNOSTIC_PATH;

interface JeepGoldenBenchmarkConfig {
  readonly pdfPath: string;
  readonly outputPath: string;
  readonly provider: 'openai';
  readonly model: string;
}

type HarnessEnvironment = Readonly<Record<string, string | undefined>>;

export function isJeepGoldenBenchmarkEnabled(env: HarnessEnvironment): boolean {
  return env.RUN_JEEP_GOLDEN_BENCHMARK === '1';
}

export function readJeepGoldenBenchmarkConfig(env: HarnessEnvironment): JeepGoldenBenchmarkConfig {
  if (env.IMPORT_EXTRACTION_PROVIDER !== 'openai')
    throw new Error('JEEP_BENCHMARK_PROVIDER_INVALID');
  if (!env.OPENAI_API_KEY?.trim()) throw new Error('JEEP_BENCHMARK_OPENAI_KEY_MISSING');
  if (!env.OPENAI_IMPORT_MODEL?.trim()) throw new Error('JEEP_BENCHMARK_MODEL_MISSING');
  if (!env.JEEP_GOLDEN_PDF_PATH?.trim()) throw new Error('JEEP_BENCHMARK_PDF_PATH_MISSING');
  if (basename(env.JEEP_GOLDEN_PDF_PATH) !== JEEP_DOCUMENT)
    throw new Error('JEEP_BENCHMARK_PDF_INVALID');
  if (!env.JEEP_GOLDEN_OUTPUT_PATH?.trim()) throw new Error('JEEP_BENCHMARK_OUTPUT_PATH_MISSING');
  return {
    pdfPath: resolve(env.JEEP_GOLDEN_PDF_PATH),
    outputPath: resolve(env.JEEP_GOLDEN_OUTPUT_PATH),
    provider: 'openai',
    model: env.OPENAI_IMPORT_MODEL,
  };
}

const inMemoryStore = (): SegmentedRuntimeArtifactStore & {
  readonly values: SegmentedRuntimeArtifact[];
} => {
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
      const id = `local-artifact-${values.length + 1}`;
      const bytes = canonicalizeSegmentedArtifactBody(input.body);
      const sha256 = await hashSegmentedArtifactBytes(bytes);
      const now = new Date().toISOString();
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
        sourceArtifactIds: input.sourceArtifacts.map((artifact) => artifact.artifactId),
        content: { sha256, byteLength: bytes.byteLength, canonicalization: 'canonical-json/1' },
        storage: { bucket: 'import-processing-artifacts', objectPath: `local/${id}.json` },
        ...(input.provider ? { provider: input.provider } : {}),
        createdAt: now,
        startedAt: now,
        completedAt: now,
      } satisfies SegmentedArtifactManifest;
      const artifact = { manifest, body: input.body };
      values.push(artifact);
      return artifact;
    },
  };
};

const localBatch = (bytes: Uint8Array): ImportBatchDetails => {
  const now = new Date().toISOString();
  const hash = createHash('sha256').update(bytes).digest('hex');
  return {
    id: 'local-jeep-golden',
    title: 'Jeep documentary golden benchmark',
    pluginKey: 'commercial_letters',
    competence: '2026-06',
    notes: 'Local read-only benchmark; no staging or commercial persistence.',
    status: 'extracting',
    documentCount: 1,
    mmvCount: 0,
    createdByName: null,
    createdAt: now,
    updatedAt: now,
    lockVersion: 1,
    documents: [
      {
        id: 'document-jeep',
        batchId: 'local-jeep-golden',
        documentType: 'pdf',
        originalFileName: JEEP_DOCUMENT,
        storageBucket: 'local-memory-only',
        storageObjectPath: 'not-persisted',
        mimeType: 'application/pdf',
        fileSizeBytes: bytes.byteLength,
        contentSha256: hash,
        pageCount: null,
        status: 'processing',
        sourceOrder: 1,
        documentRole: 'primary',
        errorCode: null,
        errorMessage: null,
        lockVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
};

type JeepBenchmarkFailureStage =
  | 'document_map'
  | 'unit_plan'
  | 'unit_extraction'
  | 'merge'
  | 'semantic_reconciliation'
  | 'runtime';

export function classifyJeepBenchmarkFailureStage(error: unknown): JeepBenchmarkFailureStage {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toUpperCase().replace(/[\s-]+/gu, '_');
  if (normalized.startsWith('COMMERCIAL_EXTRACTION_UNIT_')) return 'unit_plan';
  if (normalized.includes('DOCUMENT_MAP')) return 'document_map';
  if (normalized.includes('UNIT_EXTRACTION') || normalized.includes('SEGMENTED_EXTRACTION'))
    return 'unit_extraction';
  if (normalized.includes('SEMANTIC')) return 'semantic_reconciliation';
  if (normalized.includes('RECONCILIATION') || normalized.includes('MERGE')) return 'merge';
  return 'runtime';
}

const observedUsage = (artifacts: readonly SegmentedRuntimeArtifact[]) =>
  artifacts.reduce(
    (usage, artifact) => ({
      inputUnits: usage.inputUnits + (artifact.manifest.provider?.inputUnits ?? 0),
      outputUnits: usage.outputUnits + (artifact.manifest.provider?.outputUnits ?? 0),
      totalUnits: usage.totalUnits + (artifact.manifest.provider?.totalUnits ?? 0),
    }),
    { inputUnits: 0, outputUnits: 0, totalUnits: 0 },
  );

describe('Jeep local documentary golden benchmark harness', () => {
  it('stays opt-in and validates only local/OpenAI inputs', () => {
    expect(isJeepGoldenBenchmarkEnabled({})).toBe(false);
    expect(isJeepGoldenBenchmarkEnabled({ RUN_JEEP_GOLDEN_BENCHMARK: '1' })).toBe(true);
    const config = readJeepGoldenBenchmarkConfig({
      RUN_JEEP_GOLDEN_BENCHMARK: '1',
      IMPORT_EXTRACTION_PROVIDER: 'openai',
      OPENAI_API_KEY: 'not-returned',
      OPENAI_IMPORT_MODEL: 'gpt-test',
      JEEP_GOLDEN_PDF_PATH: `C:/research/${JEEP_DOCUMENT}`,
      JEEP_GOLDEN_OUTPUT_PATH: 'C:/temp/jeep-result.json',
      SUPABASE_URL: 'must-not-be-read',
      SUPABASE_SERVER_KEY: 'must-not-be-read',
    });
    expect(config).toEqual({
      pdfPath: resolve(`C:/research/${JEEP_DOCUMENT}`),
      outputPath: resolve('C:/temp/jeep-result.json'),
      provider: 'openai',
      model: 'gpt-test',
    });
    expect(JSON.stringify(config)).not.toContain('not-returned');
    expect(JSON.stringify(config)).not.toContain('must-not-be-read');
    expect(JSON.stringify(config)).not.toContain('SUPABASE');
  });

  it.each([
    [{ IMPORT_EXTRACTION_PROVIDER: 'fake' }, 'JEEP_BENCHMARK_PROVIDER_INVALID'],
    [
      { IMPORT_EXTRACTION_PROVIDER: 'openai', OPENAI_API_KEY: '' },
      'JEEP_BENCHMARK_OPENAI_KEY_MISSING',
    ],
    [
      {
        IMPORT_EXTRACTION_PROVIDER: 'openai',
        OPENAI_API_KEY: 'key',
        OPENAI_IMPORT_MODEL: '',
      },
      'JEEP_BENCHMARK_MODEL_MISSING',
    ],
  ] as const)('fails closed for invalid configuration', (override, error) => {
    const environment = Object.assign(
      {
        IMPORT_EXTRACTION_PROVIDER: 'openai',
        OPENAI_API_KEY: 'key',
        OPENAI_IMPORT_MODEL: 'model',
        JEEP_GOLDEN_PDF_PATH: `C:/research/${JEEP_DOCUMENT}`,
        JEEP_GOLDEN_OUTPUT_PATH: 'C:/temp/result.json',
      },
      override,
    );
    expect(() => readJeepGoldenBenchmarkConfig(environment)).toThrow(error);
  });

  it('classifies planner context overflow at the Unit Plan boundary', () => {
    expect(
      classifyJeepBenchmarkFailureStage(
        new Error('COMMERCIAL_EXTRACTION_UNIT_CONTEXT_LIMIT_EXCEEDED'),
      ),
    ).toBe('unit_plan');
  });

  it('classifies Document Map canonicalization failures before Unit Plan', () => {
    expect(
      classifyJeepBenchmarkFailureStage(
        new Error('Document Map ID canonicalization failed (1 violation(s)).'),
      ),
    ).toBe('document_map');
  });
});

describe.skipIf(!enabled)('Jeep real read-only OpenAI golden benchmark', () => {
  it('stops after documentary reconciliation and writes only the requested local report', async () => {
    const config = readJeepGoldenBenchmarkConfig(process.env);
    const bytes = new Uint8Array(await readFile(config.pdfPath));
    expect(bytes.byteLength).toBeGreaterThan(0);
    const provider = createConfiguredStructuredExtractionProvider();
    const artifacts = inMemoryStore();
    const startedAt = Date.now();
    let documentMapCanonicalization: unknown;
    const metadataReferenceAudits: SegmentedDocumentMapMetadataAuditObservation[] = [];
    const unitExtractionValidations: SegmentedExtractionUnitValidationObservation[] = [];
    const unitExtractionYearDiagnostics: SegmentedExtractionUnitYearDiagnosticObservation[] = [];
    let runtime: Awaited<ReturnType<typeof executeSegmentedImportRuntime>>;
    try {
      runtime = await executeSegmentedImportRuntime({
        batch: localBatch(bytes),
        jobId: 'local-jeep-job',
        attempt: 1,
        correlationId: '00000000-0000-4000-8000-00000000010f',
        source: { documents: [{ documentId: 'document-jeep', ordinal: 1, bytes }] },
        provider,
        artifacts,
        stopAfter: documentMapOnly ? 'document_map' : 'semantic_reconciliation',
        diagnostics: true,
        observeDocumentMapCanonicalization: (observation) => {
          documentMapCanonicalization = observation;
        },
        observeDocumentMapMetadataReferences: (observation) => {
          metadataReferenceAudits.push(observation);
        },
        observeUnitExtractionValidation: (observation) => {
          unitExtractionValidations.push(observation);
        },
        observeUnitExtractionYears: (observation) => {
          unitExtractionYearDiagnostics.push(observation);
        },
      });
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const failure = {
        document: JEEP_DOCUMENT,
        provider: config.provider,
        model: config.model,
        elapsedMs,
        usage: observedUsage(artifacts.values),
        completedStages: artifacts.values.map(({ manifest }) => manifest.stage),
        failure: {
          stage: classifyJeepBenchmarkFailureStage(error),
          code: error instanceof Error ? error.message : String(error),
          ...(error instanceof CommercialExtractionUnitContextLimitError
            ? { diagnostic: error.diagnostic }
            : {}),
          ...(documentMapCanonicalization ? { documentMapCanonicalization } : {}),
          metadataReferenceAudits,
          unitExtractionValidations,
          unitExtractionYearDiagnostics,
        },
        status: 'FAIL',
      };
      await writeFile(config.outputPath, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
      console.info(
        'JEEP_GOLDEN_BENCHMARK',
        JSON.stringify({ ...failure, outputPath: config.outputPath }),
      );
      throw error;
    }
    const elapsedMs = Date.now() - startedAt;
    if (documentMapOnly) {
      expect(runtime.documentMap).toBeDefined();
      expect(runtime.summary.artifacts.map((artifact) => artifact.stage)).toEqual(['document_map']);
      const captured = {
        document: JEEP_DOCUMENT,
        provider: config.provider,
        model: config.model,
        elapsedMs,
        usage: runtime.summary.usage,
        completedStages: ['document_map'],
        metadataReferenceAudits,
        canonicalization: { status: 'PASS' },
        documentMap: runtime.documentMap,
        status: 'DOCUMENT_MAP_ONLY',
      };
      await writeFile(config.outputPath, `${JSON.stringify(captured, null, 2)}\n`, 'utf8');
      console.info(
        'JEEP_GOLDEN_DOCUMENT_MAP',
        JSON.stringify({ ...captured, documentMap: undefined, outputPath: config.outputPath }),
      );
      return;
    }
    expect(runtime.documentary).toBeDefined();
    expect(runtime.payloads).toEqual([]);
    expect(runtime.summary.artifacts.map((artifact) => artifact.stage)).not.toContain(
      'domain_mapping',
    );
    const benchmark = runCommercialDocumentGoldenBenchmark({
      document: JEEP_DOCUMENT,
      artifact: runtime.documentary!.unitExtractions,
      expectedFacts: COMMERCIAL_LETTER_GOLDEN_FACTS,
      expectedCompositions: COMMERCIAL_LETTER_GOLDEN_OFFERS,
    });
    const captured = {
      document: JEEP_DOCUMENT,
      provider: config.provider,
      model: config.model,
      elapsedMs,
      usage: runtime.summary.usage,
      metadataReferenceAudits,
      unitExtractionYearDiagnostics,
      canonicalization: { status: 'PASS' },
      stages: {
        documentMap: runtime.documentary!.documentMap.schemaVersion,
        unitPlan: runtime.documentary!.unitPlan.schemaVersion,
        unitExtraction: runtime.documentary!.unitExtractions.map(
          (artifact) => artifact.schemaVersion,
        ),
        merge: runtime.documentary!.reconciliation.schemaVersion,
        semanticReconciliation: runtime.documentary!.semanticReconciliation.schemaVersion,
      },
      artifact: runtime.documentary,
      benchmark,
      summary: formatCommercialDocumentGoldenBenchmark(benchmark),
    };
    await writeFile(config.outputPath, `${JSON.stringify(captured, null, 2)}\n`, 'utf8');
    console.info(
      'JEEP_GOLDEN_BENCHMARK',
      JSON.stringify({
        document: captured.document,
        provider: captured.provider,
        model: captured.model,
        elapsedMs: captured.elapsedMs,
        usage: captured.usage,
        stages: captured.stages,
        benchmark: captured.benchmark,
        outputPath: config.outputPath,
      }),
    );
    console.info(captured.summary);
    expect(benchmark.status).toBe('PASS');
  }, 1_200_000);
});

describe.skipIf(!savedMapResultPath)('Jeep saved Document Map planner diagnostic', () => {
  it('reports only safe structural planning data', async () => {
    const payload = JSON.parse(await readFile(resolve(savedMapResultPath!), 'utf8')) as {
      readonly documentMap: CommercialDocumentMapV1;
    };
    try {
      const plan = createCommercialExtractionUnitPlan(payload.documentMap);
      const pageNumberById = new Map(
        payload.documentMap.pages.map((page) => [page.pageId, page.pageNumber]),
      );
      const result = {
        status: 'PASS',
        unitCount: plan.units.length,
        page10Units: plan.units
          .filter((unit) => unit.primaryPageIds.some((pageId) => pageNumberById.get(pageId) === 10))
          .map((unit) => ({
            unitType: unit.unitType,
            ordinal: unit.ordinal,
            primaryPageNumbers: unit.primaryPageIds.map((pageId) => pageNumberById.get(pageId)),
            contextPageNumbers: unit.contextPageIds.map((pageId) => pageNumberById.get(pageId)),
            sectionCount: unit.sectionIds.length,
            tableCount: unit.tableIds.length,
            noteCount: unit.noteIds.length,
            reasons: [...new Set(unit.overlaps.map((overlap) => overlap.reason))].sort(),
          })),
      } as const;
      if (savedMapDiagnosticPath)
        await writeFile(resolve(savedMapDiagnosticPath), `${JSON.stringify(result, null, 2)}\n`);
      console.info('JEEP_UNIT_PLAN_DIAGNOSTIC', JSON.stringify(result));
    } catch (error) {
      if (!(error instanceof CommercialExtractionUnitContextLimitError)) throw error;
      const result = { status: 'FAIL', diagnostic: error.diagnostic } as const;
      if (savedMapDiagnosticPath)
        await writeFile(resolve(savedMapDiagnosticPath), `${JSON.stringify(result, null, 2)}\n`);
      console.info('JEEP_UNIT_PLAN_DIAGNOSTIC', JSON.stringify(result));
    }
  });
});
