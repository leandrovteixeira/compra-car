import { isDeepStrictEqual } from 'node:util';
import {
  discoverWatcherCandidates,
  type WatcherIntelligenceContext,
  type WatcherRepository,
  type WatcherStoredRevision,
} from '@compra-car/core/agents';

/**
 * Read-only pilot bridge. The caller supplies the existing QA-guarded Watcher
 * repository and a separately reviewed canonical context. No client, env loader,
 * RSS fetch, lease, RPC writer or LLM is constructed by this module.
 */
type Reader = Pick<
  WatcherRepository,
  'listSources' | 'listBatches' | 'listSourceItems' | 'listSourceRevisions'
>;

const SOURCE = 'motor1-br-pilot';
const BATCH = '9579c635-4397-44f2-8050-a3ce12bcdbc0';
const LIMIT = 100;

function blocked(reason: string): never {
  throw new Error('WATCHER_INTELLIGENCE_PREVIEW_' + reason);
}

async function readPages<T>(
  read: (limit: number, offset: number) => Promise<readonly T[]>,
  maximum: number,
): Promise<readonly T[]> {
  const result: T[] = [];
  for (let offset = 0; offset <= maximum; offset += LIMIT) {
    const page = await read(LIMIT, offset);
    if (page.length > LIMIT || result.length + page.length > maximum)
      blocked('PAGINATION_LIMIT');
    result.push(...page);
    if (page.length < LIMIT) return result;
  }
  return blocked('PAGINATION_LIMIT');
}

export async function previewWatcherMotor1Intelligence(input: {
  repository: Reader;
  context: WatcherIntelligenceContext;
}) {
  const { repository, context } = input;
  const sources = await readPages((limit, offset) => repository.listSources(limit, offset), 100);
  const source = sources.find((s) => s.source.id === SOURCE);
  if (!source || !source.source.enabled || sources.filter((s) => s.source.id === SOURCE).length !== 1)
    blocked('SOURCE_NOT_APPROVED');
  const contextSource = context.sources.find((s) => s.source.id === SOURCE);
  if (!contextSource || contextSource.kind !== 'SECONDARY' ||
      !isDeepStrictEqual(contextSource.source, source.source))
    blocked('CONTEXT_SOURCE_MISMATCH');

  const batches = await readPages(
    (limit, offset) => repository.listBatches(SOURCE, limit, offset),
    100,
  );
  const batch = batches.find((b) => b.batchId === BATCH);
  if (!batch || batch.status !== 'COMMITTED' || batches.filter((b) => b.batchId === BATCH).length !== 1)
    blocked('BATCH_NOT_COMMITTED');

  const items = await readPages(
    (limit, offset) => repository.listSourceItems(SOURCE, limit, offset),
    100,
  );
  const revisions = await readPages(
    (limit, offset) => repository.listSourceRevisions(SOURCE, limit, offset),
    100,
  );
  if (items.length !== 20 || revisions.length !== 20 ||
      new Set(items.map((x) => x.id)).size !== items.length ||
      new Set(revisions.map((x) => x.id)).size !== revisions.length)
    blocked('BASELINE_CHANGED');

  const byRevision = new Map<string, WatcherStoredRevision>();
  for (const revision of revisions) {
    if (revision.item.sourceId !== SOURCE) blocked('REVISION_SOURCE_MISMATCH');
    byRevision.set(revision.id, revision);
  }
  for (const item of items) {
    const revision = byRevision.get(item.currentRevisionId);
    if (!revision || revision.feedItemId !== item.id || revision.articleId !== item.articleId)
      blocked('CURRENT_REVISION_MISMATCH');
  }
  const projection = discoverWatcherCandidates({
    context,
    documents: revisions.map((revision) => ({ revision, content: null, originGroup: null })),
    currentRevisionIds: items.map((item) => item.currentRevisionId),
  });
  if (projection.report.aiCalls !== 0 || projection.report.aiCostUsd !== 0)
    blocked('UNEXPECTED_AI_USAGE');
  // Return only the pure projection. No state is committed or reviewed.
  return {
    sourceId: SOURCE,
    batchId: BATCH,
    mode: 'READ_ONLY',
    ...projection,
  } as const;
}
