import { randomUUID } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWatcherQaExecutor } from '@compra-car/adapter-supabase/watcher-qa';
import { loadWatcherQaEnvironment } from './watcher-qa-environment';
import { createWatcherFeedTransport, nodeWatcherFeedNetwork } from './watcher-feed-transport';
import { runWatcherPilotOnce } from './watcher-pilot';

const mode = process.argv[2];
if (process.argv.length === 3 && mode === '--help') {
  console.log('watcher:qa:pilot --run-once (one RSS request; no retry)');
} else if (process.argv.length !== 3 || mode !== '--run-once') {
  console.error('WATCHER_PILOT_MODE_REQUIRED');
  process.exitCode = 1;
} else {
  try {
    const env = await loadWatcherQaEnvironment();
    const executor = createWatcherQaExecutor(() => env);
    const directory = resolve(process.cwd(), '../../.local-reports/watcher-24a5');
    const network = nodeWatcherFeedNetwork();
    const http: { requests: number; status: number | null; contentType: string | null } = {
      requests: 0,
      status: null,
      contentType: null,
    };
    const transport = createWatcherFeedTransport(
      {
        resolve: network.resolve,
        async request(url, options) {
          if (++http.requests !== 1) throw new Error('WATCHER_PILOT_SECOND_REQUEST_REJECTED');
          const response = await network.request(url, options);
          http.status = response.status;
          http.contentType = response.headers['content-type'] ?? null;
          return response;
        },
      },
      {
        allowedHosts: ['motor1.uol.com.br'],
        timeoutMs: 15000,
        maxConcurrencyPerHost: 1,
      },
    );
    await mkdir(directory, { recursive: true });
    {
      const batchId = randomUUID();
      // Exclusive local journal prevents re-entry after a crash or uncertain outcome.
      const marker = await open(resolve(directory, 'attempt.json'), 'wx');
      try {
        await marker.writeFile(
          JSON.stringify({ batchId, startedAt: new Date().toISOString(), status: 'STARTED' }) +
            '\n',
        );
      } finally {
        await marker.close();
      }
      const result = await executor.run((r) =>
        runWatcherPilotOnce({
          repository: r,
          transport,
          batchId,
          now: () => new Date().toISOString(),
        }),
      );
      const report = { ...result, http };
      await writeFile(resolve(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(report, null, 2));
      if (result.status !== 'PASS') process.exitCode = 1;
    }
  } catch {
    console.error('WATCHER_PILOT_BLOCKED_OR_UNCERTAIN_NO_RETRY');
    process.exitCode = 1;
  }
}
