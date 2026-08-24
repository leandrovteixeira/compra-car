import { Text, View } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import type { ComparisonPdfViewModel } from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';

export const COMPARISON_PDF_HEADER_FIXED = true;

export function createComparisonPdfHeader(model: ComparisonPdfViewModel): ReactElement {
  const vehicleHeaders = model.vehicles.map((vehicle, index) =>
    createElement(
      View,
      {
        key: vehicle.id,
        style: [
          styles.vehicleHeader,
          { width: model.geometry.vehicleColumnWidth },
          vehicle.isReference ? styles.referenceVehicle : {},
          index === model.vehicles.length - 1 ? styles.lastColumn : {},
        ],
      },
      createElement(
        Text,
        {
          style: [styles.vehicleRole, vehicle.isReference ? styles.referenceRole : {}],
        },
        vehicle.isReference ? 'Referência' : 'Comparado',
      ),
      createElement(Text, { style: styles.vehicleName }, vehicle.name),
    ),
  );

  return createElement(
    View,
    { fixed: COMPARISON_PDF_HEADER_FIXED, style: styles.header },
    createElement(
      View,
      { style: styles.identityRow },
      createElement(
        View,
        null,
        createElement(Text, { style: styles.brand }, model.title),
        createElement(Text, { style: styles.heading }, model.heading),
      ),
      createElement(Text, { style: styles.mode }, model.mode),
    ),
    createElement(
      View,
      { style: styles.columnHeader },
      createElement(
        View,
        { style: [styles.itemHeader, { width: model.geometry.itemColumnWidth }] },
        createElement(Text, { style: styles.itemHeaderText }, 'Item'),
      ),
      ...vehicleHeaders,
    ),
  );
}
