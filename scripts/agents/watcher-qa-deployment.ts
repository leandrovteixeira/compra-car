import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createWatcherQaManagementReader } from '@compra-car/adapter-supabase/watcher-qa-management';
import {
  assertWatcherQaTarget,
  WATCHER_QA_REF,
  WATCHER_QA_URL,
  type WatcherQaEnvironment,
} from '@compra-car/adapter-supabase/watcher-qa';

const permitted = [
  'supabase/migrations/20261025220424_sprint_24a3a_watcher_storage.sql',
  'supabase/migrations/20261025220427_sprint_24a3a_watcher_transactions.sql',
] as const;
const approvedHashes = [
  '0d43e3f5473b08e7b0cb4b2eca30567069c108ecc7946433354997dd80d31e23',
  '41b2a300a53291b44bfd62dda293a6c31ec2e3b9475361c35e0cf2d3ee9a0f06',
] as const;
/** Offline plan only. Has no database driver, SQL connection, feed transport or dotenv loader. */
export async function planWatcherQaDeployment(
  root: string,
  env: WatcherQaEnvironment,
  read: (path: string) => Promise<Buffer> = readFile,
) {
  const target = assertWatcherQaTarget(env);
  const manifest = JSON.parse(
    (await read(resolve(root, 'scripts/watcher/qa-migrations.json'))).toString('utf8'),
  );
  const fail = () => {
    throw new Error('WATCHER_QA_MANIFEST_REJECTED');
  };
  if (
    manifest.schemaVersion !== 'watcher-qa-migrations/1' ||
    manifest.environment !== 'qa' ||
    manifest.projectRef !== WATCHER_QA_REF ||
    manifest.supabaseUrl !== WATCHER_QA_URL ||
    !Array.isArray(manifest.migrations) ||
    manifest.migrations.length !== permitted.length
  )
    fail();
  const migrations: { path: string; sha256: string }[] = [];
  for (let i = 0; i < permitted.length; i++) {
    const entry = manifest.migrations[i];
    if (!entry || entry.path !== permitted[i] || entry.sha256 !== approvedHashes[i]) fail();
    const hash = createHash('sha256')
      .update(await read(resolve(root, permitted[i])))
      .digest('hex');
    if (hash !== entry.sha256) fail();
    migrations.push({ path: permitted[i], sha256: hash });
  }
  // Do not emit SQL URL, key, raw environment, content or credential-containing errors.
  return { ...target, mode: 'OFFLINE_PLAN_ONLY', migrations };
}

/** Prepares approved administrative requests; never sends them. No application CLI exists. */
export async function prepareWatcherQaApiDeployment(root: string, env: WatcherQaEnvironment) {
  const plan = await planWatcherQaDeployment(root, env);
  return {
    ...plan,
    mode: 'API_DEPLOYMENT_PREPARED_NOT_APPLIED' as const,
    applicationRequiresSeparateAuthorization: true,
    steps: plan.migrations.map((migration) => ({
      ...migration,
      sourceVersion: migration.path.split('/').at(-1)!.split('_')[0],
      method: 'POST' as const,
      endpoint: `https://api.supabase.com/v1/projects/${WATCHER_QA_REF}/database/migrations`,
      name: migration.path
        .split('/')
        .at(-1)!
        .replace(/\.sql$/u, ''),
      querySource: migration.path,
      authorization: 'SCOPED_MANAGEMENT_ACCESS_TOKEN_REQUIRED',
    })),
  };
}

/** API-only preflight. The adapter rechecks target and credentials before every request. */
export async function runWatcherQaApiPreflight(
  root: string,
  environment: () => WatcherQaEnvironment,
  transport: typeof fetch = fetch,
) {
  const initial = { ...environment() };
  await planWatcherQaDeployment(root, initial);
  const sql = await readFile(resolve(root, 'scripts/watcher/qa-preflight-api.sql'), 'utf8');
  const current = environment();
  assertWatcherQaTarget(current);
  if (
    current.SUPABASE_SERVER_KEY !== initial.SUPABASE_SERVER_KEY ||
    current.SUPABASE_ACCESS_TOKEN !== initial.SUPABASE_ACCESS_TOKEN
  )
    throw new Error('WATCHER_QA_TARGET_NOT_VERIFIED');
  const reader = createWatcherQaManagementReader(environment, transport);
  const raw = await reader.readOnlyQuery(sql);
  const history = await reader.migrationHistory();
  const invalid = (): never => {
    throw new Error('WATCHER_QA_PREFLIGHT_RESPONSE_REJECTED');
  };
  if (
    !Array.isArray(raw) ||
    raw.length !== 1 ||
    !raw[0] ||
    typeof raw[0] !== 'object' ||
    !Array.isArray(history)
  )
    return invalid();
  const row = raw[0] as Record<string, unknown>;
  const booleanKeys = ['read_only', 'required_roles_present', 'service_bypassrls', 'service_usage'];
  const countKeys = [
    'watcher_relation_count',
    'watcher_function_count',
    'watcher_policy_count',
    'watcher_rls_disabled_count',
    'watcher_browser_grant_count',
    'enabled_event_trigger_count',
    'default_acl_browser_grant_count',
  ];
  if (
    row.database_name !== 'postgres' ||
    row.database_role !== 'supabase_read_only_user' ||
    typeof row.postgres_version_num !== 'number' ||
    !Number.isInteger(row.postgres_version_num) ||
    row.postgres_version_num < 140000 ||
    booleanKeys.some((key) => typeof row[key] !== 'boolean') ||
    countKeys.some(
      (key) =>
        typeof row[key] !== 'number' || !Number.isSafeInteger(row[key]) || (row[key] as number) < 0,
    )
  )
    return invalid();
  const conflicts = history.filter((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return invalid();
    const item = entry as Record<string, unknown>;
    if (typeof item.version !== 'string' || typeof item.name !== 'string') return invalid();
    return (
      ['20261025220424', '20261025220427'].includes(item.version) ||
      /(?:sprint_24a3a_watcher_storage|sprint_24a3a_watcher_transactions)/u.test(item.name)
    );
  });
  const blockers = [
    ...booleanKeys.filter((key) => row[key] !== true).map((key) => key.toUpperCase()),
    ...countKeys.filter((key) => row[key] !== 0).map((key) => key.toUpperCase()),
    ...(conflicts.length ? ['MIGRATION_HISTORY_CONFLICT'] : []),
  ];
  return {
    projectRef: WATCHER_QA_REF,
    transport: 'SUPABASE_MANAGEMENT_API' as const,
    readOnly: row.read_only,
    postgresVersion: row.postgres_version_num,
    counters: Object.fromEntries(countKeys.map((key) => [key, row[key]])),
    historyConflicts: conflicts.length,
    recommendation: blockers.length ? ('NO_GO' as const) : ('GO_FOR_SEPARATE_REVIEW' as const),
    blockers,
  };
}
