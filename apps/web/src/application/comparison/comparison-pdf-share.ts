export const COMPARISON_PDF_FILENAME = 'comparacao-veiculos.pdf';
export const COMPARISON_PDF_MIME_TYPE = 'application/pdf';
export const COMPARISON_PDF_SHARE_TITLE = 'Comparação de veículos';

export type ComparisonPdfShareResult = 'cancelled' | 'downloaded' | 'failed' | 'shared';

interface FileShareNavigator {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
}

interface ComparisonPdfShareDependencies {
  readonly createFile?: (blob: Blob) => File;
  readonly download: () => void;
  readonly fetchPdf?: typeof fetch;
  readonly navigator?: FileShareNavigator;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function downloadFallback(download: () => void): ComparisonPdfShareResult {
  try {
    download();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export async function shareComparisonPdf(
  pdfUrl: string,
  dependencies: ComparisonPdfShareDependencies,
): Promise<ComparisonPdfShareResult> {
  const browserNavigator =
    dependencies.navigator ?? (typeof navigator === 'undefined' ? undefined : navigator);

  if (
    typeof browserNavigator?.share !== 'function' ||
    typeof browserNavigator.canShare !== 'function'
  ) {
    return downloadFallback(dependencies.download);
  }

  try {
    const response = await (dependencies.fetchPdf ?? fetch)(pdfUrl);
    if (!response.ok) return downloadFallback(dependencies.download);

    const blob = await response.blob();
    const file = dependencies.createFile
      ? dependencies.createFile(blob)
      : new File([blob], COMPARISON_PDF_FILENAME, { type: COMPARISON_PDF_MIME_TYPE });
    const shareData: ShareData = {
      files: [file],
      title: COMPARISON_PDF_SHARE_TITLE,
    };

    if (!browserNavigator.canShare(shareData)) {
      return downloadFallback(dependencies.download);
    }

    await browserNavigator.share(shareData);
    return 'shared';
  } catch (error) {
    if (isAbortError(error)) return 'cancelled';
    return downloadFallback(dependencies.download);
  }
}
