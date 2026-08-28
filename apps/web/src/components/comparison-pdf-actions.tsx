'use client';

import { useState } from 'react';

import {
  COMPARISON_PDF_FILENAME,
  shareComparisonPdf,
} from '@/application/comparison/comparison-pdf-share';

interface ComparisonPdfActionsProps {
  readonly pdfUrl: string;
}

const actionClassName =
  'ui-button ui-button--secondary ui-button--compact flex-1 gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-none';

export function triggerComparisonPdfDownload(pdfUrl: string): void {
  const anchor = document.createElement('a');
  anchor.download = COMPARISON_PDF_FILENAME;
  anchor.href = pdfUrl;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
      <path
        d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
      <circle cx="5" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14.5" cy="15" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m6.8 9.1 5.9-3.2m-5.9 5 5.9 3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ComparisonPdfActions({ pdfUrl }: ComparisonPdfActionsProps) {
  const [isSharing, setIsSharing] = useState(false);

  async function sharePdf() {
    if (isSharing) return;
    setIsSharing(true);

    try {
      await shareComparisonPdf(pdfUrl, {
        download: () => triggerComparisonPdfDownload(pdfUrl),
      });
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 gap-1.5 sm:w-auto">
      <a className={actionClassName} download={COMPARISON_PDF_FILENAME} href={pdfUrl}>
        <DownloadIcon />
        <span>Baixar PDF</span>
      </a>
      <button
        className={actionClassName}
        disabled={isSharing}
        onClick={() => void sharePdf()}
        type="button"
      >
        {isSharing ? (
          <svg aria-hidden="true" className="size-4 animate-spin" viewBox="0 0 20 20">
            <circle
              className="opacity-25"
              cx="10"
              cy="10"
              fill="none"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M17 10a7 7 0 0 0-7-7"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        ) : (
          <ShareIcon />
        )}
        <span>{isSharing ? 'Preparando...' : 'Compartilhar'}</span>
      </button>
    </div>
  );
}
