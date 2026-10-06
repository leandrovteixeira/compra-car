import { parseOperationsArguments, runOperations } from './operations';

try {
  const options = parseOperationsArguments(process.argv.slice(2));
  const result = await runOperations(options);
  process.exitCode = result.status === 'FAILED' ? 1 : 0;
} catch (error) {
  console.error(
    JSON.stringify({
      code: 'AGENT_OPERATIONS_FAILED',
      message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }),
  );
  process.exitCode = 1;
}
