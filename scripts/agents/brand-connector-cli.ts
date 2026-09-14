import { runBrandConnectorCli } from './run-brand-connector';
void runBrandConnectorCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
