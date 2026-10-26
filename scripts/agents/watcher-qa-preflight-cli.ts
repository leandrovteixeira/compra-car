import { resolve } from 'node:path';
import { loadWatcherQaEnvironment } from './watcher-qa-environment';
import { runWatcherQaApiPreflight } from './watcher-qa-deployment';

if (process.argv.length !== 2) {
  console.error('WATCHER_QA_PREFLIGHT_ARGUMENTS_REJECTED');
  process.exitCode = 1;
} else {
  try {
    const env = await loadWatcherQaEnvironment();
    const result = await runWatcherQaApiPreflight(resolve(process.cwd(), '../..'), () => env);
    console.log(JSON.stringify(result, null, 2));
    if (result.recommendation === 'NO_GO') process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error && error.message === 'WATCHER_QA_MANAGEMENT_TOKEN_REQUIRED'
        ? 'WATCHER_QA_MANAGEMENT_TOKEN_REQUIRED'
        : 'WATCHER_QA_API_PREFLIGHT_REJECTED',
    );
    process.exitCode = 1;
  }
}
