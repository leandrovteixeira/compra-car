import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  planWatcherQaDeployment,
  prepareWatcherQaApiDeployment,
  runWatcherQaApiPreflight,
} from '../watcher-qa-deployment';
const root = resolve(import.meta.dirname, '../../..');
const ref = 'shfsjyjxmgwnlexmdkcs';
const env = {
  APP_ENV: 'qa',
  WATCHER_ENVIRONMENT: 'qa',
  WATCHER_QA_PROJECT_REF: ref,
  SUPABASE_URL: 'https://' + ref + '.supabase.co',
  SUPABASE_SERVER_KEY: 'fixture-server',
  SUPABASE_ACCESS_TOKEN: 'fixture-management',
};
describe('Watcher deployment allowlist - no database access', () => {
  it('verifies both real local hashes and emits only a sanitized plan', async () => {
    const plan = await planWatcherQaDeployment(root, env);
    expect(plan.migrations).toHaveLength(2);
    expect(plan.mode).toBe('OFFLINE_PLAN_ONLY');
    expect(JSON.stringify(plan)).not.toContain('fixture');
  });
  it('rejects missing or production targets before even reading artifacts', async () => {
    const read = vi.fn();
    await expect(planWatcherQaDeployment(root, {}, read)).rejects.toThrow();
    await expect(
      planWatcherQaDeployment(root, { ...env, APP_ENV: 'production' }, read),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it.each(['hash', 'path', 'order', 'extra', 'project', 'both'])(
    'rejects manifest tampering: %s',
    async (kind) => {
      const read = vi.fn(async (path: string) => {
        const bytes = await readFile(path);
        if (!path.endsWith('qa-migrations.json'))
          return kind === 'both' ? Buffer.from('altered') : bytes;
        const manifest = JSON.parse(bytes.toString());
        if (kind === 'hash') manifest.migrations[0].sha256 = '0'.repeat(64);
        if (kind === 'both')
          for (const entry of manifest.migrations)
            entry.sha256 = createHash('sha256').update('altered').digest('hex');
        if (kind === 'path') manifest.migrations[0].path = '../production.sql';
        if (kind === 'order') manifest.migrations.reverse();
        if (kind === 'extra') manifest.migrations.push(manifest.migrations[0]);
        if (kind === 'project') manifest.projectRef = 'production';
        return Buffer.from(JSON.stringify(manifest));
      });
      await expect(planWatcherQaDeployment(root, env, read)).rejects.toThrow(
        'WATCHER_QA_MANIFEST_REJECTED',
      );
    },
  );
  it('prepares exact ordered API descriptors without SQL, tokens or network requests', async () => {
    const plan = await prepareWatcherQaApiDeployment(root, env);
    expect(plan.mode).toBe('API_DEPLOYMENT_PREPARED_NOT_APPLIED');
    expect(plan.applicationRequiresSeparateAuthorization).toBe(true);
    expect(plan.steps.map((s) => s.sourceVersion)).toEqual(['20261025220424', '20261025220427']);
    expect(
      plan.steps.every(
        (s) => s.endpoint === `https://api.supabase.com/v1/projects/${ref}/database/migrations`,
      ),
    ).toBe(true);
    expect(JSON.stringify(plan)).not.toContain('fixture');
  });
  it('rejects an absent QA target or absent Management token before HTTP', async () => {
    const transport = vi.fn();
    await expect(runWatcherQaApiPreflight(root, () => ({}), transport)).rejects.toThrow();
    await expect(
      runWatcherQaApiPreflight(
        root,
        () => ({ ...env, SUPABASE_ACCESS_TOKEN: undefined }),
        transport,
      ),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('rechecks identity after local manifest verification', async () => {
    let calls = 0;
    const transport = vi.fn();
    await expect(
      runWatcherQaApiPreflight(
        root,
        () => (++calls === 1 ? env : { ...env, APP_ENV: 'production' }),
        transport,
      ),
    ).rejects.toThrow('WATCHER_QA_TARGET_NOT_VERIFIED');
    expect(transport).not.toHaveBeenCalled();
  });
});

const clean = {
  database_name: 'postgres',
  database_role: 'supabase_read_only_user',
  postgres_version_num: 170006,
  read_only: true,
  required_roles_present: true,
  service_bypassrls: true,
  service_usage: true,
  watcher_relation_count: 0,
  watcher_function_count: 0,
  watcher_policy_count: 0,
  watcher_rls_disabled_count: 0,
  watcher_browser_grant_count: 0,
  enabled_event_trigger_count: 0,
  default_acl_browser_grant_count: 0,
};
function mockTransport(row: unknown = clean, history: unknown = []) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json([row]))
    .mockResolvedValueOnce(Response.json(history));
}
describe('Management API preflight assessment', () => {
  it('uses only the read-only endpoint and migration-history GET; returns sanitized metadata', async () => {
    const transport = mockTransport({ ...clean, extra: 'must-not-emit' });
    const report = await runWatcherQaApiPreflight(root, () => env, transport);
    expect(report.recommendation).toBe('GO_FOR_SEPARATE_REVIEW');
    expect(JSON.stringify(report)).not.toContain('must-not-emit');
    expect(transport.mock.calls.map((c) => [c[0], c[1]?.method])).toEqual([
      [`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`, 'POST'],
      [`https://api.supabase.com/v1/projects/${ref}/database/migrations`, 'GET'],
    ]);
    const query = JSON.parse(transport.mock.calls[0][1]!.body as string).query;
    expect(query).toContain('pg_catalog.pg_roles');
    expect(query).not.toMatch(/\b(?:begin|commit|create|insert|update|delete|grant|revoke)\b/iu);
  });
  it('rejects partial, invalid and non-read-only-role responses', async () => {
    for (const row of [
      {},
      { ...clean, database_role: 'postgres' },
      { ...clean, watcher_relation_count: '0' },
      { ...clean, read_only: undefined },
    ])
      await expect(runWatcherQaApiPreflight(root, () => env, mockTransport(row))).rejects.toThrow(
        'WATCHER_QA_PREFLIGHT_RESPONSE_REJECTED',
      );
    await expect(
      runWatcherQaApiPreflight(root, () => env, mockTransport(clean, {})),
    ).rejects.toThrow('WATCHER_QA_PREFLIGHT_RESPONSE_REJECTED');
  });
  it('blocks existing objects, functions, policies, grants, event triggers and unsafe prerequisites', async () => {
    for (const patch of [
      { watcher_relation_count: 1 },
      { watcher_function_count: 1 },
      { watcher_policy_count: 1 },
      { watcher_rls_disabled_count: 1 },
      { watcher_browser_grant_count: 1 },
      { enabled_event_trigger_count: 1 },
      { default_acl_browser_grant_count: 1 },
      { read_only: false },
      { service_bypassrls: false },
      { service_usage: false },
      { required_roles_present: false },
    ]) {
      const report = await runWatcherQaApiPreflight(
        root,
        () => env,
        mockTransport({ ...clean, ...patch }),
      );
      expect(report.recommendation).toBe('NO_GO');
      expect(report.blockers).toHaveLength(1);
    }
  });
  it('detects both original versions and Management-generated versions with approved migration names', async () => {
    for (const entry of [
      { version: '20261025220424', name: 'old' },
      { version: '20990101000000', name: '20261025220427_sprint_24a3a_watcher_transactions' },
    ]) {
      const report = await runWatcherQaApiPreflight(root, () => env, mockTransport(clean, [entry]));
      expect(report.blockers).toContain('MIGRATION_HISTORY_CONFLICT');
    }
  });
  it('does not forward HTTP failures containing secrets or retry on a writable endpoint', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive-response'));
    await expect(runWatcherQaApiPreflight(root, () => env, transport)).rejects.toThrow(
      /^WATCHER_QA_MANAGEMENT_REJECTED$/u,
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
