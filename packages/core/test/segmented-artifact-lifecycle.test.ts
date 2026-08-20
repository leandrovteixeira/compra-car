import { describe, expect, it } from 'vitest';
import {
  SEGMENTED_ARTIFACT_BUCKET,
  SEGMENTED_ARTIFACT_LIMITS,
  SEGMENTED_ARTIFACT_RETENTION_POLICY,
  buildSegmentedArtifactStorageReference,
  canonicalizeSegmentedArtifactBody,
  hashSegmentedArtifactBody,
  prepareSegmentedArtifact,
  publishSegmentedArtifact,
  resolveLatestSucceededSegmentedArtifact,
  transitionSegmentedArtifact,
  validateSegmentedArtifactDag,
  validateSegmentedArtifactManifest,
  verifySegmentedArtifactContent,
  type PrepareSegmentedArtifactInput,
  type SegmentedArtifactAuditSink,
  type SegmentedArtifactBodyStorage,
  type SegmentedArtifactLifecycleEvent,
  type SegmentedArtifactManifest,
  type SegmentedArtifactManifestRepository,
  type SegmentedArtifactStage,
  type SegmentedArtifactStorageReference,
} from '../src/import/segmented-artifact-lifecycle';

const times = {
  createdAt: '2026-08-20T12:00:00.000Z',
  startedAt: '2026-08-20T12:00:01.000Z',
  completedAt: '2026-08-20T12:00:02.000Z',
};

const inputFor = (
  stage: SegmentedArtifactStage = 'document_map',
  sourceArtifacts: readonly SegmentedArtifactManifest[] = [],
): PrepareSegmentedArtifactInput => ({
  artifactSchemaVersion: `${stage}/1`,
  artifactVersion: 1,
  batchId: 'batch-10',
  jobId: 'job-4',
  documentId: 'document-1',
  ...(stage === 'unit_extraction' ? { unitId: 'unit-1' } : {}),
  stage,
  attempt: 1,
  correlationId: 'correlation-10c4a',
  sourceArtifacts,
  body: { stage, values: [1, 2, 3] },
  createdAt: times.createdAt,
});

const succeeded = async (
  stage: SegmentedArtifactStage,
  sourceArtifacts: readonly SegmentedArtifactManifest[] = [],
  overrides: Partial<PrepareSegmentedArtifactInput> = {},
): Promise<SegmentedArtifactManifest> => {
  const { manifest } = await prepareSegmentedArtifact({
    ...inputFor(stage, sourceArtifacts),
    ...overrides,
  });
  const processing = transitionSegmentedArtifact(manifest, {
    status: 'processing',
    occurredAt: times.startedAt,
  });
  return transitionSegmentedArtifact(processing, {
    status: 'succeeded',
    occurredAt: times.completedAt,
  });
};

class MemoryRepository implements SegmentedArtifactManifestRepository {
  readonly values = new Map<string, SegmentedArtifactManifest>();
  failFinalization = false;

  async findByIdempotencyKey(key: string): Promise<SegmentedArtifactManifest | undefined> {
    return [...this.values.values()].find((value) => value.idempotencyKey === key);
  }

  async createQueued(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest> {
    if ([...this.values.values()].some((value) => value.idempotencyKey === manifest.idempotencyKey))
      throw new Error('duplicate idempotency key');
    this.values.set(manifest.artifactId, manifest);
    return manifest;
  }

  async transition(
    artifactId: string,
    expectedStatus: SegmentedArtifactManifest['status'],
    manifest: SegmentedArtifactManifest,
  ): Promise<SegmentedArtifactManifest> {
    const current = this.values.get(artifactId);
    if (!current || current.status !== expectedStatus) throw new Error('compare-and-set failed');
    if (this.failFinalization && manifest.status === 'succeeded') throw new Error('database down');
    this.values.set(artifactId, manifest);
    return manifest;
  }
}

class MemoryStorage implements SegmentedArtifactBodyStorage {
  readonly values = new Map<string, Uint8Array>();
  failPut = false;
  corruptRead = false;

  async put(reference: SegmentedArtifactStorageReference, body: Uint8Array): Promise<void> {
    if (this.failPut) throw new Error('storage down');
    this.values.set(reference.objectPath, body.slice());
  }

  async exists(reference: SegmentedArtifactStorageReference): Promise<boolean> {
    return this.values.has(reference.objectPath);
  }

