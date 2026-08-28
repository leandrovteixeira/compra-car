import { Circle, Path, Svg, Text, View } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import type { ComparisonPdfValueViewModel } from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';

export const COMPARISON_PDF_ADVANTAGE_COLOR = '#EF7732';

function createAdvantageIcon(): ReactElement {
  return createElement(
    Svg,
    { style: styles.advantageIcon, viewBox: '0 0 12 12' },
    createElement(Circle, { cx: 6, cy: 6, fill: COMPARISON_PDF_ADVANTAGE_COLOR, r: 5 }),
    createElement(Path, {
      d: 'M3.2 6.1 5.1 8 8.9 4.1',
      fill: 'none',
      stroke: '#FFFFFF',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.4,
    }),
  );
}

export function createComparisonPdfValue(
  value: ComparisonPdfValueViewModel,
  width: number,
  isLastColumn: boolean,
): ReactElement {
  const content = value.showPresenceDot
    ? createElement(View, { style: styles.presenceDot })
    : createElement(
        Text,
        { style: [styles.valueText, { fontSize: value.fontSize }] },
        value.displayValue,
      );

  return createElement(
    View,
    {
      key: value.vehicleId,
      style: [
        styles.valueCell,
        { width },
        value.showAdvantageCheck ? styles.advantageCell : {},
        isLastColumn ? { borderRightWidth: 0 } : {},
      ],
    },
    content,
    value.showAdvantageCheck ? createAdvantageIcon() : null,
  );
}
