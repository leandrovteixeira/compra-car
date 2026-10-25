import { runPriceCli } from './run-price';
process.exitCode = await runPriceCli(process.argv.slice(2));
