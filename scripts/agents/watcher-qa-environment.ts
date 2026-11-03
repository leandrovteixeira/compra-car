import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import {
  assertWatcherQaTarget,
  WATCHER_QA_REF,
  WATCHER_QA_URL,
  type WatcherQaEnvironment,
} from '@compra-car/adapter-supabase/watcher-qa';

const approvedFile = 'C:/Dev/.secrets/compra-car/staging.env';
const reject = (): never => {
  throw new Error('WATCHER_QA_CONFIGURATION_REJECTED');
};
const relevant = (key: string) =>
  /^(?:APP_ENV|NEXT_PUBLIC_APP_ENV|AGENT_ENVIRONMENT|WATCHER_.*|SUPABASE_.*|NEXT_PUBLIC_SUPABASE_URL|DATABASE_URL|DIRECT_URL|POSTGRES_.*|PG.*|COMPRA_CAR_AGENT_ENV_FILE|NODE_TLS_REJECT_UNAUTHORIZED)$/u.test(
    key,
  );

/** Approved QA API configuration only. No SQL transport, password, fallback or mutation. */
export async function loadWatcherQaEnvironment(
  environment: WatcherQaEnvironment = process.env,
  read: (path: string) => Promise<string> = (path) => readFile(path, 'utf8'),
): Promise<WatcherQaEnvironment> {
  try {
    const content = await read(approvedFile);
    if (content.includes('\0')) return reject();
    const file = parseEnv(content);
    if (
      !['staging', 'qa'].includes(file.APP_ENV ?? '') ||
      file.SUPABASE_URL !== WATCHER_QA_URL ||
      !file.SUPABASE_SERVER_KEY?.trim() ||
      (file.NEXT_PUBLIC_APP_ENV !== undefined &&
        !['staging', 'qa'].includes(file.NEXT_PUBLIC_APP_ENV))
    )
      return reject();
    // Old database passwords may coexist in this shared file, but are never imported/used.
    const selected = Object.fromEntries(
      Object.entries(file).filter(
        ([key]) =>
          relevant(key) &&
          !['APP_ENV', 'NEXT_PUBLIC_APP_ENV', 'SUPABASE_POSTGRES_PASSWORD'].includes(key),
      ),
    );
    const expected = {
      APP_ENV: 'qa',
      WATCHER_ENVIRONMENT: 'qa',
      WATCHER_QA_PROJECT_REF: WATCHER_QA_REF,
      SUPABASE_URL: WATCHER_QA_URL,
      SUPABASE_SERVER_KEY: file.SUPABASE_SERVER_KEY,
    };
    for (const [key, value] of Object.entries(expected))
      if (selected[key] !== undefined && selected[key] !== value) return reject();
    const result: Record<string, string | undefined> = { ...selected, ...expected };
    assertWatcherQaTarget(result);
    for (const [key, value] of Object.entries(environment)) {
      if (!relevant(key) || value === undefined) continue;
      // Inherited credentials cannot replace the approved file's credentials.
      if ((key === 'SUPABASE_ACCESS_TOKEN' || key === 'SUPABASE_SERVER_KEY') && value !== file[key])
        return reject();
      if (result[key] !== undefined && result[key] !== value) return reject();
      if (key === 'SUPABASE_POSTGRES_PASSWORD') return reject();
      result[key] = value;
    }
    for (const key of Object.keys(result))
      if (/^PG/u.test(key) || ['POSTGRES_PASSWORD', 'SUPABASE_DB_PASSWORD'].includes(key))
        return reject();
    assertWatcherQaTarget(result);
    return Object.freeze(result);
  } catch {
    return reject();
  }
}
