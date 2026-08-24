import { Text, View } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import type {
  ComparisonPdfCategoryViewModel,
  ComparisonPdfColumnGeometry,
  ComparisonPdfRowViewModel,
} from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';
import { createComparisonPdfValue } from './comparison-pdf-value';

export const COMPARISON_PDF_ROW_MIN_HEIGHT = 28;
export const COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD = COMPARISON_PDF_ROW_MIN_HEIGHT;
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
    View,
    { key: category.name, wrap: true },
    createElement(
      View,
      {
        minPresenceAhead: COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD,
        style: styles.category,
      },
      createElement(Text, { style: styles.categoryText }, category.name),
    ),
    ...category.rows.map((row) => createComparisonPdfRow(row, geometry)),
  );
}

export function createComparisonPdfTable(
  categories: readonly ComparisonPdfCategoryViewModel[],
  geometry: ComparisonPdfColumnGeometry,
): ReactElement {
  return createElement(
    View,
    { style: styles.table },
    ...categories.map((category) => createComparisonPdfCategory(category, geometry)),
  );
}
