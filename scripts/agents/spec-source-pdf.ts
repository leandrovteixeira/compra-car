import { Worker } from 'node:worker_threads';
import type {
  SourceScope,
  SourceSnapshot,
  SpecSourceDocument,
  SpecPdfAdapter,
  SpecObservation,
  SourceFact,
} from '@compra-car/core/agents';
import { blankSpecScope, proseFacts } from './spec-source-prose';
import {
  classifyPdfPage,
  pdfNoiseReason,
  reconstructPdfRows,
  type PdfTextSpan,
} from './spec-source-pdf-quality';
export interface PdfPageText {
  page: number;
  text: string;
  rawPageText?: string;
  spans?: PdfTextSpan[];
}
export interface PdfBinding {
  scope: SourceScope;
  evidence: SpecObservation['evidence'];
}
export function readPdfPages(bytes: Uint8Array): Promise<PdfPageText[]> {
  if (bytes.length > 25_000_000) return Promise.reject(new Error('PDF_SIZE_LIMIT'));
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-')
    return Promise.reject(new Error('INVALID_PDF_SIGNATURE'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./spec-source-pdf-worker.mjs', import.meta.url), {
      workerData: bytes,
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const finish = (error: Error | null, pages: PdfPageText[] = []) => {
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(pages);
    };
    const timer = setTimeout(() => finish(new Error('PDF_PARSE_TIMEOUT')), 60000);
    worker.once('error', () => finish(new Error('PDF_WORKER_FAILED')));
    worker.once('message', (r: { error?: string; pages?: PdfPageText[] }) =>
      finish(r.error ? new Error(r.error) : null, r.pages ?? []),
    );
    worker.once('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error('PDF_WORKER_FAILED'));
      }
    });
  });
}
export function technicalPdfDocument(
  pages: readonly PdfPageText[],
  snapshot: SourceSnapshot,
  binding?: PdfBinding,
): SpecSourceDocument {
  const facts: SourceFact[] = [],
    sections: SpecSourceDocument['sections'][number][] = [],
    issues: string[] = [];
  const rejectedFacts: { locator: string; text: string; reason: string }[] = [];
  const pageAudit: {
    page: number;
    role: string;
    rawPageText: string;
    normalizedPageText: string;
    structuredBlocks: ReturnType<typeof reconstructPdfRows>;
  }[] = [];
  const engineGroups: {
    sourceLabel: string;
    sourcePage: number;
    sourceSection: string;
    observationLocators: string[];
  }[] = [];
  const pageRoles = pages.map((p) => ({ page: p.page, role: classifyPdfPage(p.text) }));
  const cover = pages
    .slice(0, 2)
    .map((p) => p.text)
    .join('\n');
  const years = [...cover.matchAll(/(?:ano.modelo|model year|\bMY)\s*:?\s*(20\d{2})\b/giu)].map(
    (m) => Number(m[1]),
  );
  if (binding?.scope.modelYear && years.length && !years.includes(binding.scope.modelYear))
    return { snapshot, facts: [], sections: [], links: [], issues: ['PDF_MY_MISMATCH'] };
  let selectedPages = 0;
  for (const page of pages) {
    const role = classifyPdfPage(page.text);
    if (role !== 'TECHNICAL_DATA') {
      const reason =
        role === 'INDEX' || role === 'TABLE_OF_CONTENTS'
          ? 'INDEX_REFERENCE'
          : role === 'GLOSSARY_OR_DEFINITION'
            ? 'GLOSSARY_DEFINITION'
            : 'NON_TECHNICAL_PAGE';
      for (const [i, line] of page.text.split('\n').entries())
        if (/motor|transmiss|cilindrada|torque|pot[eê]ncia/iu.test(line) && line.length <= 1000)
          rejectedFacts.push({
            locator: 'pdf/page/' + page.page + '/line/' + (i + 1),
            text: line,
            reason,
          });
      continue;
    }
    if (++selectedPages > 20) {
      issues.push('PDF_TECHNICAL_PAGE_LIMIT');
      break;
    }
    const blocks = page.spans?.length
      ? reconstructPdfRows(page.spans)
      : page.text.split('\n').map((rawText, i) => ({
          rawText,
          text: rawText.replace(/\s+/gu, ' ').trim(),
          y: -i,
          cells: [{ text: rawText, x: 0, width: 0 }],
        }));
    const lines = blocks.filter((b) => b.text).map((b) => b.text);
    pageAudit.push({
      page: page.page,
      role,
      rawPageText: page.rawPageText ?? page.text,
      normalizedPageText: lines.join('\n'),
      structuredBlocks: blocks,
    });
    let group: (typeof engineGroups)[number] | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!,
        locator = 'pdf/page/' + page.page + '/line/' + (i + 1);
      if (line.length > 1000) {
        rejectedFacts.push({ locator, text: line, reason: 'TRUNCATED_SOURCE_TEXT' });
        continue;
      }
      const noise = pdfNoiseReason(line);
      if (noise) {
        rejectedFacts.push({ locator, text: line, reason: noise });
        continue;
      }
      if (
        /^(?:motor|engine)\s+(?:\d[.,]\d|[A-Z]\d{3}|[AB]\b)/u.test(line) ||
        /^Motor\s+(?:\d[.,]\d|[A-Z]\d{3}|[AB]\b)/u.test(line)
      ) {
        group = {
          sourceLabel: line,
          sourcePage: page.page,
          sourceSection: locator,
          observationLocators: [],
        };
        engineGroups.push(group);
      }
      const scope: SourceScope = {
        ...(binding?.scope ?? blankSpecScope()),
        version: null,
        shared: false,
        matrix: false,
        applicabilityEvidence: [
          ...(binding ? [binding.evidence] : []),
          ...(group
            ? [
                {
                  sourceUrl: snapshot.finalUrl,
                  sourceKind: snapshot.sourceKind,
                  contentHash: snapshot.contentHash,
                  locator: group.sourceSection,
                  evidenceText: group.sourceLabel,
                },
              ]
            : []),
        ],
        ...(group ? { engineDesignation: group.sourceLabel, component: 'POWERTRAIN' } : {}),
      };
      const section = {
        text: line,
        locator: locator + (group ? '/section/' + group.sourceLabel : ''),
        scope,
      };
      let parsed: SourceFact[] = [];
      if (group?.sourceSection === locator) {
        parsed = [
          {
            ...section,
            label: /^\S+/u.exec(line)![0],
            value: line.replace(/^\S+\s+/u, ''),
            unit: null,
            method: 'PDF_TEXT',
          },
        ];
      } else if ((line.match(/\d+(?:[.,]\d+)?\s*(?:cv|kW|Nm|kgfm|cm³|cm3)\b/gu) ?? []).length > 1) {
        rejectedFacts.push({
          locator,
          text: line,
          reason: 'PDF_MULTIPLE_ENGINE_VALUES_UNRESOLVED',
        });
        issues.push('PDF_MULTIPLE_ENGINE_VALUES_UNRESOLVED');
        continue;
      } else {
        parsed = proseFacts(section, '', 'PDF_TEXT');
        if (!parsed.length) {
          const row =
            /^(pot[eê]ncia(?: máxima)?|torque(?: máximo)?|cilindrada|comprimento|largura|altura|capacidade)\s+(cm³|cm3|mm|cm|m|L|cv|kW|Nm|kgfm|kg)\s+(\d+(?:[.,]\d+)?)$/iu.exec(
              line,
            );
          if (row)
            parsed = [
              { ...section, label: row[1]!, unit: row[2]!, value: row[3]!, method: 'PDF_TEXT' },
            ];
          const next = lines[i + 1];
          if (
            /^(pot[eê]ncia(?: máxima)?|torque(?: máximo)?|cilindrada|comprimento|largura|altura|capacidade)\s*:?$/iu.test(
              line,
            ) &&
            next &&
            /^\d+(?:[.,]\d+)?\s*(cm³|cm3|mm|cm|m|L|cv|kW|Nm|kgfm|kg)$/iu.test(next)
          )
            parsed = proseFacts({ ...section, text: line + ': ' + next }, '', 'PDF_TEXT');
        }
      }
      facts.push(...parsed);
      group?.observationLocators.push(...parsed.map((f) => f.locator));
      if (parsed.length) sections.push(section);
    }
  }
  if (!selectedPages) issues.push('PDF_NO_TECHNICAL_SECTION');
  return {
    snapshot,
    facts: facts.slice(0, 500),
    sections: sections.slice(0, 80),
    links: [],
    issues,
    rejectedFacts: rejectedFacts.slice(0, 1500),
    audit: { pageRoles, pages: pageAudit, engineGroups, rawTextPreserved: true },
  };
}
export class OfficialSpecPdf implements SpecPdfAdapter {
  async parse(bytes: Uint8Array, snapshot: SourceSnapshot, binding?: PdfBinding) {
    return technicalPdfDocument(await readPdfPages(bytes), snapshot, binding);
  }
}
