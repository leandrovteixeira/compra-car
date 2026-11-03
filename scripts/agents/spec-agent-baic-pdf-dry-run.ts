/**
 * Read-only pilot. Usage:
 * pnpm --filter @compra-car/agents exec tsx spec-agent-baic-pdf-dry-run.ts --pdf <path>
 * Requires pdftotext (Poppler). No DB, network, LLM, or persistence side effects.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseBaicSpecMatrix27, parseBaicSpecCell27 } from '@compra-car/core/agents';
const mode = process.argv[2];
const path = process.argv[3];
if (!path || !['--pdf','--text'].includes(mode)) {
  process.stderr.write('Usage: tsx spec-agent-baic-pdf-dry-run.ts (--pdf|--text) path\n');
  process.exitCode = 2;
} else {
  const body = mode === '--pdf'
    ? execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8',maxBuffer:8*1024*1024})
    : readFileSync(path,'utf8');
  const parsed = parseBaicSpecMatrix27(body);
  const counts = {binary:0,numeric:0,text:0,ambiguous:0};
  for (const row of parsed.rows) for (const raw of [row.pro,row.max]) {
    counts[parseBaicSpecCell27(raw).kind]++;
  }
  process.stdout.write(JSON.stringify({
    status: parsed.complete ? 'STRUCTURALLY_COMPLETE' : 'REQUIRES_REVIEW',
    rowCount:parsed.rows.length,
    observedRowIds:parsed.seenRowIds.length,
    issues:parsed.issues,
    cellKinds:counts,
    safeForAutomaticAbsenceInference:parsed.complete,
  },null,2)+'\n');
}
