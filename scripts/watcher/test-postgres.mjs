import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { WatcherSupabaseAdapter } from '../../packages/adapter-supabase/src/watcher-supabase-adapter.ts';
import { processWatcherIngestion } from '../../packages/core/src/agents/watcher-incremental.ts';
import { createWatcherArticleObservation } from '../../packages/core/src/agents/watcher-ingestion-contract.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const name = 'compra-car-watcher-test-' + process.pid + '-' + randomUUID().slice(0, 8);
let containerId = null;
let pinnedEndpoint = null;
function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const environment = { ...process.env };
    delete environment.DOCKER_HOST;
    delete environment.DOCKER_CONTEXT;
    const child = spawn('docker', pinnedEndpoint ? ['--host', pinnedEndpoint, ...args] : args, {
      env: environment,
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (b) => {
      stdout += b;
    });
    child.stderr.on('data', (b) => {
      stderr += b;
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(new Error('Docker command failed: ' + args.slice(0, 3).join(' ') + '\n' + stderr)),
    );
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
async function sql(input) {
  return command(
    [
      'exec',
      '-i',
      name,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-X',
      '-q',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      'VERBOSITY=verbose',
    ],
    input,
  );
}
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const json = (v) => quote(JSON.stringify(v)) + '::jsonb';
const suites = [];
async function test(label, fn) {
  await fn();
  suites.push(label);
  console.log('PASS ' + label);
}
await mkdir(new URL('../../.local-reports/watcher-24a3a/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../../.local-reports/watcher-24a3a/postgres-results.json', import.meta.url),
  JSON.stringify({ status: 'RUNNING', remoteWrites: 0 }),
);
try {
  const endpoint = await command(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  if (
    !/^(?:npipe:\/\/|unix:\/\/)/.test(endpoint) ||
    (process.env.DOCKER_HOST && !/^(?:npipe:\/\/|unix:\/\/)/.test(process.env.DOCKER_HOST))
  )
    throw new Error('Only local Docker pipes/sockets allowed');
  pinnedEndpoint = endpoint;
  containerId = await command([
    'run',
    '--rm',
    '--name',
    name,
    '--network',
    'none',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-d',
    'postgres:16.13-alpine',
  ]);
  assert.match(containerId, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      await sql('select 1;');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  assert.equal(ready, true, 'Disposable PostgreSQL did not start');
  await sql(
    'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to service_role;',
  );
  await sql(
    "create function public.watcher_acl_scope_probe() returns int language sql as 'select 1';",
  );
  const files = (await readdir(new URL('../../supabase/migrations/', import.meta.url)))
    .filter(
      (f) =>
        f.endsWith('_sprint_24a3a_watcher_storage.sql') ||
        f.endsWith('_sprint_24a3a_watcher_transactions.sql'),
    )
    .sort();
  assert.equal(files.length, 2);
  for (const file of files)
    await sql(
      await readFile(new URL('../../supabase/migrations/' + file, import.meta.url), 'utf8'),
    );
  await test('explicit function ACLs leave unrelated watcher-prefixed functions unchanged', async () => {
    assert.equal(
      await sql(
        "select has_function_privilege('anon','public.watcher_acl_scope_probe()','EXECUTE');",
      ),
      't',
    );
    await sql('drop function public.watcher_acl_scope_probe();');
  });
  await test('both migrations apply without legacy/auth dependencies', async () =>
    assert.equal(
      await sql(
        "select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'watcher_%' and relkind='r';",
      ),
      '10',
    ));
  for (const file of (await readdir(new URL('../../supabase/tests/watcher/', import.meta.url)))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const input = await readFile(
      new URL('../../supabase/tests/watcher/' + file, import.meta.url),
      'utf8',
    );
    await test(file, () => sql(input));
  }
  await test('QA read-only postflight works with unrelated public schema objects', async () => {
    await sql(
      'create table public.unrelated_parent(id int primary key); create table public.unrelated_child(id int references public.unrelated_parent(id));',
    );
    const preflight = await readFile(new URL('./qa-preflight.sql', import.meta.url), 'utf8');
    assert.match(await sql(preflight), /\|on\|/);
    const postflight = await readFile(new URL('./qa-postflight.sql', import.meta.url), 'utf8');
    const output = await sql(postflight);
    const checks = output.split('\n').filter((line) => /\|[tf]$/.test(line));
    assert.ok(checks.length >= 50, 'postflight checks missing');
    assert.deepEqual(
      checks.filter((line) => line.endsWith('|f')),
      [],
    );
    assert.equal(await sql('select count(*) from public.unrelated_child;'), '0');
    await sql(postflight);
  });
  const allowedRpcs = new Set([
    'watcher_register_source',
    'watcher_claim_source',
    'watcher_release_source',
    'watcher_persist_batch',
    'watcher_query',
    'watcher_stage_candidate',
    'watcher_attach_evidence',
    'watcher_prepare_hint',
  ]);
  const literal = (v) =>
    v === null
      ? 'null'
      : typeof v === 'boolean'
        ? String(v)
        : typeof v === 'number'
          ? String(v)
          : typeof v === 'string'
            ? quote(v)
            : json(v);
  const callSql = (rpc, args) => {
    assert.ok(allowedRpcs.has(rpc));
    return (
      'select public.' +
      rpc +
      '(' +
      Object.entries(args)
        .map(([k, v]) => {
          assert.match(k, /^p_[a-z_]+$/);
          return k + '=>' + literal(v);
        })
        .join(',') +
      ');'
    );
  };
  const client = {
    async rpc(rpc, args) {
      try {
        const value = await sql('set role service_role;' + callSql(rpc, args));
        return {
          data:
            value === 't' ? true : value === 'f' ? false : value === '' ? null : JSON.parse(value),
          error: null,
        };
      } catch (error) {
        const m = /ERROR:\s+([A-Z0-9]{5}):\s+([^\r\n]+)/.exec(error.message);
        return { data: null, error: { code: m?.[1], message: m?.[2] ?? 'SQL_FAILED' } };
      }
    },
  };
  const adapter = new WatcherSupabaseAdapter(client);
  const source = (id) => ({
    id,
    feedUrl: 'https://' + id + '.example.org/rss',
    editorialMarket: 'BR',
    language: 'pt-BR',
    sourceRank: 1,
    enabled: true,
  });
  const settings = (s) => ({
    requestUrl: s.feedUrl,
    allowedHosts: [new URL(s.feedUrl).hostname],
    allowedArticleHosts: [new URL(s.feedUrl).hostname],
    allowRelativeUrls: false,
    pollIntervalSeconds: 3600,
  });
  const register = async (id) => {
    const s = source(id);
    return adapter.registerSource(s, settings(s));
  };
  let tick = Date.now() - 60_000;
  const payload = (s, items = [], options = {}) => {
    const observedAt = new Date(tick++).toISOString();
    return {
      batch: {
        schemaVersion: 'watcher-ingestion/1',
        sourceId: s,
        observedAt,
        observations: items.map((item) => createWatcherArticleObservation(item, observedAt)),
        failures: [],
      },
      checkpoint: {
        sourceId: s,
        etag: 'version-' + tick,
        lastModified: null,
        lastSuccessfulObservedAt: observedAt,
      },
      advanceCheckpoint: true,
      checkpointBlockedReason: null,
      diagnostics: [],
      ...options,
    };
  };
  const item = (s, title = 'Original', url = 'https://news.example.org/shared') => ({
    sourceId: s,
    guid: 'opaque-1',
    url,
    title,
    excerpt: 'Small bounded excerpt',
    publishedAt: '2026-10-20T12:00:00.000Z',
    updatedAt: null,
  });
  const persist = async (id, p) => {
    const lease = await adapter.claimLease(id, 'integration', 60);
    assert.ok(lease);
    return adapter.persistBatch({ batchId: randomUUID(), lease, ...p });
  };
  await test('source registration is idempotent and paginated', async () => {
    const s = await register('main');
    assert.equal(s.configVersion, 1);
    assert.deepEqual(await register('main'), s);
    assert.equal((await adapter.listSources()).length, 1);
  });
  await test('two independent sessions cannot claim the same source', async () => {
    await register('race');
    const results = await Promise.all([
      adapter.claimLease('race', 'worker-a', 60),
      adapter.claimLease('race', 'worker-b', 60),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const winner = results.find(Boolean);
    assert.equal(await adapter.releaseLease('race', winner.token), true);
    assert.equal(await adapter.releaseLease('race', winner.token), false);
  });
  await test('expired/dead collector is reclaimed and fenced; checkpoint stays unchanged', async () => {
    await register('expired');
    const old = await adapter.claimLease('expired', 'old', 1);
    await sql('select pg_sleep(1.1);');
    const fresh = await adapter.claimLease('expired', 'new', 60);
    assert.ok(fresh);
    assert.notEqual(old.token, fresh.token);
    assert.equal(await adapter.releaseLease('expired', old.token), false);
    await assert.rejects(
      adapter.persistBatch({
        batchId: randomUUID(),
        lease: old,
        ...payload('expired', [item('expired')]),
      }),
      { code: 'STALE_LEASE' },
    );
    const state = await adapter.getSourceState('expired');
    assert.equal(state.checkpoint.lastSuccessfulObservedAt, null);
    assert.equal(state.lastFailureCode, 'LEASE_EXPIRED');
    await adapter.releaseLease('expired', fresh.token);
  });
  let originalPayload, originalLease, firstReceipt;
  const firstBatchId = randomUUID();
  await test('batch commit atomically records article/revision/checkpoint and releases lease', async () => {
    originalPayload = payload('main', [item('main')]);
    originalLease = await adapter.claimLease('main', 'main-worker', 60);
    firstReceipt = await adapter.persistBatch({
      batchId: firstBatchId,
      lease: originalLease,
      ...originalPayload,
    });
    assert.equal(firstReceipt.status, 'COMMITTED');
    assert.equal(firstReceipt.checkpointAdvanced, true);
    const st = await adapter.getSourceState('main');
    assert.equal(st.lease, null);
    assert.equal(st.checkpoint.etag, originalPayload.checkpoint.etag);
    assert.equal((await adapter.listArticles()).length, 1);
  });
  await test('lost response and concurrent replay return same receipt without old checkpoint writes', async () => {
    const input = { batchId: firstBatchId, lease: originalLease, ...originalPayload };
    const receipts = await Promise.all([adapter.persistBatch(input), adapter.persistBatch(input)]);
    assert.ok(receipts.every((r) => r.replayed && r.stateVersion === firstReceipt.stateVersion));
    await assert.rejects(
      adapter.persistBatch({ ...input, checkpoint: { ...input.checkpoint, etag: 'tampered' } }),
      { code: 'CONTENT_CONFLICT' },
    );
    assert.equal((await adapter.listArticles()).length, 1);
  });
  await test('new batches recognize unchanged content, updates and A-B-A reversions', async () => {
    await persist('main', payload('main', [item('main')]));
    await persist('main', payload('main', [item('main', 'Updated')]));
    await persist('main', payload('main', [item('main')]));
    const articles = await adapter.listArticles();
    const revisions = await adapter.listRevisions(articles[0].id);
    assert.equal(revisions.length, 2);
    assert.equal(
      await sql(
        "select r.item_payload->>'title' from public.watcher_feed_items f join public.watcher_article_revisions r on r.id=f.current_revision_id where f.source_id='main';",
      ),
      'Original',
    );
    assert.equal(
      await sql("select count(*) from public.watcher_batch_items where decision='UNCHANGED';"),
      '1',
    );
    const before = await adapter.getSourceState('main');
    await adapter.persistBatch({ batchId: firstBatchId, lease: originalLease, ...originalPayload });
    assert.deepEqual(await adapter.getSourceState('main'), before);
  });
  await test('shared URL deduplicates article but preserves source origins and immutable evidence', async () => {
    await register('other');
    await persist('other', payload('other', [item('other')]));
    assert.equal((await adapter.listArticles()).length, 1);
    assert.equal(await sql('select count(*) from public.watcher_feed_items;'), '2');
    assert.equal((await adapter.listRevisions((await adapter.listArticles())[0].id)).length, 3);
  });
  await test('partial ingestion persists valid evidence but never advances checkpoint', async () => {
    const before = await adapter.getSourceState('main');
    const p = payload('main', [{ ...item('main', 'Partial'), guid: 'partial' }]);
    p.batch.failures = [
      {
        sourceId: 'main',
        itemKey: null,
        observedAt: p.batch.observedAt,
        stage: 'PARSE',
        code: 'LIMIT_EXCEEDED',
        retryable: false,
      },
    ];
    p.advanceCheckpoint = false;
    const receipt = await persist('main', p);
    assert.equal(receipt.status, 'PARTIAL');
    assert.equal(receipt.checkpointAdvanced, false);
    const after = await adapter.getSourceState('main');
    assert.deepEqual(after.checkpoint, before.checkpoint);
    assert.equal(after.consecutiveFailures, 1);
  });
  await test('persistence failure rolls back earlier article writes, receipt and checkpoint', async () => {
    await register('rollback');
    const lease = await adapter.claimLease('rollback', 'worker', 60),
      p = payload('rollback', [
        item('rollback', 'First', 'https://a.example.org/a'),
        { ...item('rollback', 'Second', 'https://z.example.org/b'), guid: 'second' },
      ]);
    // Inject failure in the second insertion; the first insertion must disappear too.
    await sql(
      "create function public.watcher_test_fail() returns trigger language plpgsql as $$begin if new.canonical_url='https://z.example.org/b' then raise exception 'INJECTED_FAILURE'; end if; return new; end$$;create trigger watcher_test_inject before insert on public.watcher_articles for each row execute function public.watcher_test_fail();",
    );
    const batchId = randomUUID();
    await assert.rejects(adapter.persistBatch({ batchId, lease, ...p }), {
      code: 'PERSISTENCE_FAILED',
    });
    assert.equal(
      await sql(
        "select count(*) from public.watcher_articles where canonical_url='https://a.example.org/a';",
      ),
      '0',
    );
    assert.equal(
      (await adapter.getSourceState('rollback')).checkpoint.lastSuccessfulObservedAt,
      null,
    );
    await sql(
      'drop trigger watcher_test_inject on public.watcher_articles;drop function public.watcher_test_fail();',
    );
    const receipt = await adapter.persistBatch({ batchId, lease, ...p });
    assert.equal(receipt.status, 'COMMITTED');
  });
  await test('configuration CAS and active lease prevent races; config change invalidates validators', async () => {
    const config = (await adapter.listSources(100)).find((s) => s.source.id === 'main');
    const lease = await adapter.claimLease('main', 'config-lock', 60);
    await assert.rejects(
      adapter.registerSource(
        { ...config.source, sourceRank: 2 },
        config.settings,
        config.configVersion,
      ),
      { code: 'SOURCE_BUSY' },
    );
    await adapter.releaseLease('main', lease.token);
    await assert.rejects(
      adapter.registerSource({ ...config.source, sourceRank: 2 }, config.settings, 999),
      { code: 'CONTENT_CONFLICT' },
    );
    const updated = await adapter.registerSource(
      { ...config.source, sourceRank: 2 },
      config.settings,
      config.configVersion,
    );
    assert.equal(updated.configVersion, 2);
    assert.equal((await adapter.getSourceState('main')).checkpoint.etag, null);
  });
  await test('candidate evidence/version guards and idempotent prepared hints', async () => {
    const draft = {
      id: randomUUID(),
      brand: 'Ford',
      modelHint: 'Puma',
      projectCode: null,
      aliases: ['Novo Puma'],
      status: 'EXPECTED_BR',
    };
    const c = await adapter.stageCandidate(draft);
    assert.deepEqual(await adapter.stageCandidate(draft), c);
    const revision = (
      await adapter.listRevisions(
        (await adapter.listArticles()).find(
          (a) => a.canonicalUrl === 'https://news.example.org/shared',
        ).id,
      )
    ).find((r) => r.item.sourceId === 'main' && r.item.title === 'Original');
    const input = {
      candidateId: c.id,
      candidateVersion: c.version,
      revisionId: revision.id,
      assertion: 'BR_CONFIRMED',
      actorId: randomUUID(),
      note: 'Explicit operator confirmation from bounded evidence',
    };
    const e = await adapter.attachCandidateEvidence(input);
    assert.deepEqual(await adapter.attachCandidateEvidence(input), e);
    const h = await adapter.prepareHint(c.id, e.id, c.version);
    assert.deepEqual(await adapter.prepareHint(c.id, e.id, c.version), h);
    assert.equal(h.payload.evidenceFingerprint, revision.evidenceFingerprint);
    assert.equal((await adapter.listCandidateEvidence(c.id)).length, 1);
    const changed = await adapter.stageCandidate({ ...draft, aliases: ['Puma'] }, c.version);
    await assert.rejects(adapter.prepareHint(c.id, e.id, changed.version), {
      code: 'HINT_NOT_READY',
    });
  });
  await test('cross-source batches lock shared URLs in deterministic order without losing origins', async () => {
    await register('parallel-a');
    await register('parallel-b');
    const a = payload('parallel-a', [
      item('parallel-a', 'One', 'https://shared.example.org/b'),
      { ...item('parallel-a', 'Two', 'https://shared.example.org/a'), guid: 'two' },
    ]);
    const b = payload('parallel-b', [
      { ...item('parallel-b', 'Two', 'https://shared.example.org/a'), guid: 'two' },
      item('parallel-b', 'One', 'https://shared.example.org/b'),
    ]);
    const receipts = await Promise.all([persist('parallel-a', a), persist('parallel-b', b)]);
    assert.ok(receipts.every((r) => r.status === 'COMMITTED'));
    assert.equal(
      await sql(
        "select count(*) from public.watcher_articles where canonical_url like 'https://shared.example.org/%';",
      ),
      '2',
    );
    assert.equal(
      await sql(
        "select count(*) from public.watcher_feed_items where source_id in ('parallel-a','parallel-b');",
      ),
      '4',
    );
  });
  await test('stale expected state/config versions never write a batch', async () => {
    await register('stale');
    const lease = await adapter.claimLease('stale', 'worker', 60),
      p = payload('stale', [item('stale')]);
    await assert.rejects(
      adapter.persistBatch({
        batchId: randomUUID(),
        lease: { ...lease, stateVersion: lease.stateVersion + 1 },
        ...p,
      }),
      { code: 'STALE_STATE' },
    );
    await assert.rejects(
      adapter.persistBatch({
        batchId: randomUUID(),
        lease: { ...lease, configVersion: lease.configVersion + 1 },
        ...p,
      }),
      { code: 'STALE_STATE' },
    );
    assert.equal((await adapter.getSourceState('stale')).checkpoint.lastSuccessfulObservedAt, null);
    await adapter.releaseLease('stale', lease.token, 'PERSISTENCE_FAILED');
    assert.equal((await adapter.getSourceState('stale')).lastFailureCode, 'PERSISTENCE_FAILED');
  });
  await test('lease expiry during commit rolls back every write', async () => {
    await register('slow');
    const lease = await adapter.claimLease('slow', 'worker', 1),
      p = payload('slow', [item('slow', 'Delayed', 'https://slow.example.org/a')]);
    await sql(
      "create function public.watcher_test_slow() returns trigger language plpgsql as $$begin if new.canonical_url='https://slow.example.org/a' then perform pg_sleep(1.2); end if;return new;end$$;create trigger watcher_test_slow before insert on public.watcher_articles for each row execute function public.watcher_test_slow();",
    );
    await assert.rejects(adapter.persistBatch({ batchId: randomUUID(), lease, ...p }), {
      code: 'STALE_LEASE',
    });
    assert.equal(
      await sql(
        "select count(*) from public.watcher_articles where canonical_url='https://slow.example.org/a';",
      ),
      '0',
    );
    await sql(
      'drop trigger watcher_test_slow on public.watcher_articles;drop function public.watcher_test_slow();',
    );
  });
  await test('abrupt backend termination rolls back commit and the same batch safely recovers', async () => {
    await register('crash');
    const lease = await adapter.claimLease('crash', 'worker', 60),
      p = payload('crash', [item('crash', 'Crash', 'https://crash.example.org/a')]),
      batchId = randomUUID();
    const args = {
      p_batch_id: batchId,
      p_token: lease.token,
      p_config_version: lease.configVersion,
      p_state_version: lease.stateVersion,
      p_payload: p,
    };
    // Keep the RPC's transaction open after it returns, then terminate the disposable backend.
    const execution = sql(
      "set application_name='watcher_crash_test';set role service_role;begin;" +
        callSql('watcher_persist_batch', args) +
        'select pg_sleep(30);commit;',
    ).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    );
    let pid = '';
    for (let i = 0; i < 80; i++) {
      pid = await sql(
        "select pid from pg_stat_activity where application_name='watcher_crash_test' and wait_event='PgSleep';",
      );
      if (pid) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.match(pid, /^\d+$/);
    await sql('select pg_terminate_backend(' + pid + ');');
    assert.equal((await execution).ok, false);
    assert.equal(
      await sql(
        'select count(*) from public.watcher_batches where id=' + quote(batchId) + '::uuid;',
      ),
      '0',
    );
    assert.equal((await adapter.getSourceState('crash')).checkpoint.lastSuccessfulObservedAt, null);
    const recovered = await adapter.persistBatch({ batchId, lease, ...p });
    assert.equal(recovered.status, 'COMMITTED');
    assert.equal(recovered.replayed, false);
  });
  await test('superseded article evidence and unconfirmed assertions cannot prepare hints', async () => {
    await register('hint-source');
    await persist(
      'hint-source',
      payload('hint-source', [item('hint-source', 'Confirmed', 'https://hint.example.org/a')]),
    );
    const article = (await adapter.listArticles(100)).find(
      (a) => a.canonicalUrl === 'https://hint.example.org/a',
    );
    const revision = (await adapter.listRevisions(article.id))[0];
    const c = await adapter.stageCandidate({
      id: randomUUID(),
      brand: 'Ford',
      modelHint: 'Future',
      projectCode: null,
      aliases: [],
      status: 'EXPECTED_BR',
    });
    const mention = await adapter.attachCandidateEvidence({
      candidateId: c.id,
      candidateVersion: 1,
      revisionId: revision.id,
      assertion: 'MENTION',
      actorId: null,
      note: 'Not confirmation',
    });
    await assert.rejects(adapter.prepareHint(c.id, mention.id, 1), { code: 'HINT_NOT_READY' });
    const confirmed = await adapter.attachCandidateEvidence({
      candidateId: c.id,
      candidateVersion: 1,
      revisionId: revision.id,
      assertion: 'BR_CONFIRMED',
      actorId: randomUUID(),
      note: 'Explicit confirmation',
    });
    await persist(
      'hint-source',
      payload('hint-source', [item('hint-source', 'Correction', 'https://hint.example.org/a')]),
    );
    await assert.rejects(adapter.prepareHint(c.id, confirmed.id, 1), { code: 'HINT_NOT_READY' });
  });
  await test('immutable audit tables reject owner updates; invalid fingerprints roll back', async () => {
    await assert.rejects(
      sql(
        "update public.watcher_article_revisions set item_payload=jsonb_set(item_payload,'{title}','\"tamper\"');",
      ),
      /WATCHER_IMMUTABLE/,
    );
    await assert.rejects(
      sql("update public.watcher_hints set status='PREPARED';"),
      /WATCHER_IMMUTABLE/,
    );
    await register('invalid');
    const lease = await adapter.claimLease('invalid', 'worker', 60),
      p = payload('invalid', [item('invalid')]);
    p.batch.observations[0].evidenceFingerprint = 'watcher-evidence/1:sha256:' + '0'.repeat(64);
    const result = await client.rpc('watcher_persist_batch', {
      p_batch_id: randomUUID(),
      p_token: lease.token,
      p_config_version: lease.configVersion,
      p_state_version: lease.stateVersion,
      p_payload: p,
    });
    assert.equal(result.error.message, 'WATCHER_INVALID_FINGERPRINT');
    assert.equal(
      (await adapter.getSourceState('invalid')).checkpoint.lastSuccessfulObservedAt,
      null,
    );
  });

  await test('durable current/history rehydrate Core after restart, with original source config snapshots', async () => {
    const items = await adapter.listSourceItems('main', 100),
      revisions = await adapter.listSourceRevisions('main', 100),
      state = await adapter.getSourceState('main');
    const config = (await adapter.listSources(100)).find((s) => s.source.id === 'main');
    const p = payload('main');
    const resumed = processWatcherIngestion({
      source: config.source,
      batch: p.batch,
      history: revisions.map((r) => createWatcherArticleObservation(r.item, r.firstObservedAt)),
      current: items.map((i) => i.currentObservation),
      checkpoint: state.checkpoint,
      proposedCheckpoint: p.checkpoint,
    });
    assert.equal(resumed.current.length, items.length);
    assert.equal(resumed.newItems.length, 0);
    const batches = await adapter.listBatches('main', 100);
    assert.ok(batches.length >= 5);
    assert.ok(batches.every((b) => b.sourceSnapshot.configVersion === 1));
    assert.equal(config.configVersion, 2);
  });
  await test('SQL rejects null diagnostics that would otherwise bypass checkpoint validation', async () => {
    await register('null-guard');
    const lease = await adapter.claimLease('null-guard', 'worker', 60),
      p = payload('null-guard');
    p.diagnostics = [{ code: null, itemIndex: null }];
    const result = await client.rpc('watcher_persist_batch', {
      p_batch_id: randomUUID(),
      p_token: lease.token,
      p_config_version: lease.configVersion,
      p_state_version: lease.stateVersion,
      p_payload: p,
    });
    assert.equal(result.error.message, 'WATCHER_INVALID_BATCH');
    assert.equal((await adapter.getSourceState('null-guard')).checkpoint.etag, null);
  });
  await mkdir(new URL('../../.local-reports/watcher-24a3a/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../../.local-reports/watcher-24a3a/postgres-results.json', import.meta.url),
    JSON.stringify({ status: 'PASS', postgres: '16.13', suites, remoteWrites: 0 }, null, 2),
  );
} catch (error) {
  await writeFile(
    new URL('../../.local-reports/watcher-24a3a/postgres-results.json', import.meta.url),
    JSON.stringify({ status: 'FAIL', suites, remoteWrites: 0 }, null, 2),
  );
  throw error;
} finally {
  if (containerId) {
    const actualName = await command(['inspect', '--format', '{{.Name}}', containerId]);
    assert.equal(actualName, '/' + name);
    assert.ok(name.startsWith('compra-car-watcher-test-'));
    await command(['rm', '-f', '-v', containerId]);
  }
}
