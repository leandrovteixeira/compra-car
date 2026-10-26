import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepareWatcherIntelligenceCommit } from '../../packages/core/src/agents/watcher-intelligence-persistence.ts';
import { createWatcherArticleObservation } from '../../packages/core/src/agents/watcher-ingestion-contract.ts';
import { watcherDigest } from '../../packages/core/src/agents/watcher-validation.ts';

/** Extends the existing socket-pinned, network-none 24A harness; no second SQL connector. */
export async function testIntelligencePostgres({ sql, adapter, client, test, quote, json }) {
  const scopePrefix = 'qa/24b4a/';
  const sources = new Map();
  let clock = Date.now() - 10000;
  const src = (id) => ({
    id,
    feedUrl: `https://${id}.example.org/rss`,
    editorialMarket: 'BR',
    language: 'pt-BR',
    sourceRank: 1,
    enabled: true,
  });
  async function register(id) {
    const s = src(id);
    const result = await adapter.registerSource(s, {
      requestUrl: s.feedUrl,
      allowedHosts: [new URL(s.feedUrl).hostname],
      allowedArticleHosts: ['news.example.org'],
      allowRelativeUrls: false,
      pollIntervalSeconds: 3600,
    });
    sources.set(id, result.source);
    return id;
  }
  async function ingest(id, title = 'Fiat lança o novo Pulse no Brasil', guid = 'one') {
    const lease = await adapter.claimLease(id, 'ingestion-fixture', 60),
      at = new Date(clock++).toISOString();
    assert.ok(lease);
    const item = {
      sourceId: id,
      guid,
      url: `https://news.example.org/${id}/${guid}`,
      title,
      excerpt: null,
      publishedAt: '2026-10-26T18:00:00.000Z',
      updatedAt: null,
    };
    return adapter.persistBatch({
      batchId: randomUUID(),
      lease,
      batch: {
        schemaVersion: 'watcher-ingestion/1',
        sourceId: id,
        observedAt: at,
        observations: [createWatcherArticleObservation(item, at)],
        failures: [],
      },
      checkpoint: {
        sourceId: id,
        etag: 'rss-' + at,
        lastModified: null,
        lastSuccessfulObservedAt: at,
      },
      advanceCheckpoint: true,
      checkpointBlockedReason: null,
      diagnostics: [],
    });
  }
  async function fixture(suffix, titles = ['Fiat lança o novo Pulse no Brasil']) {
    const id = await register('intel-' + suffix);
    for (let i = 0; i < titles.length; i++) await ingest(id, titles[i], String(i));
    return id;
  }
  async function make(scope, ids, ttl = 60) {
    const leases = [];
    for (const id of [...ids].sort()) {
      const l = await adapter.claimLease(id, 'intelligence-fixture', ttl);
      assert.ok(l);
      leases.push(l);
    }
    const documents = (await Promise.all(ids.map((id) => adapter.listSourceRevisions(id, 100))))
      .flat()
      .map((revision) => ({ revision, content: null, originGroup: null }));
    const items = (await Promise.all(ids.map((id) => adapter.listSourceItems(id, 100)))).flat();
    const currentRevisionIds = items.map((i) => i.currentRevisionId),
      currentPointers = items.map((i) => ({
        feedItemId: i.id,
        revisionId: i.currentRevisionId,
        observedAt: i.currentObservation.observedAt,
      }));
    const context = {
      brands: [
        { id: 'fiat', canonicalName: 'Fiat', canonicalKey: 'fiat', market: 'BR', aliases: [] },
      ],
      mmvs: [
        { id: 'pulse', market: 'BR', brand: 'Fiat', model: 'Pulse', officialVersionLabel: 'Drive' },
        {
          id: 'fastback',
          market: 'BR',
          brand: 'Fiat',
          model: 'Fastback',
          officialVersionLabel: 'Limited',
        },
      ],
      sources: ids.map((id) => ({
        source: sources.get(id),
        kind: 'SECONDARY',
        officialBrandId: null,
        officialHosts: [],
      })),
    };
    const input = {
      commitId: randomUUID(),
      scope: scopePrefix + scope,
      leases,
      context,
      documents,
      currentRevisionIds,
      currentPointers,
    };
    const first = prepareWatcherIntelligenceCommit(input),
      rows = await adapter.queryIntelligence('CANDIDATES', input.scope, null, 100);
    const expectedCandidates = rows
      .filter((r) => first.payload.candidates.some((c) => c.snapshot.key === r.event_key))
      .map((r) => ({
        key: r.event_key,
        version: Number(r.version),
        reviewVersion: Number(r.review_version),
      }));
    return prepareWatcherIntelligenceCommit({ ...input, expectedCandidates });
  }
  const raw = (input) =>
    client.rpc('watcher_commit_intelligence', {
      p_commit_id: input.commitId,
      p_fences: input.leases.map((l) => ({
        sourceId: l.sourceId,
        token: l.token,
        configVersion: l.configVersion,
        stateVersion: l.stateVersion,
      })),
      p_payload: input.payload,
    });
  async function release(input) {
    for (const l of input.leases) await adapter.releaseLease(l.sourceId, l.token);
  }
  const counts = () =>
    sql(
      'select jsonb_build_array((select count(*) from public.watcher_intelligence_receipts),(select count(*) from public.watcher_intelligence_units),(select count(*) from public.watcher_intelligence_candidates),(select count(*) from public.watcher_intelligence_reviews),(select count(*) from public.watcher_candidates))::text;',
    );
  async function reviewInput(request, receipt, ttl = 60) {
    const leases = [];
    for (const id of request.leases.map((l) => l.sourceId)) {
      const l = await adapter.claimLease(id, 'human-review-fixture', ttl);
      assert.ok(l);
      leases.push(l);
    }
    const head = (await adapter.queryIntelligence('CANDIDATES', request.payload.scope))[0];
    return {
      leases,
      command: {
        reviewId: randomUUID(),
        scope: request.payload.scope,
        scopeVersion: receipt.scopeVersion,
        eventKey: head.event_key,
        expectedVersion: Number(head.version),
        expectedReviewVersion: Number(head.review_version),
        snapshotFingerprint: head.snapshot.fingerprint,
        decision: 'REJECT',
        actorId: randomUUID(),
        note: 'Explicit human review fixture; never catalog apply',
      },
    };
  }
  await test('24B PostgreSQL 17 and no browser privileges, RLS, SECURITY INVOKER', async () => {
    assert.match(await sql("select current_setting('server_version');"), /^17\.6/);
    assert.equal(
      await sql(
        "select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'watcher_intelligence_%' and relkind='r' and relrowsecurity;",
      ),
      '4',
    );
    assert.equal(
      await sql(
        "select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'watcher_intelligence_%' and relkind='r' and (has_table_privilege('anon',oid,'SELECT') or has_table_privilege('authenticated',oid,'INSERT'));",
      ),
      '0',
    );
    assert.equal(
      await sql(
        "select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('watcher_commit_intelligence','watcher_review_intelligence','watcher_intelligence_query') and (prosecdef or has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE'));",
      ),
      '0',
    );
    await sql(
      'create table public.products(id int primary key);create table public.catalog_mmvs(id int primary key);insert into public.products values(1);insert into public.catalog_mmvs values(1);',
    );
  });
  let firstRequest, firstReceipt, firstId;
  await test('24B atomic commit stores evaluations, signals, evidence, event snapshots and receipt', async () => {
    firstId = await fixture('success');
    firstRequest = await make('success', [firstId]);
    const before = await adapter.getSourceState(firstId);
    firstReceipt = await adapter.persistIntelligence(firstRequest);
    assert.equal(firstReceipt.replayed, false);
    assert.equal(firstReceipt.scopeVersion, 1);
    assert.equal(firstReceipt.unitKeys.length, 1);
    const after = await adapter.getSourceState(firstId);
    assert.deepEqual(after.checkpoint, before.checkpoint);
    assert.equal(after.lastAttemptAt, before.lastAttemptAt);
    assert.equal(after.stateVersion, before.stateVersion + 1);
    assert.equal(after.lease, null);
    assert.equal(
      (await adapter.queryIntelligence('UNITS', firstRequest.payload.scope))[0].analysis.signals
        .length,
      1,
    );
    const candidates = await adapter.queryIntelligence('CANDIDATES', firstRequest.payload.scope);
    assert.equal(candidates[0].snapshot.evidence.length, 1);
    assert.equal(candidates[0].effective_status, 'NEW');
    assert.equal(candidates[0].snapshot.applyAllowed, false);
  });
  await test('24B replay after lease release, and duplicate submission with another request ID', async () => {
    const before = await counts(),
      state = await adapter.getSourceState(firstId);
    for (const input of [firstRequest, { ...firstRequest, commitId: randomUUID() }]) {
      const r = await adapter.persistIntelligence(input);
      assert.equal(r.replayed, true);
      assert.equal(r.commitId, firstReceipt.commitId);
    }
    assert.equal(await counts(), before);
    assert.deepEqual(await adapter.getSourceState(firstId), state);
  });
  await test('24B same natural key with different content is rejected without writes', async () => {
    const input = structuredClone(firstRequest);
    input.payload.units[0].analysis.signals[0].value = 'forged';
    const before = await counts(),
      result = await raw(input);
    assert.equal(result.error.message, 'WATCHER_CONTENT_CONFLICT');
    assert.equal(await counts(), before);
  });
  await test('24B two independent sessions submit once and receive one receipt', async () => {
    const id = await fixture('race'),
      request = await make('race', [id]),
      before = await adapter.getSourceState(id);
    const receipts = await Promise.all([
      adapter.persistIntelligence(request),
      adapter.persistIntelligence(request),
    ]);
    assert.equal(receipts.filter((r) => !r.replayed).length, 1);
    assert.equal(receipts.filter((r) => r.replayed).length, 1);
    assert.equal((await adapter.getSourceState(id)).stateVersion, before.stateVersion + 1);
    assert.equal((await adapter.queryIntelligence('RECEIPTS', request.payload.scope)).length, 1);
  });
  await test('24B stale config, state and token are fenced before any write', async () => {
    const id = await fixture('fences'),
      request = await make('fences', [id]),
      before = await counts();
    for (const patch of [
      { configVersion: request.leases[0].configVersion + 1 },
      { stateVersion: request.leases[0].stateVersion + 1 },
      { token: randomUUID() },
    ]) {
      await assert.rejects(
        adapter.persistIntelligence({ ...request, leases: [{ ...request.leases[0], ...patch }] }),
        { code: patch.token ? 'STALE_LEASE' : 'STALE_STATE' },
      );
      assert.equal(await counts(), before);
    }
    await release(request);
  });
  await test('24B expired lease cannot commit or advance an analysis checkpoint', async () => {
    const id = await fixture('expired'),
      request = await make('expired', [id], 1),
      before = await counts();
    await sql('select pg_sleep(1.1);');
    await assert.rejects(adapter.persistIntelligence(request), { code: 'STALE_LEASE' });
    assert.equal(await counts(), before);
    assert.equal((await adapter.queryIntelligence('RECEIPTS', request.payload.scope)).length, 0);
  });
  await test('24B lease expiry during writes rolls back receipt, units and head', async () => {
    const id = await fixture('mid-expiry'),
      request = await make('mid-expiry', [id], 2),
      before = await counts(),
      state = await adapter.getSourceState(id);
    await sql(
      'create function public.watcher_test_intel_slow() returns trigger language plpgsql as $$begin perform pg_sleep(2.2);return new;end$$;create trigger watcher_test_intel_slow before insert on public.watcher_intelligence_units for each row execute function public.watcher_test_intel_slow();',
    );
    await assert.rejects(adapter.persistIntelligence(request), { code: 'STALE_LEASE' });
    assert.equal(await counts(), before);
    assert.deepEqual(await adapter.getSourceState(id), state);
    await sql(
      'drop trigger watcher_test_intel_slow on public.watcher_intelligence_units;drop function public.watcher_test_intel_slow();',
    );
  });
  await test('24B failure on second event rolls back earlier evaluations, evidence and receipt', async () => {
    const id = await fixture('rollback', [
        'Fiat lança o novo Pulse no Brasil',
        'Fiat lança o novo Fastback no Brasil',
      ]),
      request = await make('rollback', [id]),
      before = await counts(),
      state = await adapter.getSourceState(id);
    await sql(
      `create function public.watcher_test_intel_fail() returns trigger language plpgsql as $$begin if (select count(*) from public.watcher_intelligence_candidates where scope=${quote(request.payload.scope)})>0 then raise exception 'INJECTED_FAILURE';end if;return new;end$$;create trigger watcher_test_intel_fail before insert on public.watcher_intelligence_candidates for each row execute function public.watcher_test_intel_fail();`,
    );
    await assert.rejects(adapter.persistIntelligence(request), { code: 'PERSISTENCE_FAILED' });
    assert.equal(await counts(), before);
    assert.deepEqual(await adapter.getSourceState(id), state);
    await sql(
      'drop trigger watcher_test_intel_fail on public.watcher_intelligence_candidates;drop function public.watcher_test_intel_fail();',
    );
    const receipt = await adapter.persistIntelligence(request);
    assert.equal(receipt.candidateVersions.length, 2);
  });
  await test('24B cross-source revision substitution and forged literal locators are rejected', async () => {
    const id = await fixture('evidence'),
      request = await make('evidence', [id]),
      before = await counts();
    const bad = structuredClone(request);
    bad.payload.units[0].analysis.signals[0].evidence.start++;
    assert.equal((await raw(bad)).error.message, 'WATCHER_INVALID_EVIDENCE');
    assert.equal(await counts(), before);
    const other = await fixture('foreign-origin'),
      foreign = await make('foreign-origin', [other]);
    const result = await raw({ ...foreign, leases: request.leases });
    assert.ok(result.error);
    assert.equal(await counts(), before);
    await release(request);
    await release(foreign);
  });
  await test('24B SQL rejects null category payloads even if matching evidence is tampered consistently', async () => {
    const id = await fixture('null-signal'),
      request = await make('null-signal', [id]),
      before = await counts();
    const bad = structuredClone(request);
    bad.payload.units[0].analysis.signals[0].category = null;
    bad.payload.candidates[0].snapshot.category = null;
    bad.payload.candidates[0].snapshot.evidence[0].category = null;
    assert.equal((await raw(bad)).error.message, 'WATCHER_INVALID_SIGNAL');
    assert.equal(await counts(), before);
    await release(request);
  });
  await test('24B a canonical label change cannot silently reassign an existing event anchor', async () => {
    const id = await fixture('anchor'),
      first = await make('anchor', [id]);
    await adapter.persistIntelligence(first);
    const next = await make('anchor', [id]),
      context = structuredClone(next.payload.context);
    context.brands[0].canonicalName = 'Fiat Auto';
    context.brands[0].aliases = ['Fiat'];
    const changed = prepareWatcherIntelligenceCommit({
      commitId: randomUUID(),
      scope: next.payload.scope,
      leases: next.leases,
      context,
      documents: next.payload.units.map((u) => u.document),
      currentRevisionIds: next.payload.currentRevisionIds,
      currentPointers: next.payload.currentPointers,
      expectedCandidates: next.payload.candidates.map((c) => ({
        key: c.snapshot.key,
        version: c.expectedVersion,
        reviewVersion: c.expectedReviewVersion,
      })),
    });
    const before = await counts();
    await assert.rejects(adapter.persistIntelligence(changed), { code: 'CONTENT_CONFLICT' });
    assert.equal(await counts(), before);
    await release(next);
  });
  await test('24B concurrent legacy identity change cannot reassign an intelligence head', async () => {
    const id = await fixture('anchor-race'),
      first = await make('anchor-race', [id]);
    await adapter.persistIntelligence(first);
    await ingest(id, 'Fiat apresenta o novo Pulse no Brasil', '0');
    const request = await make('anchor-race', [id]),
      head = (await adapter.queryIntelligence('CANDIDATES', request.payload.scope))[0],
      original = JSON.parse(
        await sql(
          `select row_to_json(c)::text from public.watcher_candidates c where id=${quote(head.candidate_id)}::uuid;`,
        ),
      ),
      before = await counts(),
      state = await adapter.getSourceState(id),
      fences = request.leases.map((l) => ({
        sourceId: l.sourceId,
        token: l.token,
        configVersion: l.configVersion,
        stateVersion: l.stateVersion,
      }));
    await sql(
      'create function public.watcher_test_anchor_race() returns trigger language plpgsql as $$begin perform pg_sleep(4);return new;end$$;create trigger watcher_test_anchor_race before insert on public.watcher_intelligence_units for each row execute function public.watcher_test_anchor_race();',
    );
    const execution = sql(
      "set application_name='watcher_intel_anchor_race';set role service_role;select public.watcher_commit_intelligence(" +
        quote(request.commitId) +
        '::uuid,' +
        json(fences) +
        ',' +
        json(request.payload) +
        ');',
    ).then(
      () => '',
      (error) => String(error),
    );
    try {
      let waiting = '';
      for (let i = 0; i < 80; i++) {
        waiting = await sql(
          "select pid from pg_stat_activity where application_name='watcher_intel_anchor_race' and wait_event='PgSleep';",
        );
        if (waiting) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.match(waiting, /^\d+$/);
      const changedKey = watcherDigest('watcher-candidate/1', ['BR', 'fiat drift', 'pulse', null]);
      await sql(
        `update public.watcher_candidates set brand='Fiat Drift',identity_key=${quote(changedKey)},version=version+1 where id=${quote(head.candidate_id)}::uuid;`,
      );
      assert.match(await execution, /WATCHER_CONTENT_CONFLICT/);
      assert.equal(await counts(), before);
      assert.deepEqual(await adapter.getSourceState(id), state);
      assert.equal((await adapter.queryIntelligence('RECEIPTS', request.payload.scope)).length, 1);
    } finally {
      await execution;
      await sql(
        'drop trigger watcher_test_anchor_race on public.watcher_intelligence_units;drop function public.watcher_test_anchor_race();',
      );
      await sql(
        `update public.watcher_candidates set brand=${quote(original.brand)},identity_key=${quote(original.identity_key)},version=version+1 where id=${quote(head.candidate_id)}::uuid;`,
      );
      await release(request);
    }
  });
  await test('24B complete journal and authoritative current pointers are mandatory', async () => {
    const id = await fixture('coverage', [
        'Fiat lança o novo Pulse no Brasil',
        'Fiat lança o novo Fastback no Brasil',
      ]),
      request = await make('coverage', [id]),
      before = await counts();
    const partial = structuredClone(request);
    partial.payload.units.pop();
    assert.equal((await raw(partial)).error.message, 'WATCHER_STALE_STATE');
    const stale = structuredClone(request);
    stale.payload.currentRevisionIds = [];
    assert.equal((await raw(stale)).error.message, 'WATCHER_STALE_STATE');
    assert.equal(await counts(), before);
    await release(request);
  });
  let reviewed;
  await test('24B human review is append-only, fenced, idempotent and never catalog apply', async () => {
    reviewed = await reviewInput(firstRequest, firstReceipt);
    const answer = await adapter.reviewIntelligence(reviewed.leases, reviewed.command);
    assert.equal(answer.reviewVersion, 1);
    assert.equal(
      (await adapter.queryIntelligence('CANDIDATES', firstRequest.payload.scope))[0]
        .effective_status,
      'DISMISSED',
    );
    const before = await counts();
    const replay = await adapter.reviewIntelligence(reviewed.leases, reviewed.command);
    assert.equal(replay.replayed, true);
    assert.equal(await counts(), before);
    assert.equal(
      (await adapter.queryIntelligence('REVIEWS', firstRequest.payload.scope))[0].candidate_snapshot
        .applyAllowed,
      false,
    );
    const state = await adapter.getSourceState(firstId);
    const oldReplay = await adapter.persistIntelligence(firstRequest);
    assert.equal(oldReplay.replayed, true);
    assert.deepEqual(await adapter.getSourceState(firstId), state);
    assert.equal(
      (await adapter.queryIntelligence('CANDIDATES', firstRequest.payload.scope))[0].review_version,
      1,
    );
  });
  await test('24B stale automatic review expectation cannot overwrite a human decision', async () => {
    const request = await make('review-conflict', [firstId]);
    // First establish a fresh scope; its root is shared but its review history is isolated.
    const receipt = await adapter.persistIntelligence(request),
      review = await reviewInput(request, receipt);
    await adapter.reviewIntelligence(review.leases, review.command);
    // Change context to get a genuinely new evaluation, but retain the obsolete review guard.
    const next = await make('review-conflict', [firstId]);
    const changedContext = structuredClone(next.payload.context);
    changedContext.brands[0].aliases = ['Fiat Auto'];
    const automatic = prepareWatcherIntelligenceCommit({
      commitId: randomUUID(),
      scope: next.payload.scope,
      leases: next.leases,
      context: changedContext,
      documents: next.payload.units.map((u) => u.document),
      currentRevisionIds: next.payload.currentRevisionIds,
      currentPointers: next.payload.currentPointers,
      expectedCandidates: next.payload.candidates.map((c) => ({
        key: c.snapshot.key,
        version: c.expectedVersion,
        reviewVersion: 0,
      })),
    });
    await assert.rejects(adapter.persistIntelligence(automatic), { code: 'REVIEW_CONFLICT' });
    // A stale review is also checked directly through a new human command/fresh lease.
    const before = await counts();
    await assert.rejects(
      adapter.reviewIntelligence(next.leases, { ...review.command, reviewId: randomUUID() }),
      { code: 'REVIEW_CONFLICT' },
    );
    assert.equal(await counts(), before);
    await release(next);
  });
  await test('24B fresh leases and CAS guards still replay without erasing a newer human review', async () => {
    const fresh = await make('success', [firstId]),
      before = await counts(),
      state = await adapter.getSourceState(firstId);
    const answer = await adapter.persistIntelligence(fresh);
    assert.equal(answer.replayed, true);
    assert.equal(answer.commitId, firstReceipt.commitId);
    assert.equal(await counts(), before);
    assert.deepEqual(await adapter.getSourceState(firstId), state);
    const head = (await adapter.queryIntelligence('CANDIDATES', fresh.payload.scope))[0];
    assert.equal(head.effective_status, 'DISMISSED');
    assert.equal(head.review_current, true);
    assert.equal(head.review_version, 1);
    await release(fresh);
  });
  await test('24B backend termination rolls back all intelligence state and recovery first reads receipt', async () => {
    const id = await fixture('backend-crash'),
      request = await make('backend-crash', [id]),
      before = await counts(),
      state = await adapter.getSourceState(id);
    const fences = request.leases.map((l) => ({
      sourceId: l.sourceId,
      token: l.token,
      configVersion: l.configVersion,
      stateVersion: l.stateVersion,
    }));
    const execution = sql(
      "set application_name='watcher_intelligence_crash_test';set role service_role;begin;select public.watcher_commit_intelligence(" +
        quote(request.commitId) +
        '::uuid,' +
        json(fences) +
        ',' +
        json(request.payload) +
        ');select pg_sleep(30);commit;',
    ).then(
      () => true,
      () => false,
    );
    let pid = '';
    for (let i = 0; i < 80; i++) {
      pid = await sql(
        "select pid from pg_stat_activity where application_name='watcher_intelligence_crash_test' and wait_event='PgSleep';",
      );
      if (pid) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.match(pid, /^\d+$/);
    await sql('select pg_terminate_backend(' + pid + ');');
    assert.equal(await execution, false);
    assert.equal((await adapter.queryIntelligence('RECEIPTS', request.payload.scope)).length, 0);
    assert.equal(await counts(), before);
    assert.deepEqual(await adapter.getSourceState(id), state);
    assert.equal((await adapter.persistIntelligence(request)).replayed, false);
  });
  await test('24B failure in review rolls back history, review version and all fences', async () => {
    const id = await fixture('review-rollback'),
      request = await make('review-rollback', [id]),
      receipt = await adapter.persistIntelligence(request),
      review = await reviewInput(request, receipt),
      before = await counts(),
      state = await adapter.getSourceState(id);
    await sql(
      "create function public.watcher_test_review_fail() returns trigger language plpgsql as $$begin raise exception 'INJECTED_REVIEW_FAILURE';end$$;create trigger watcher_test_review_fail before insert on public.watcher_intelligence_reviews for each row execute function public.watcher_test_review_fail();",
    );
    await assert.rejects(adapter.reviewIntelligence(review.leases, review.command), {
      code: 'PERSISTENCE_FAILED',
    });
    assert.equal(await counts(), before);
    assert.deepEqual(await adapter.getSourceState(id), state);
    await sql(
      'drop trigger watcher_test_review_fail on public.watcher_intelligence_reviews;drop function public.watcher_test_review_fail();',
    );
    await adapter.reviewIntelligence(review.leases, review.command);
  });
  await test('24B concurrent reviewers produce one historical decision, not last-writer-wins', async () => {
    const id = await fixture('review-race'),
      request = await make('review-race', [id]),
      receipt = await adapter.persistIntelligence(request),
      review = await reviewInput(request, receipt);
    const results = await Promise.allSettled([
      adapter.reviewIntelligence(review.leases, review.command),
      adapter.reviewIntelligence(review.leases, {
        ...review.command,
        reviewId: randomUUID(),
        decision: 'ACCEPT',
      }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await adapter.queryIntelligence('REVIEWS', request.payload.scope)).length, 1);
  });
  await test('24B new article revision and A-B-A reversion preserve history and current lineage', async () => {
    const id = await fixture('revision'),
      initial = await make('revision', [id]);
    await adapter.persistIntelligence(initial);
    await ingest(id, 'Fiat não lança o novo Pulse no Brasil', '0');
    const second = await make('revision', [id]);
    await adapter.persistIntelligence(second);
    let head = (await adapter.queryIntelligence('CANDIDATES', initial.payload.scope))[0];
    assert.equal(head.effective_status, 'INSUFFICIENT');
    await ingest(id, 'Fiat lança o novo Pulse no Brasil', '0');
    const third = await make('revision', [id]);
    const answer = await adapter.persistIntelligence(third);
    head = (await adapter.queryIntelligence('CANDIDATES', initial.payload.scope))[0];
    assert.equal(head.effective_status, 'NEW');
    assert.equal(answer.scopeVersion, 3);
    assert.equal((await adapter.queryIntelligence('UNITS', initial.payload.scope)).length, 2);
    assert.equal((await adapter.queryIntelligence('RECEIPTS', initial.payload.scope)).length, 3);
  });
  await test('24B two sources commit atomically and scope source membership cannot shrink', async () => {
    const a = await fixture('multi-a'),
      b = await fixture('multi-b'),
      request = await make('multi', [b, a]);
    const answer = await adapter.persistIntelligence(request);
    assert.equal(answer.sourceVersions.length, 2);
    assert.equal(answer.candidateVersions.length, 1);
    assert.equal(
      (await adapter.queryIntelligence('CANDIDATES', request.payload.scope))[0].snapshot.evidence
        .length,
      2,
    );
    for (const id of [a, b]) assert.equal((await adapter.getSourceState(id)).lease, null);
    const smaller = await make('multi', [a]);
    await assert.rejects(adapter.persistIntelligence(smaller), { code: 'CONTENT_CONFLICT' });
    await release(smaller);
  });
  await test('24B UTF-16 literal evidence, including non-BMP characters, is verified in SQL', async () => {
    const id = await fixture('unicode', ['🚗 Fiat lança o novo Pulse no Brasil']);
    const request = await make('unicode', [id]);
    await adapter.persistIntelligence(request);
    assert.equal(await sql("select public.watcher_intelligence_slice('🚗 A',0,2);"), '🚗');
    assert.equal(await sql("select public.watcher_intelligence_slice('🚗 A',1,2) is null;"), 't');
    assert.equal(
      await sql("select public.watcher_intelligence_key('Citroën / NOVO');"),
      'citroen novo',
    );
  });
  await test('24B new compatible engine version has separate evaluation identity and no review overwrite', async () => {
    const id = await fixture('engine'),
      first = await make('engine', [id]),
      receipt = await adapter.persistIntelligence(first),
      review = await reviewInput(first, receipt);
    await adapter.reviewIntelligence(review.leases, review.command);
    const next = await make('engine', [id]),
      p = next.payload,
      signals = new Map();
    p.engineVersion = 'watcher-intelligence/2';
    for (const u of p.units) {
      u.key = watcherDigest('watcher-intelligence-unit/1', [
        u.document.revision.articleId,
        u.document.revision.id,
        p.engineVersion,
        p.scope,
        p.contextFingerprint,
      ]);
      for (const s of u.analysis.signals) {
        const old = s.fingerprint;
        s.fingerprint = watcherDigest('watcher-signal/1', ['compatible-future-engine', old]);
        s.evidence.ruleId = s.evidence.ruleId.replace(
          'watcher-intelligence/1:',
          'watcher-intelligence/2:',
        );
        for (const q of s.qualifiers)
          q.ruleId = q.ruleId.replace('watcher-intelligence/1:', 'watcher-intelligence/2:');
        signals.set(old, s);
        signals.set(s.fingerprint, s);
      }
    }
    p.units.sort((a, b) => a.key.localeCompare(b.key));
    for (const cw of p.candidates) {
      const c = cw.snapshot;
      c.evidence = c.evidence
        .map((s) => signals.get(s.fingerprint))
        .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
      c.activeSignalIds = c.activeSignalIds.map((s) => signals.get(s).fingerprint).sort();
      c.fingerprint = watcherDigest('watcher-candidate-snapshot/1', [
        c.key,
        c.evidence.map((s) => s.fingerprint),
        c.activeSignalIds,
        c.quality.score,
        c.quality.reasons,
      ]);
    }
    const result = await raw(next);
    assert.equal(result.error, null);
    assert.equal(result.data.scopeVersion, 2);
    const units = await adapter.queryIntelligence('UNITS', p.scope);
    assert.equal(units.length, 2);
    assert.equal(new Set(units.map((u) => u.engine_version)).size, 2);
    const head = (await adapter.queryIntelligence('CANDIDATES', p.scope))[0];
    assert.equal(head.review_version, 1);
    assert.equal(head.effective_status, 'REVIEW_REQUIRED');
    assert.equal(head.review_current, false);
    assert.equal((await adapter.queryIntelligence('REVIEWS', p.scope)).length, 1);
    const state = await adapter.getSourceState(id);
    await adapter.reviewIntelligence(review.leases, review.command);
    assert.deepEqual(await adapter.getSourceState(id), state);
  });
  await test('24B immutable audit records and 24A dismissal survive automatic projection', async () => {
    await assert.rejects(
      sql('update public.watcher_intelligence_receipts set payload_hash=payload_hash;'),
      /WATCHER_IMMUTABLE/,
    );
    await assert.rejects(
      sql('delete from public.watcher_intelligence_units;'),
      /WATCHER_IMMUTABLE/,
    );
    await assert.rejects(
      sql('update public.watcher_intelligence_reviews set note=note;'),
      /WATCHER_IMMUTABLE/,
    );
    const head = (await adapter.queryIntelligence('CANDIDATES', firstRequest.payload.scope))[0];
    await sql(
      `update public.watcher_candidates set status='DISMISSED',version=version+1 where id=${quote(head.candidate_id)}::uuid;`,
    );
    assert.equal(
      (await adapter.queryIntelligence('CANDIDATES', firstRequest.payload.scope))[0]
        .effective_status,
      'DISMISSED',
    );
    assert.equal(await sql('select count(*) from public.products;'), '1');
    assert.equal(await sql('select count(*) from public.catalog_mmvs;'), '1');
    assert.equal(
      await sql(
        "select has_table_privilege('service_role','public.products','UPDATE') or has_table_privilege('service_role','public.catalog_mmvs','INSERT');",
      ),
      'f',
    );
  });
}
