import { runMmvMultiBrandValidation } from './run-mmv-multibrand-validation';

void runMmvMultiBrandValidation()
  .then(({ exitCode, items }) => {
    for (const item of items) {
      console.log(
        item.brand +
          ' | ' +
          item.status +
          ' | connector active: ' +
          item.connectorWasActive +
          ' | exit: ' +
          item.exitCode,
      );
      if (item.logs.length)
        for (const line of item.logs) console.log('  ' + line.replace(/[\r\n]+/gu, ' '));
    }
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'MMV_MULTI_BRAND_VALIDATION_FAILED');
    process.exitCode = 1;
  });
