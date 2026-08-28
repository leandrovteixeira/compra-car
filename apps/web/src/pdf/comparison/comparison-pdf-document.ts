import { Document, Page, Text, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import { APP_NAME } from '@/config/app-identity';
import { createComparisonPdfHeader } from './comparison-pdf-header';
import type { ComparisonPdfViewModel } from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';
import { createComparisonPdfTable } from './comparison-pdf-table';

export const COMPARISON_PDF_PAGE_SIZE = 'A4' as const;

export function createComparisonPdfDocument(
  model: ComparisonPdfViewModel,
): ReactElement<DocumentProps> {
  return createElement(
    Document,
    {
      author: APP_NAME,
      subject: 'Comparação de veículos',
      title: `Comparação de veículos — ${APP_NAME}`,
    },
    createElement(
      Page,
      {
        orientation: model.geometry.orientation,
        size: COMPARISON_PDF_PAGE_SIZE,
        style: styles.page,
        wrap: true,
      },
      createComparisonPdfHeader(model),
      createComparisonPdfTable(model.categories, model.geometry, model.emptyMessage),
      createElement(Text, {
        fixed: true,
        render: ({ pageNumber, totalPages }) => `${APP_NAME} · ${pageNumber}/${totalPages}`,
        style: [styles.footer, { width: model.geometry.tableWidth }],
      }),
    ),
  );
}
