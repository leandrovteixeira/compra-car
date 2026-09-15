import { runModelYearCli } from './run-model-year';
process.exitCode = await runModelYearCli(process.argv.slice(2));
