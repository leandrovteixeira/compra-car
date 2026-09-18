import { runSpecSourceCli } from './run-spec-source';
process.exitCode = await runSpecSourceCli(process.argv.slice(2));
