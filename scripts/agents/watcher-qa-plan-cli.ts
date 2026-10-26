import { resolve } from 'node:path';
import { prepareWatcherQaApiDeployment } from './watcher-qa-deployment';
import { loadWatcherQaEnvironment } from './watcher-qa-environment';
// Approved QA secret file only. No generic dotenv fallback or remote execution mode.
if (process.argv.length !== 2) {
  console.error('WATCHER_QA_PLAN_ARGUMENTS_REJECTED');
  process.exitCode = 1;
} else {
  try {
    console.log(
      JSON.stringify(
        await prepareWatcherQaApiDeployment(
          resolve(process.cwd(), '../..'),
          await loadWatcherQaEnvironment(),
        ),
        null,
        2,
      ),
    );
  } catch {
    console.error('WATCHER_QA_PLAN_REJECTED');
    process.exitCode = 1;
  }
}
