import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
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
    if (!entry || entry.path !== permitted[i] || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail();
    const hash = createHash('sha256')
      .update(await read(resolve(root, permitted[i])))
      .digest('hex');
    if (hash !== entry.sha256) fail();
    migrations.push({ path: permitted[i], sha256: hash });
  }
  // Do not emit SQL URL, key, raw environment, content or credential-containing errors.
  return { ...target, mode: 'OFFLINE_PLAN_ONLY', migrations };
}

/** Future read-only pre/postflight connection boundary. No connector is bundled or invoked
 * by the offline CLI. The approved connector must enforce read-only transactions and verify TLS.
 */
export async function runWatcherQaReadOnlyProcedure<T>(
  root: string,
  environment: () => WatcherQaEnvironment,
  kind: 'preflight' | 'postflight',
  connectAndRead: (
    config: { connectionString: string; readOnly: true; rejectUnauthorized: true },
    sql: string,
  ) => Promise<T>,
) {
  const initial = { ...environment() };
  await planWatcherQaDeployment(root, initial);
  if (!['preflight', 'postflight'].includes(kind)) throw new Error('WATCHER_QA_PROCEDURE_REJECTED');
  const sql = await readFile(resolve(root, 'scripts/watcher/qa-' + kind + '.sql'), 'utf8');
  const current = environment();
  assertWatcherQaTarget(current);
  if (current.WATCHER_QA_SQL_URL !== initial.WATCHER_QA_SQL_URL)
    throw new Error('WATCHER_QA_TARGET_NOT_VERIFIED');
  try {
    return await connectAndRead(
      { connectionString: initial.WATCHER_QA_SQL_URL!, readOnly: true, rejectUnauthorized: true },
      sql,
    );
  } catch {
    throw new Error('WATCHER_QA_READ_ONLY_PROCEDURE_FAILED');
  }
}
