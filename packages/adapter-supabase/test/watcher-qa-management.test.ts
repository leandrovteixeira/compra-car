import { describe, expect, it, vi } from 'vitest';
import {
  createWatcherQaManagementReader,
  WATCHER_QA_MANAGEMENT_URL,
} from '../src/watcher-qa-management';
const valid = () => ({
  APP_ENV: 'qa',
  WATCHER_ENVIRONMENT: 'qa',
  WATCHER_QA_PROJECT_REF: 'shfsjyjxmgwnlexmdkcs',
  SUPABASE_URL: 'https://shfsjyjxmgwnlexmdkcs.supabase.co',
  SUPABASE_SERVER_KEY: 'fixture-server',
  SUPABASE_ACCESS_TOKEN: 'fixture-management',
});
describe('QA Management API read-only capability', () => {
  it('pins HTTPS, redirects, timeout and bearer type; exports no write capability', async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([]));
    const reader = createWatcherQaManagementReader(valid, transport);
    await reader.readOnlyQuery('select 1');
    await reader.migrationHistory();
    expect(Object.keys(reader).sort()).toEqual(['migrationHistory', 'readOnlyQuery']);
    expect(transport.mock.calls[0][0]).toBe(
      WATCHER_QA_MANAGEMENT_URL + '/database/query/read-only',
    );
    expect(transport.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer fixture-management' },
    });
    expect(transport.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(transport.mock.calls[1][1]?.method).toBe('GET');
    expect(transport.mock.calls[1][1]?.body).toBeUndefined();
  });
  it('rejects invalid targets, SQL aliases, absent tokens and API-key substitution before transport', () => {
    const transport = vi.fn();
    for (const patch of [
      { APP_ENV: 'production' },
      { SUPABASE_URL: 'https://other.invalid' },
      { WATCHER_QA_SQL_URL: 'invalid' },
      { SUPABASE_ACCESS_TOKEN: undefined },
      { SUPABASE_ACCESS_TOKEN: 'fixture-server' },
      { SUPABASE_ACCESS_TOKEN: 'invalid\nheader' },
    ]) {
      expect(() =>
        createWatcherQaManagementReader(() => ({ ...valid(), ...patch }), transport),
      ).toThrow();
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects drift before every call and after the response', async () => {
    const env = valid();
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      env.SUPABASE_ACCESS_TOKEN = 'changed';
      return Response.json([]);
    });
    const reader = createWatcherQaManagementReader(() => env, transport);
    await expect(reader.readOnlyQuery('select 1')).rejects.toThrow(
      'WATCHER_QA_MANAGEMENT_REJECTED',
    );
    await expect(reader.migrationHistory()).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('sanitizes authorization, redirect, rate-limit, server and malformed-body failures without retry', async () => {
    for (const response of [
      new Response('sensitive', { status: 401 }),
      new Response('sensitive', { status: 403 }),
      new Response('sensitive', { status: 429 }),
      new Response('sensitive', { status: 500 }),
      new Response('sensitive', { status: 302, headers: { Location: 'https://other.invalid' } }),
      new Response('not-json'),
    ]) {
      const transport = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        createWatcherQaManagementReader(valid, transport).readOnlyQuery('select 1'),
      ).rejects.toThrow(/^WATCHER_QA_MANAGEMENT_REJECTED$/u);
      expect(transport).toHaveBeenCalledTimes(1);
    }
  });
});
