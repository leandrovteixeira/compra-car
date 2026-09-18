import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
// Bytes only. No URL, resource loading, actions, OCR or rendering.
let task;
try {
  task = getDocument({
    data: new Uint8Array(workerData),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: false,
    disableAutoFetch: true,
    disableStream: true,
    verbosity: 0,
    stopAtErrors: true,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 350) throw new Error('PDF_PAGE_LIMIT');
  const pages = [];
  let size = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p),
      content = await page.getTextContent();
    const rows = new Map();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] * 2) / 2;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }
    const text = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((v) => v.s)
          .join(' '),
      )
      .join('\n');
    size += text.length;
    if (size > 2_000_000) throw new Error('PDF_TEXT_LIMIT');
    const spans = content.items
      .filter((i) => 'str' in i)
      .map((i) => ({
        text: i.str,
        x: i.transform[4],
        y: i.transform[5],
        width: i.width,
        height: i.height,
      }));
    const rawPageText = content.items
      .filter((i) => 'str' in i)
      .map((i) => i.str + (i.hasEOL ? '\n' : ' '))
      .join('');
    pages.push({ page: p, text, rawPageText, spans });
    page.cleanup();
  }
  parentPort.postMessage({ pages });
} catch (error) {
  parentPort.postMessage({
    error:
      error instanceof Error && /^[A-Z_]+$/u.test(error.message)
        ? error.message
        : 'PDF_TEXT_EXTRACTION_FAILED',
  });
} finally {
  await task?.destroy();
}
