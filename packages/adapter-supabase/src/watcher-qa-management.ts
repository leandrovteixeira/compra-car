import {
  assertWatcherQaTarget,
  WATCHER_QA_REF,
  type WatcherQaEnvironment,
} from './watcher-qa-safety';

export const WATCHER_QA_MANAGEMENT_URL = `https://api.supabase.com/v1/projects/${WATCHER_QA_REF}`;
const reject = (): never => {
  throw new Error('WATCHER_QA_MANAGEMENT_REJECTED');
};

/** Read-only HTTPS capabilities only. No generic query endpoint or migration write method. */
export function createWatcherQaManagementReader(
  environment: () => WatcherQaEnvironment,
  transport: typeof fetch = fetch,
) {
  const initial = { ...environment() };
  assertWatcherQaTarget(initial);
  const token = initial.SUPABASE_ACCESS_TOKEN;
  if (!token?.trim()) throw new Error('WATCHER_QA_MANAGEMENT_TOKEN_REQUIRED');
  if (/\s/u.test(token) || token === initial.SUPABASE_SERVER_KEY) return reject();
  const verify = () => {
    const current = environment();
    assertWatcherQaTarget(current);
    if (
      current.SUPABASE_ACCESS_TOKEN !== token ||
      current.SUPABASE_SERVER_KEY !== initial.SUPABASE_SERVER_KEY
    )
      return reject();
  };
  const request = async (
    path: '/database/query/read-only' | '/database/migrations',
    query?: string,
  ): Promise<unknown> => {
    verify();
    try {
      const response = await transport(WATCHER_QA_MANAGEMENT_URL + path, {
        method: query === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(query === undefined ? {} : { body: JSON.stringify({ query }) }),
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
      verify();
      if (!response.ok || response.redirected) return reject();
      const result: unknown = await response.json();
      verify();
      return result;
    } catch {
      return reject();
    }
  };
  return Object.freeze({
    readOnlyQuery: (query: string) => request('/database/query/read-only', query),
    migrationHistory: () => request('/database/migrations'),
  });
}
