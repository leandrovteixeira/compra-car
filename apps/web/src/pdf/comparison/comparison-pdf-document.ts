import { Document, Page, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import { createComparisonPdfHeader } from './comparison-pdf-header';
import type { ComparisonPdfViewModel } from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';
import { createComparisonPdfTable } from './comparison-pdf-table';

export const COMPARISON_PDF_PAGE_SIZE = { height: 853, width: 480 } as const;

export function createComparisonPdfDocument(
  model: ComparisonPdfViewModel,
): ReactElement<DocumentProps> {
  return createElement(
    Document,
    {
      author: 'Compra Car',
      subject: 'Comparação de veículos',
      title: 'Comparação de veículos — Compra Car',
    },
    createElement(
      Page,
      {
        orientation: 'portrait',
        size: COMPARISON_PDF_PAGE_SIZE,
        style: styles.page,
        wrap: true,
      },
      createComparisonPdfHeader(model),
      createComparisonPdfTable(model.categories, model.geometry),
    ),
  );
}
