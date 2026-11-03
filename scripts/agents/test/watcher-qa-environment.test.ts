import { describe, expect, it, vi } from 'vitest';
import { loadWatcherQaEnvironment } from '../watcher-qa-environment';
import { assertWatcherQaTarget } from '@compra-car/adapter-supabase/watcher-qa';
const ref = 'shfsjyjxmgwnlexmdkcs';
const fixture = (extra = '') =>
  `APP_ENV=staging\nNEXT_PUBLIC_APP_ENV=staging\nSUPABASE_URL=https://${ref}.supabase.co\nNEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co\nSUPABASE_SERVER_KEY=fixture-server\n${extra}`;
const read = async () => fixture();
describe('Watcher QA API environment', () => {
  it('reads the approved file, imports the REST key and needs no SQL credentials', async () => {
    const reader = vi.fn(read);
    const original = { ...process.env };
    const env = await loadWatcherQaEnvironment({}, reader);
    expect(reader).toHaveBeenCalledWith('C:/Dev/.secrets/compra-car/staging.env');
    expect(env.SUPABASE_SERVER_KEY).toBe('fixture-server');
    expect(env.WATCHER_QA_SQL_URL).toBeUndefined();
    expect(assertWatcherQaTarget(env).projectRef).toBe(ref);
    expect(process.env).toEqual(original);
  });
  it('never imports the old PostgreSQL password', async () => {
    const env = await loadWatcherQaEnvironment({}, async () =>
      fixture('SUPABASE_POSTGRES_PASSWORD=unused'),
    );
    expect(env.SUPABASE_POSTGRES_PASSWORD).toBeUndefined();
    expect(env.WATCHER_QA_SQL_URL).toBeUndefined();
  });
  it('keeps a separate Management token without a REST-key fallback', async () => {
    const env = await loadWatcherQaEnvironment({}, async () =>
      fixture('SUPABASE_ACCESS_TOKEN=fixture-management'),
    );
    expect(env.SUPABASE_ACCESS_TOKEN).toBe('fixture-management');
    expect((await loadWatcherQaEnvironment({}, read)).SUPABASE_ACCESS_TOKEN).toBeUndefined();
  });
  it('sanitizes unreadable files and rejects incomplete/non-QA files', async () => {
    await expect(
      loadWatcherQaEnvironment({}, async () => {
        throw new Error('sensitive');
      }),
    ).rejects.toThrow(/^WATCHER_QA_CONFIGURATION_REJECTED$/u);
    for (const content of [
      '',
      fixture() + '\0',
      fixture().replace('SUPABASE_SERVER_KEY=fixture-server', ''),
      fixture().replace('APP_ENV=staging', 'APP_ENV=production'),
      fixture().replaceAll(ref, 'other'),
    ])
      await expect(loadWatcherQaEnvironment({}, async () => content)).rejects.toThrow(
        /^WATCHER_QA_CONFIGURATION_REJECTED$/u,
      );
  });
  it('rejects inherited conflicts, SQL settings and unrelated management tokens', async () => {
    for (const patch of [
      { APP_ENV: 'production' },
      { NEXT_PUBLIC_APP_ENV: 'staging' },
      { SUPABASE_URL: 'https://other.invalid' },
      { WATCHER_QA_PROJECT_REF: 'other' },
      { SUPABASE_PROJECT_ID: 'other' },
      { NEXT_PUBLIC_SUPABASE_URL: 'https://other.invalid' },
      { AGENT_ENVIRONMENT: 'production' },
      { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      { COMPRA_CAR_AGENT_ENV_FILE: 'unapproved.env' },
      { PGHOST: 'other.invalid' },
      { PGPASSWORD: 'fixture' },
      { DATABASE_URL: 'invalid' },
      { DIRECT_URL: 'invalid' },
      { POSTGRES_PASSWORD: 'fixture' },
      { SUPABASE_DB_PASSWORD: 'fixture' },
      { SUPABASE_SERVER_KEY: 'different' },
      { WATCHER_QA_SQL_URL: 'invalid' },
      { SUPABASE_POSTGRES_PASSWORD: 'different' },
      { SUPABASE_ACCESS_TOKEN: 'inherited' },
    ])
      await expect(loadWatcherQaEnvironment(patch, read)).rejects.toThrow(
        /^WATCHER_QA_CONFIGURATION_REJECTED$/u,
      );
  });
  it('does not allow process overrides to hide unsafe file settings', async () => {
    for (const extra of [
      'PGHOST=other.invalid',
      'DIRECT_URL=invalid',
      'WATCHER_QA_PROJECT_REF=other',
      'WATCHER_QA_SQL_URL=invalid',
      'NODE_TLS_REJECT_UNAUTHORIZED=0',
      'SUPABASE_PROJECT_REF=other',
      'SUPABASE_SERVICE_ROLE_KEY=different',
    ])
      await expect(
        loadWatcherQaEnvironment({ WATCHER_QA_PROJECT_REF: ref }, async () => fixture(extra)),
      ).rejects.toThrow(/^WATCHER_QA_CONFIGURATION_REJECTED$/u);
  });
});
