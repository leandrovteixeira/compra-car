import { resolve } from 'node:path';
import { planWatcherQaDeployment } from './watcher-qa-deployment';
// Explicit process env only. No dotenv fallback and no remote execution mode.
if (process.argv.length !== 2) {
  console.error('WATCHER_QA_PLAN_ARGUMENTS_REJECTED');
  process.exitCode = 1;
} else {
  try {
    console.log(
      JSON.stringify(
        await planWatcherQaDeployment(resolve(process.cwd(), '../..'), process.env),
        null,
        2,
      ),
    );
  } catch {
    console.error('WATCHER_QA_PLAN_REJECTED');
    process.exitCode = 1;
  }
}
