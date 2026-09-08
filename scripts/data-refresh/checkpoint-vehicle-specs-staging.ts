import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXPECTED_REF = 'shfsjyjxmgwnlexmdkcs';

function parseEnv(source: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    source
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) throw new Error('Declaração inválida no ambiente do Staging.');
        const value = line.slice(separator + 1).trim();
        return [
          line.slice(0, separator).trim(),
          /^(['"]).*\1$/u.test(value) ? value.slice(1, -1) : value,
        ];
      }),
  );
}

async function getAll(
  target: { readonly url: string; readonly key: string },
  table: string,
): Promise<readonly Record<string, unknown>[]> {
  const response = await fetch(`${target.url}/rest/v1/${table}?select=*&order=id.asc&limit=1000`, {
    method: 'GET',
    headers: { apikey: target.key, Authorization: `Bearer ${target.key}` },
  });
  if (!response.ok) throw new Error(`Checkpoint ${table}: HTTP ${response.status}.`);
  return response.json() as Promise<readonly Record<string, unknown>[]>;
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '../..');
  const env = parseEnv(await readFile(resolve(root, 'apps/web/env/staging.env'), 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/u, '');
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || new URL(url).hostname !== `${EXPECTED_REF}.supabase.co`) {
    throw new Error(`Destino inválido; esperado ${EXPECTED_REF}.`);
  }
  const [specs, products, productSpecs] = await Promise.all([
    getAll({ url, key }, 'specs'),
    getAll({ url, key }, 'products'),
    getAll({ url, key }, 'product_specs'),
  ]);
  if (specs.length !== 190 || products.length !== 10 || productSpecs.length !== 306) {
    throw new Error(
      `Checkpoint divergente: specs=${specs.length}, products=${products.length}, product_specs=${productSpecs.length}.`,
    );
  }
  const capturedAt = new Date().toISOString();
  const sequenceState = {
    equipments_id_seq: { lastValue: 313, isCalled: true },
    products_id_seq: { lastValue: 617, isCalled: true },
    product_specs_id_seq: { lastValue: 30462, isCalled: true },
  } as const;
  const data = { specs, products, productSpecs };
  const canonicalData = JSON.stringify(data);
  const checkpoint = {
    schemaVersion: 'vehicle-specs-staging-checkpoint/1',
    projectId: EXPECTED_REF,
    capturedAt,
    counts: { specs: specs.length, products: products.length, productSpecs: productSpecs.length },
    sequences: sequenceState,
    dataSha256: createHash('sha256').update(canonicalData).digest('hex').toUpperCase(),
    data,
  };
  const directory = resolve(root, 'temp/vehicle-specs-checkpoints');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `staging-before-apply-${capturedAt.replace(/[:.]/gu, '-')}.json`);
  await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  const verified = JSON.parse(await readFile(path, 'utf8')) as typeof checkpoint;
  if (
    verified.projectId !== EXPECTED_REF ||
    createHash('sha256').update(JSON.stringify(verified.data)).digest('hex').toUpperCase() !==
      verified.dataSha256
  ) {
    throw new Error('Falha ao validar o checkpoint gravado.');
  }
  process.stdout.write(
    `${JSON.stringify({ path, projectId: EXPECTED_REF, capturedAt, counts: checkpoint.counts, sequences: sequenceState, dataSha256: checkpoint.dataSha256 }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
