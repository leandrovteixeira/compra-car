import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
import { createHash } from 'node:crypto';
import { adaptBenchmarkCapture, replayDocuments } from './document-intelligence-replay';
import type { CapturedDocumentResponse } from './document-intelligence-replay';
import type {
  DocumentIntelligenceSource,
  DocumentIntelligenceTarget,
} from '@compra-car/core/agents';
import { readPdfPages } from './spec-source-pdf';
import { loadAgentEnvironment } from './agent-environment';
async function main(args: string[]) {
  const flags = new Map<string, string>();
  const a = args[0] === '--' ? args.slice(1) : args;
  for (let i = 0; i < a.length; i += 2) {
    if (!a[i]?.startsWith('--') || !a[i + 1] || flags.has(a[i]!))
      throw new Error('INVALID_REPLAY_ARGUMENTS');
    flags.set(a[i]!, a[i + 1]!);
  }
  if (
    [...flags.keys()].some(
      (k) => !['--benchmark-dir', '--pdf', '--target', '--authorize-openai'].includes(k),
    )
  )
    throw new Error('INVALID_REPLAY_ARGUMENTS');
  const dir = flags.get('--benchmark-dir'),
    pdf = flags.get('--pdf'),
    targetPath = flags.get('--target');
  if (!dir || !pdf || !targetPath) throw new Error('REPLAY_INPUTS_REQUIRED');
  const target = JSON.parse(
    await readFile(resolve(root, targetPath), 'utf8'),
  ) as DocumentIntelligenceTarget;
  if (
    typeof target.brand !== 'string' ||
    typeof target.model !== 'string' ||
    typeof target.officialVersionLabel !== 'string' ||
    !(target.modelYear === null || Number.isInteger(target.modelYear))
  )
    throw new Error('INVALID_REPLAY_TARGET');
  const bytes = new Uint8Array(await readFile(resolve(root, pdf))),
    pages = await readPdfPages(bytes);
  const source: DocumentIntelligenceSource = {
    format: 'PDF_FILE',
    sourceClass: 'TECHNICAL_SHEET',
    official: true,
    reference: resolve(root, pdf),
    finalUrl: resolve(root, pdf),
    sourceHash: createHash('sha256').update(bytes).digest('hex'),
    contentType: 'application/pdf',
    byteSize: bytes.length,
    filename: pdf.split(/[\\/]/u).pop(),
    bytes,
    title: null,
    h1: [],
    truncated: false,
    blocks: pages.map((p) => ({
      locator: 'page/' + p.page,
      page: p.page,
      readingText: p.rawPageText,
      type: 'PAGE',
      text: p.text,
      parentLocator: null,
      heading: null,
      scope: { model: null, version: null, modelYear: null },
    })),
  };
  let result: unknown;
  if (flags.has('--authorize-openai')) {
    if (flags.get('--authorize-openai') !== 'explicit-manual-benchmark')
      throw new Error('EXPLICIT_BENCHMARK_AUTHORIZATION_REQUIRED');
    const env = await loadAgentEnvironment(root);
    const { OpenAIDocumentIntelligenceProvider } = await import('@compra-car/adapter-openai');
    result = await new OpenAIDocumentIntelligenceProvider({
      apiKey: env.OPENAI_API_KEY ?? '',
    }).extract(source, target);
  } else {
    const terra = JSON.parse(
      await readFile(resolve(root, dir, 'terra-response.json'), 'utf8'),
    ) as CapturedDocumentResponse;
    const sol = JSON.parse(
      await readFile(resolve(root, dir, 'sol-response.json'), 'utf8'),
    ) as CapturedDocumentResponse;
    result = await replayDocuments(
      source,
      target,
      adaptBenchmarkCapture(terra, source),
      adaptBenchmarkCapture(sol, source),
    );
  }
  const out = resolve(root, '.local-reports/sprint-21-6');
  await mkdir(out, { recursive: true });
  const file = resolve(out, 'document-' + Date.now() + '.json');
  await writeFile(file, JSON.stringify(result, null, 2));
  console.log('Report: ' + file);
}
void main(process.argv.slice(2)).catch(() => {
  console.error('DOCUMENT_REPLAY_FAILED');
  process.exitCode = 1;
});
