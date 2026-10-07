import { runModelYearCli } from './run-model-year';

void runModelYearCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
