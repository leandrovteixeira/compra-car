import { createLegacySupabaseClient } from './client';
import { WatcherSupabaseAdapter, type WatcherRpcClient } from './watcher-supabase-adapter';

export const WATCHER_QA_REF = 'shfsjyjxmgwnlexmdkcs';
export const WATCHER_QA_URL = 'https://' + WATCHER_QA_REF + '.supabase.co';
export type WatcherQaEnvironment = Readonly<Record<string, string | undefined>>;
const reject = (): never => {
  throw new Error('WATCHER_QA_TARGET_NOT_VERIFIED');
};
/** Pure, fail-closed. Never reads files, connects, prints values or infers QA from a credential. */
export function assertWatcherQaTarget(env: WatcherQaEnvironment) {
  if (
    env.APP_ENV !== 'qa' ||
    env.WATCHER_ENVIRONMENT !== 'qa' ||
    env.WATCHER_QA_PROJECT_REF !== WATCHER_QA_REF ||
    env.SUPABASE_URL !== WATCHER_QA_URL
  )
    reject();
  for (const key of ['NEXT_PUBLIC_APP_ENV', 'AGENT_ENVIRONMENT'])
    if (env[key] !== undefined && env[key] !== 'qa') reject();
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL'])
    if (env[key] !== undefined && env[key] !== WATCHER_QA_URL) reject();
  for (const key of ['SUPABASE_PROJECT_REF', 'SUPABASE_PROJECT_ID'])
    if (env[key] !== undefined && env[key] !== WATCHER_QA_REF) reject();
  // No implicit dotenv/agent-file or generic credential fallback in operational commands.
  if (env.COMPRA_CAR_AGENT_ENV_FILE || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return reject();
  for (const key of [
    'PGHOST',
    'PGHOSTADDR',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
    'PGSERVICE',
    'PGSERVICEFILE',
    'PGOPTIONS',
    'PGSSLMODE',
  ])
    if (env[key] !== undefined) return reject();
  const sqlUrl = env.WATCHER_QA_SQL_URL;
  if (!sqlUrl) return reject();
  let sql: URL;
  try {
    sql = new URL(sqlUrl);
  } catch {
    return reject();
  }
  if (
    !['postgres:', 'postgresql:'].includes(sql.protocol) ||
    sql.hostname !== 'db.' + WATCHER_QA_REF + '.supabase.co' ||
    (sql.port !== '' && sql.port !== '5432') ||
    sql.pathname !== '/postgres' ||
    sql.username !== 'postgres' ||
    !sql.password ||
    sql.hash ||
    sql.searchParams.get('sslmode') !== 'verify-full' ||
    [...sql.searchParams.keys()].some((k) => k !== 'sslmode') ||
    sql.searchParams.getAll('sslmode').length !== 1
  )
    reject();
  for (const key of [
    'DATABASE_URL',
    'SUPABASE_DB_URL',
    'POSTGRES_URL',
    'SUPABASE_DB_CONNECTION_STRING',
  ])
    if (env[key] !== undefined && env[key] !== env.WATCHER_QA_SQL_URL) reject();
  for (const key of ['SUPABASE_SERVER_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    if (env[key] !== undefined && env[key] !== env.WATCHER_QA_SERVER_KEY) reject();
  return Object.freeze({
    environment: 'qa' as const,
    projectRef: WATCHER_QA_REF,
    url: WATCHER_QA_URL,
  });
}
/** Operational entry point. Guard runs before client construction, callback, and EVERY RPC.
 * Low-level adapter remains injectable for disposable integration tests. No CLI can bypass
 * the guard by inheriting a production env file; callers must use explicit QA configuration.
 */
export function createWatcherQaExecutor(
  environment: () => WatcherQaEnvironment,
  factory: (config: {
    url: string;
    serverKey: string;
  }) => WatcherRpcClient = createLegacySupabaseClient,
) {
  const initial = { ...environment() };
  assertWatcherQaTarget(initial);
  const serverKey = initial.WATCHER_QA_SERVER_KEY;
  if (!serverKey?.trim()) return reject();
  let client: WatcherRpcClient;
  try {
    client = factory({ url: WATCHER_QA_URL, serverKey });
  } catch {
    return reject();
  }
  const verify = () => {
    const current = environment();
    assertWatcherQaTarget(current);
    if (
      current.WATCHER_QA_SERVER_KEY !== initial.WATCHER_QA_SERVER_KEY ||
      current.WATCHER_QA_SQL_URL !== initial.WATCHER_QA_SQL_URL
    )
      reject();
  };
  const allowed = new Set([
    'watcher_register_source',
    'watcher_claim_source',
    'watcher_release_source',
    'watcher_persist_batch',
    'watcher_query',
  ]);
  const adapter = new WatcherSupabaseAdapter({
    rpc(name, args) {
      verify();
      // Candidate review/hints remain disabled in the collection executor.
      if (
        !allowed.has(name) ||
        (name === 'watcher_query' &&
          ![
            'SOURCES',
            'STATE',
            'ARTICLES',
            'REVISIONS',
            'SOURCE_ITEMS',
            'SOURCE_REVISIONS',
            'BATCHES',
          ].includes(String(args.p_kind)))
      )
        throw new Error('WATCHER_QA_OPERATION_NOT_ALLOWED');
      return client.rpc(name, args);
    },
  });
  return Object.freeze({
    async run<T>(operation: (repository: WatcherSupabaseAdapter) => Promise<T>) {
      verify();
      return operation(adapter);
    },
  });
}
