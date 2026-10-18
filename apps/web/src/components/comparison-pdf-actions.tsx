'use client';

import { useState } from 'react';

import {
  COMPARISON_PDF_FILENAME,
  shareComparisonPdf,
} from '@/application/comparison/comparison-pdf-share';

interface ComparisonPdfActionsProps {
  readonly pdfUrl: string;
}

const actionClassName = 'cc-outline-icon-action';

export function triggerComparisonPdfDownload(pdfUrl: string): void {
  const anchor = document.createElement('a');
  anchor.download = COMPARISON_PDF_FILENAME;
  anchor.href = pdfUrl;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function DownloadIcon() { return <img src="/carboot/download.svg" alt="" aria-hidden="true" className="size-4 object-contain" />; }
function ShareIcon() { return <img src="/carboot/share.svg" alt="" aria-hidden="true" className="size-4 object-contain" />; }

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
    <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
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
