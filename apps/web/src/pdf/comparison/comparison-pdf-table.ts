import { Text, View } from '@react-pdf/renderer';
import { createElement, Fragment, type ReactElement } from 'react';

import type {
  ComparisonPdfCategoryViewModel,
  ComparisonPdfColumnGeometry,
  ComparisonPdfRowViewModel,
} from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';
import { createComparisonPdfValue } from './comparison-pdf-value';

export const COMPARISON_PDF_ROW_MIN_HEIGHT = 28;
export const COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD = 34;
export const COMPARISON_PDF_ROW_WRAP = false;

function createComparisonPdfRow(
  row: ComparisonPdfRowViewModel,
  geometry: ComparisonPdfColumnGeometry,
): ReactElement {
  const values = row.values.map((value, index) =>
    createComparisonPdfValue(value, geometry.vehicleColumnWidth, index === row.values.length - 1),
  );

  return createElement(
    View,
    { key: row.code, style: styles.row, wrap: COMPARISON_PDF_ROW_WRAP },
    createElement(
      View,
      { style: [styles.itemCell, { width: geometry.itemColumnWidth }] },
      createElement(
        Text,
        {
          style: [styles.itemLabel, { fontSize: row.labelFontSize, maxLines: row.labelMaxLines }],
        },
        row.label,
      ),
    ),
    ...values,
  );
}

function createComparisonPdfCategory(
  category: ComparisonPdfCategoryViewModel,
  geometry: ComparisonPdfColumnGeometry,
): ReactElement {
  return createElement(
    Fragment,
    { key: category.name },
    createElement(
      View,
      {
        minPresenceAhead: COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD,
        style: [styles.category, { width: geometry.tableWidth }],
      },
      createElement(Text, { style: styles.categoryText }, category.name),
    ),
    ...category.rows.map((row) => createComparisonPdfRow(row, geometry)),
  );
}

export function createComparisonPdfTable(
  categories: readonly ComparisonPdfCategoryViewModel[],
  geometry: ComparisonPdfColumnGeometry,
  emptyMessage: string | null,
): ReactElement {
  if (emptyMessage !== null) {
    return createElement(
      View,
      { style: styles.emptyState },
      createElement(Text, { style: styles.emptyTitle }, 'Comparação sem itens neste modo'),
      createElement(Text, { style: styles.emptyText }, emptyMessage),
    );
  }

  return createElement(
    Fragment,
    null,
    ...categories.map((category) => createComparisonPdfCategory(category, geometry)),
  );
}
