import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { planWatcherQaDeployment, runWatcherQaReadOnlyProcedure } from '../watcher-qa-deployment';
const root = resolve(import.meta.dirname, '../../..');
const ref = 'shfsjyjxmgwnlexmdkcs';
const env = {
  APP_ENV: 'qa',
  WATCHER_ENVIRONMENT: 'qa',
  WATCHER_QA_PROJECT_REF: ref,
  SUPABASE_URL: 'https://' + ref + '.supabase.co',
  WATCHER_QA_SQL_URL:
    'postgres://postgres:fixture@db.' + ref + '.supabase.co/postgres?sslmode=verify-full',
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
  it.each(['hash', 'path', 'order', 'extra', 'project'])(
    'rejects manifest tampering: %s',
    async (kind) => {
      const read = vi.fn(async (path: string) => {
        const bytes = await readFile(path);
        if (!path.endsWith('qa-migrations.json')) return bytes;
        const manifest = JSON.parse(bytes.toString());
        if (kind === 'hash') manifest.migrations[0].sha256 = '0'.repeat(64);
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
  it('rejects a remote procedure before any connection when QA is absent', async () => {
    const connect = vi.fn();
    await expect(
      runWatcherQaReadOnlyProcedure(root, () => ({}), 'preflight', connect),
    ).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });
  it('passes only verified QA SQL configuration to the injected read-only connector', async () => {
    const connect = vi.fn(
      async (config: { readOnly: boolean; rejectUnauthorized: boolean }, sql: string) => {
        expect(config).toMatchObject({ readOnly: true, rejectUnauthorized: true });
        expect(sql).toContain('begin read only;');
        return 'offline-result';
      },
    );
    expect(await runWatcherQaReadOnlyProcedure(root, () => env, 'preflight', connect)).toBe(
      'offline-result',
    );
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('rechecks target after preparing the plan and before connecting', async () => {
    let calls = 0;
    const environment = () => (++calls === 1 ? env : { ...env, APP_ENV: 'production' });
    const connect = vi.fn();
    await expect(
      runWatcherQaReadOnlyProcedure(root, environment, 'preflight', connect),
    ).rejects.toThrow('WATCHER_QA_TARGET_NOT_VERIFIED');
    expect(connect).not.toHaveBeenCalled();
  });
  it('never forwards a connector error containing credentials', async () => {
    await expect(
      runWatcherQaReadOnlyProcedure(
        root,
        () => env,
        'postflight',
        async () => {
          throw new Error('password=secret');
        },
      ),
    ).rejects.toThrow('WATCHER_QA_READ_ONLY_PROCEDURE_FAILED');
  });
});
