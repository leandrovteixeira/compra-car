import { runNewProductCheckCli } from './run-new-product-check';
void runNewProductCheckCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
