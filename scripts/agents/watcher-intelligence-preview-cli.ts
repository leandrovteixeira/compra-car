import { writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { createWatcherQaExecutor, WATCHER_QA_URL } from '@compra-car/adapter-supabase/watcher-qa';
import { readWatcherCanonicalContext, type WatcherCanonicalReader } from '@compra-car/adapter-supabase/watcher-intelligence-context';
import { loadWatcherQaEnvironment } from './watcher-qa-environment';
import { previewWatcherMotor1WithCanonicalContext } from './watcher-intelligence-preview';

if (process.argv.length !== 3 || process.argv[2] !== '--read-only') {
  console.error('WATCHER_INTELLIGENCE_READ_ONLY_REQUIRED');
  process.exitCode = 1;
} else {
  try {
    const env = await loadWatcherQaEnvironment();
    const executor = createWatcherQaExecutor(() => env);
    const result = await executor.run(async (repository) => {
      const client = createLegacySupabaseClient({
        url: WATCHER_QA_URL,
        serverKey: env.SUPABASE_SERVER_KEY!,
      });
      return previewWatcherMotor1WithCanonicalContext({
        repository,
        readCanonicalContext: () => readWatcherCanonicalContext(client as unknown as WatcherCanonicalReader),
      });
    });
    const folder = resolve(process.cwd(), '../../.local-reports/watcher-24b');
    await mkdir(folder, { recursive: true });
    // Preserve prior pilot reports so repeated read-only previews can be compared.
    const file = resolve(folder, `intelligence-preview-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`);
    await writeFile(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'PASS', mode: 'READ_ONLY', report: result.report, reportFile: file }));
  } catch (error) {
    // Diagnostics contain only allowlisted codes; never print provider responses, env or secrets.
    const message = error instanceof Error ? error.message : '';
    const safe = /^WATCHER_(?:INTELLIGENCE_PREVIEW|CONTEXT|QA|INVALID|REVISION)[A-Z0-9_]*$/u.test(message)
      ? message : 'WATCHER_INTELLIGENCE_PREVIEW_BLOCKED';
    console.error(safe);
    process.exitCode = 1;
  }
}
