import { describe, expect, it, vi } from 'vitest';
import {
  assertWatcherQaTarget,
  createWatcherQaExecutor,
  WATCHER_QA_REF,
  WATCHER_QA_URL,
} from '../src/watcher-qa-safety';
const valid = () => ({
  APP_ENV: 'qa',
  WATCHER_ENVIRONMENT: 'qa',
  WATCHER_QA_PROJECT_REF: WATCHER_QA_REF,
  SUPABASE_URL: WATCHER_QA_URL,
  SUPABASE_SERVER_KEY: 'offline-fixture',
});
describe('Watcher mandatory QA boundary (offline)', () => {
  it('requires explicit QA identity without exposing SQL credentials', () => {
    expect(assertWatcherQaTarget(valid())).toEqual({
      environment: 'qa',
      projectRef: WATCHER_QA_REF,
      url: WATCHER_QA_URL,
    });
  });
  it('passes standard REST credentials to the existing RPC client without SQL configuration', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const factory = vi.fn(() => ({ rpc }));
    const executor = createWatcherQaExecutor(valid, factory);
    await executor.run((repository) => repository.listSources());
    expect(factory).toHaveBeenCalledWith({ url: WATCHER_QA_URL, serverKey: 'offline-fixture' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    {},
    { APP_ENV: undefined },
    { PGHOST: 'production.invalid' },
    { PGOPTIONS: '-c search_path=evil' },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { APP_ENV: 'production' },
    { WATCHER_ENVIRONMENT: 'staging' },
    { WATCHER_QA_PROJECT_REF: 'ltbeykzccckdwpzyeywu' },
    { SUPABASE_URL: 'https://ltbeykzccckdwpzyeywu.supabase.co' },
    { SUPABASE_URL: WATCHER_QA_URL + '/' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://production.invalid' },
    { SUPABASE_PROJECT_REF: 'different' },
    { AGENT_ENVIRONMENT: 'production' },
    { NEXT_PUBLIC_APP_ENV: 'staging' },
    { DATABASE_URL: 'postgres://production.invalid/postgres' },
    { SUPABASE_DB_URL: 'postgres://production.invalid/postgres' },
    { WATCHER_QA_SERVER_KEY: 'different' },
    { COMPRA_CAR_AGENT_ENV_FILE: 'production.env' },
    { DIRECT_URL: 'invalid' },
    {
      WATCHER_QA_SQL_URL:
        'postgres://postgres:secret@db.ltbeykzccckdwpzyeywu.supabase.co/postgres?sslmode=verify-full',
    },
    {
      WATCHER_QA_SQL_URL:
        'postgres://postgres:secret@db.' + WATCHER_QA_REF + '.supabase.co/postgres?sslmode=require',
    },
    {
      WATCHER_QA_SQL_URL:
        'postgres://postgres:secret@db.' +
        WATCHER_QA_REF +
        '.supabase.co/postgres?sslmode=verify-full&host=evil',
    },
    {
      WATCHER_QA_SQL_URL:
        'postgres://postgres:secret@db.' +
        WATCHER_QA_REF +
        '.supabase.co/postgres?sslmode=verify-full&sslmode=disable',
    },
    { SUPABASE_SERVER_KEY: undefined },
  ])('rejects invalid/conflicting config before constructing a client: %j', (patch) => {
    const factory = vi.fn();
    const env = Object.keys(patch).length ? { ...valid(), ...patch } : {};
    expect(() => createWatcherQaExecutor(() => env, factory)).toThrow(
      'WATCHER_QA_TARGET_NOT_VERIFIED',
    );
    expect(factory).not.toHaveBeenCalled();
  });
  it('checks every operation and RPC, including a repository retained by the callback', async () => {
    const env: Record<string, string | undefined> = valid();
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const executor = createWatcherQaExecutor(
      () => env,
      () => ({ rpc }),
    );
    const repository = await executor.run(async (repo) => repo);
    await repository.listSources();
    expect(rpc).toHaveBeenCalledTimes(1);
    env.APP_ENV = 'production';
    await expect(repository.claimLease('rss', 'collector')).rejects.toThrow();
    const action = vi.fn();
    await expect(executor.run(action)).rejects.toThrow();
    expect(action).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('blocks candidate/hint operations in the collection executor before dispatch', async () => {
    const rpc = vi.fn();
    const executor = createWatcherQaExecutor(valid, () => ({ rpc }));
    await expect(executor.run((repo) => repo.listCandidates())).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects credential drift without leaking the credential', async () => {
    const env = valid();
    const rpc = vi.fn();
    const executor = createWatcherQaExecutor(
      () => env,
      () => ({ rpc }),
    );
    env.SUPABASE_SERVER_KEY = 'new-secret';
    await expect(executor.run((repo) => repo.listSources())).rejects.toThrow(
      'WATCHER_QA_TARGET_NOT_VERIFIED',
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it('sanitizes client construction failures', () => {
    expect(() =>
      createWatcherQaExecutor(valid, () => {
        throw new Error('password=secret');
      }),
    ).toThrow('WATCHER_QA_TARGET_NOT_VERIFIED');
  });
});
