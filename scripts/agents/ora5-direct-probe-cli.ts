import { runOra5PriceProbe } from './price-ora5-direct-probe';
try {
  const probe = await runOra5PriceProbe();
  if (!probe.status || probe.status >= 400) throw new Error('PRICE_PROBE_HTTP_FAILED');
  if (!probe.extracted.some(item => item.amount === '165990.00')) {
    console.error('PRICE_PROBE_EXPECTED_PRICE_NOT_EXTRACTED');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('PRICE_PROBE_ERROR',error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
}