  async read(reference: SegmentedArtifactStorageReference): Promise<Uint8Array> {
    const value = this.values.get(reference.objectPath);
    if (!value) throw new Error('missing object');
    return this.corruptRead ? new Uint8Array([0]) : value.slice();
  }
}

class MemoryAudit implements SegmentedArtifactAuditSink {
  readonly events: SegmentedArtifactLifecycleEvent[] = [];
  failSuccess = false;
  async append(event: SegmentedArtifactLifecycleEvent): Promise<void> {
    if (this.failSuccess && event.eventType === 'artifact_succeeded') throw new Error('audit down');
    this.events.push(event);
  }
}

const dependencies = () => ({
  manifests: new MemoryRepository(),
  storage: new MemoryStorage(),
  audit: new MemoryAudit(),
});

describe('Sprint 10C.4A artifact content and identity', () => {
  it('1. canonicalizes object-key permutations to byte-equivalent JSON', () => {
    expect(canonicalizeSegmentedArtifactBody({ b: 2, a: 1 })).toEqual(
      canonicalizeSegmentedArtifactBody({ a: 1, b: 2 }),
    );
  });

  it('2. preserves array order because it is semantic', () => {
    expect(canonicalizeSegmentedArtifactBody([1, 2])).not.toEqual(
      canonicalizeSegmentedArtifactBody([2, 1]),
    );
  });

  it('3. hashes canonical JSON with SHA-256', async () => {
    expect(await hashSegmentedArtifactBody({ b: 2, a: 1 })).toBe(
      '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
    );
  });

  it('4. rejects non-finite and non-JSON values', () => {
    expect(() => canonicalizeSegmentedArtifactBody({ value: Number.NaN })).toThrow(
      'SEGMENTED_ARTIFACT_NON_JSON_VALUE',
    );
    expect(() => canonicalizeSegmentedArtifactBody({ value: undefined })).toThrow(
      'SEGMENTED_ARTIFACT_NON_JSON_VALUE',
    );
  });

  it('5. rejects cyclic bodies', () => {
    const body: Record<string, unknown> = {};
    body.self = body;
    expect(() => canonicalizeSegmentedArtifactBody(body)).toThrow('SEGMENTED_ARTIFACT_CYCLIC_BODY');
  });

  it('6. enforces the canonical body size boundary', () => {
    const body = { value: 'x'.repeat(SEGMENTED_ARTIFACT_LIMITS.maximumCanonicalBodyBytes) };
    expect(() => canonicalizeSegmentedArtifactBody(body)).toThrow(
      'SEGMENTED_ARTIFACT_BODY_TOO_LARGE',
    );
  });

  it('7. derives stable identity and content hashes on replay', async () => {
    const first = await prepareSegmentedArtifact(inputFor());
    const second = await prepareSegmentedArtifact(inputFor());
    expect(second.manifest.artifactId).toBe(first.manifest.artifactId);
    expect(second.manifest.idempotencyKey).toBe(first.manifest.idempotencyKey);
    expect(second.manifest.content).toEqual(first.manifest.content);
  });

  it('8. changes identity for a new attempt without changing content hash', async () => {
    const first = await prepareSegmentedArtifact(inputFor());
    const second = await prepareSegmentedArtifact({ ...inputFor(), attempt: 2 });
    expect(second.manifest.artifactId).not.toBe(first.manifest.artifactId);
    expect(second.manifest.content.sha256).toBe(first.manifest.content.sha256);
  });

  it('9. makes dependency permutation irrelevant to identity', async () => {
    const map = await succeeded('document_map');
    const map2 = await succeeded('document_map');
    const left = await prepareSegmentedArtifact(inputFor('unit_plan', [map, map2]));
    const right = await prepareSegmentedArtifact(inputFor('unit_plan', [map2, map]));
    expect(right.manifest.idempotencyKey).toBe(left.manifest.idempotencyKey);
  });

  it('10. freezes prepared manifests recursively', async () => {
    const { manifest } = await prepareSegmentedArtifact(inputFor());
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.content)).toBe(true);
    expect(Object.isFrozen(manifest.sourceArtifactIds)).toBe(true);
  });
});

describe('Sprint 10C.4A lifecycle and lineage', () => {
  it('rejects invalid stage and status values at the runtime boundary', async () => {
    const manifest = (await prepareSegmentedArtifact(inputFor())).manifest;
    expect(() =>
      validateSegmentedArtifactManifest({ ...manifest, stage: 'unknown' } as never),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_STAGE');
    expect(() =>
      validateSegmentedArtifactManifest({ ...manifest, status: 'unknown' } as never),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_STATUS');
  });

  it('rejects content whose bytes do not match the manifest hash', async () => {
    const manifest = (await prepareSegmentedArtifact(inputFor())).manifest;
    await expect(
      verifySegmentedArtifactContent(manifest, new Uint8Array([1, 2, 3])),
    ).rejects.toThrow('SEGMENTED_ARTIFACT_CONTENT_HASH_MISMATCH');
  });

  it('accepts only allow-listed provider metadata with numeric usage', async () => {
    const prepared = await prepareSegmentedArtifact({
      ...inputFor('unit_extraction'),
      provider: {
        providerKey: 'provider',
        providerVersion: '4',
        providerRunId: 'run-123',
        model: 'model-1',
        promptVersion: '4',
        inputUnits: 10,
        outputUnits: 5,
        totalUnits: 15,
        durationMs: 20,
      },
    });
    expect(prepared.manifest.provider?.totalUnits).toBe(15);
    expect(() =>
      validateSegmentedArtifactManifest({
        ...prepared.manifest,
        provider: { ...prepared.manifest.provider!, apiKey: 'forbidden' },
      } as never),
    ).toThrow('SEGMENTED_ARTIFACT_UNSAFE_PROVIDER_METADATA');
    expect(() =>
      validateSegmentedArtifactManifest({
        ...prepared.manifest,
        provider: { ...prepared.manifest.provider!, inputUnits: '10' },
      } as never),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_PROVIDER_METRIC');
  });

  it('11. permits queued -> processing -> succeeded', async () => {
    const queued = (await prepareSegmentedArtifact(inputFor())).manifest;
    const processing = transitionSegmentedArtifact(queued, {
      status: 'processing',
      occurredAt: times.startedAt,
    });
    const success = transitionSegmentedArtifact(processing, {
      status: 'succeeded',
      occurredAt: times.completedAt,
    });
    expect(success.status).toBe('succeeded');
  });

  it('12. permits queued -> processing -> failed with a bounded safe error', async () => {
    const queued = (await prepareSegmentedArtifact(inputFor())).manifest;
    const processing = transitionSegmentedArtifact(queued, {
      status: 'processing',
      occurredAt: times.startedAt,
    });
    const failed = transitionSegmentedArtifact(processing, {
      status: 'failed',
      occurredAt: times.completedAt,
      failure: { code: 'SAFE_CODE', message: 'x'.repeat(2_000) },
    });
    expect(failed.failure?.message).toHaveLength(500);
  });

  it('13. rejects skipped lifecycle transitions', async () => {
    const queued = (await prepareSegmentedArtifact(inputFor())).manifest;
    expect(() =>
      transitionSegmentedArtifact(queued, {
        status: 'succeeded',
        occurredAt: times.completedAt,
      }),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_TRANSITION');
  });

  it('14. keeps terminal success immutable', async () => {
    const manifest = await succeeded('document_map');
    expect(() =>
      transitionSegmentedArtifact(manifest, {
        status: 'failed',
        occurredAt: times.completedAt,
        failure: { code: 'LATE', message: 'late' },
      }),
    ).toThrow('SEGMENTED_ARTIFACT_TERMINAL_STATE');
  });

  it('15. models retry and supersession as new-manifest lineage', async () => {
    const prior = await succeeded('document_map');
    const next = await prepareSegmentedArtifact({
      ...inputFor(),
      attempt: 2,
      retryOfArtifactId: prior.artifactId,
      supersedesArtifactId: prior.artifactId,
    });
    expect(next.manifest.retryOfArtifactId).toBe(prior.artifactId);
    expect(next.manifest.supersedesArtifactId).toBe(prior.artifactId);
    expect(prior).not.toHaveProperty('supersededByArtifactId');
  });

  it('16. rejects malformed manifest hashes', async () => {
    const manifest = (await prepareSegmentedArtifact(inputFor())).manifest;
    expect(() =>
      validateSegmentedArtifactManifest({
        ...manifest,
        content: { ...manifest.content, sha256: 'not-a-hash' },
      }),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_CONTENT_HASH');
  });

  it('17. rejects a storage path that does not derive from server-owned identity', async () => {
    const manifest = (await prepareSegmentedArtifact(inputFor())).manifest;
    expect(() =>
      validateSegmentedArtifactManifest({
        ...manifest,
        storage: { bucket: SEGMENTED_ARTIFACT_BUCKET, objectPath: 'user/file.pdf' },
      }),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_STORAGE_PATH');
  });

  it('18. rejects traversal and filename input in storage identities', () => {
    expect(() =>
      buildSegmentedArtifactStorageReference({
        batchId: '../secret',
        jobId: 'job-1',
        stage: 'merge',
        artifactId: 'artifact-1',
      }),
    ).toThrow('SEGMENTED_ARTIFACT_INVALID_BATCH_ID');
  });

  it('19. documents conservative retention with no automatic deletion', () => {
    expect(SEGMENTED_ARTIFACT_RETENTION_POLICY).toMatchObject({
      automaticDeletionEnabled: false,
      succeededMinimumDays: 365,
    });
  });

  it('keeps domain persistence and client authority outside the manifest contract', async () => {
    const manifest = (await prepareSegmentedArtifact(inputFor('domain_mapping'))).manifest;
    expect(JSON.stringify(manifest)).not.toMatch(
      /productId|policyId|offerId|claimToken|signedUrl|rawResponse|requestHeaders/iu,
    );
  });
});

describe('Sprint 10C.4A dependency DAG', () => {
  const chain = async (): Promise<SegmentedArtifactManifest[]> => {
    const map = await succeeded('document_map');
    const plan = await succeeded('unit_plan', [map]);
    const unit = await succeeded('unit_extraction', [plan]);
    const merge = await succeeded('merge', [unit]);
    const semantic = await succeeded('semantic_reconciliation', [merge]);
    const domain = await succeeded('domain_mapping', [semantic]);
    return [map, plan, unit, merge, semantic, domain];
  };

  it('20. validates the complete required stage chain', async () => {
    const manifests = await chain();
    expect(() => validateSegmentedArtifactDag(manifests)).not.toThrow();
  });

  it('21. accepts fan-in from multiple unit extractions at merge', async () => {
    const [map, plan] = await chain();
    const unitA = await succeeded('unit_extraction', [plan!]);
    const unitB = await succeeded('unit_extraction', [plan!], { unitId: 'unit-2' });
    const merge = await succeeded('merge', [unitA, unitB]);
    expect(() => validateSegmentedArtifactDag([map!, plan!, unitA, unitB, merge])).not.toThrow();
  });

  it('22. rejects a dangling dependency', async () => {
    const manifests = await chain();
    expect(() => validateSegmentedArtifactDag(manifests.slice(1))).toThrow(
      'SEGMENTED_ARTIFACT_DANGLING_DEPENDENCY',
    );
  });

  it('23. rejects a missing required predecessor', async () => {
    const plan = await succeeded('unit_plan');
    expect(() => validateSegmentedArtifactDag([plan])).toThrow(
      'SEGMENTED_ARTIFACT_MISSING_DEPENDENCY',
    );
  });

  it('24. rejects the wrong predecessor stage', async () => {
    const map = await succeeded('document_map');
    const merge = await succeeded('merge', [map]);
    expect(() => validateSegmentedArtifactDag([map, merge])).toThrow(
      'SEGMENTED_ARTIFACT_INVALID_DEPENDENCY_STAGE',
    );
  });

  it('25. rejects cross-job dependencies', async () => {
    const map = await succeeded('document_map', [], { jobId: 'job-other' });
    const plan = await succeeded('unit_plan', [map]);
    expect(() => validateSegmentedArtifactDag([map, plan])).toThrow(
      'SEGMENTED_ARTIFACT_CROSS_JOB_DEPENDENCY',
    );
  });

  it('rejects cross-batch dependencies', async () => {
    const map = await succeeded('document_map', [], { batchId: 'batch-other' });
    const plan = await succeeded('unit_plan', [map]);
    expect(() => validateSegmentedArtifactDag([map, plan])).toThrow(
      'SEGMENTED_ARTIFACT_CROSS_JOB_DEPENDENCY',
    );
  });

  it('26. rejects dependencies that have not succeeded', async () => {
    const map = (await prepareSegmentedArtifact(inputFor())).manifest;
    const plan = await succeeded('unit_plan', [map]);
    expect(() => validateSegmentedArtifactDag([map, plan])).toThrow(
      'SEGMENTED_ARTIFACT_DEPENDENCY_NOT_SUCCEEDED',
    );
  });

  it('27. rejects self-dependency explicitly', async () => {
    const plan = await succeeded('unit_plan');
    const malformed = { ...plan, sourceArtifactIds: [plan.artifactId] };
    expect(() => validateSegmentedArtifactDag([malformed])).toThrow(
      'SEGMENTED_ARTIFACT_SELF_DEPENDENCY',
    );
  });

  it('rejects dependency cycles before stage interpretation', async () => {
    const [map, plan] = await chain();
    const cyclicMap = { ...map!, sourceArtifactIds: [plan!.artifactId] };
    const cyclicPlan = { ...plan!, sourceArtifactIds: [map!.artifactId] };
    expect(() => validateSegmentedArtifactDag([cyclicMap, cyclicPlan])).toThrow(
      'SEGMENTED_ARTIFACT_DAG_CYCLE',
    );
  });

  it('resolves the latest succeeded artifact without selecting a failed retry', async () => {
    const first = await succeeded('document_map');
    const second = await succeeded('document_map', [], { attempt: 2 });
    const queuedThird = (await prepareSegmentedArtifact({ ...inputFor(), attempt: 3 })).manifest;
    expect(
      resolveLatestSucceededSegmentedArtifact([first, queuedThird, second], {
        batchId: 'batch-10',
        jobId: 'job-4',
        stage: 'document_map',
        documentId: 'document-1',
      })?.artifactId,
    ).toBe(second.artifactId);
  });
});

describe('Sprint 10C.4A publication atomicity and audit', () => {
  it('28. publishes body then finalizes the immutable manifest with ordered events', async () => {
    const deps = dependencies();
    const result = await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    expect(result.status).toBe('succeeded');
    expect(result).toMatchObject({ auditRecorded: true });
    expect(deps.audit.events.map((event) => event.eventType)).toEqual([
      'artifact_queued',
      'artifact_started',
      'artifact_succeeded',
    ]);
    expect(deps.storage.values.size).toBe(1);
  });

  it('29. replays the same idempotency key without duplicate manifest or body', async () => {
    const deps = dependencies();
    await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    const replay = await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    expect(replay).toMatchObject({ status: 'succeeded', replayed: true });
    expect(deps.manifests.values.size).toBe(1);
    expect(deps.storage.values.size).toBe(1);
  });

  it('30. fails without orphan when Storage rejects the body', async () => {
    const deps = dependencies();
    deps.storage.failPut = true;
    const result = await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    expect(result).toMatchObject({ status: 'failed', replayed: false });
    expect(result).toMatchObject({ failureManifestPersisted: true });
    expect(result).not.toHaveProperty('orphan');
    expect(result.manifest.failure?.code).toBe('ARTIFACT_STORAGE_FAILED');
  });

  it('31. exposes a reviewable orphan when DB finalization fails after Storage write', async () => {
    const deps = dependencies();
    deps.manifests.failFinalization = true;
    const result = await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    expect(result.status).toBe('failed');
    expect(result).toHaveProperty('orphan');
    expect(result).toMatchObject({ failureManifestPersisted: true });
    expect(result.manifest.failure?.code).toBe('MANIFEST_FINALIZATION_FAILED');
    expect(deps.storage.values.size).toBe(1);
  });

  it('32. treats post-write byte mismatch as observable orphan failure', async () => {
    const deps = dependencies();
    deps.storage.corruptRead = true;
    const result = await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    expect(result.status).toBe('failed');
    expect(result).toHaveProperty('orphan');
    expect(deps.audit.events.at(-1)?.eventType).toBe('artifact_failed');
  });

  it('keeps succeeded immutable and exposes audit failure after finalization', async () => {
    const deps = dependencies();
    deps.audit.failSuccess = true;
    const result = await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    expect(result).toMatchObject({
      status: 'succeeded',
      replayed: false,
      auditRecorded: false,
      manifest: { status: 'succeeded' },
    });
  });

  it('33. audit events contain correlation and identity but no body or credentials', async () => {
    const deps = dependencies();
    await publishSegmentedArtifact({ ...inputFor(), ...times }, deps);
    const serialized = JSON.stringify(deps.audit.events);
    expect(serialized).toContain('correlation-10c4a');
    expect(serialized).not.toMatch(/values|secret|token|privateUrl|signedUrl/iu);
  });
});
