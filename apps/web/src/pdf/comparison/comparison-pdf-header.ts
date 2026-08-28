import { Text, View } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import type { ComparisonPdfViewModel } from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';

export const COMPARISON_PDF_HEADER_FIXED = true;

export function createComparisonPdfBrandSlot(model: ComparisonPdfViewModel): ReactElement {
  return createElement(
    View,
    { style: styles.brandSlot },
    createElement(Text, { style: styles.brand }, model.title),
    createElement(Text, { style: styles.heading }, model.heading),
  );
}

export function createComparisonPdfHeader(model: ComparisonPdfViewModel): ReactElement {
  const vehicleHeaders = model.vehicles.map((vehicle) =>
    createElement(
      View,
      {
        key: vehicle.id,
        style: [
          styles.vehicleHeader,
          { width: model.geometry.vehicleColumnWidth },
          vehicle.isReference ? styles.referenceVehicle : {},
        ],
      },
      createElement(
        Text,
        { style: [styles.vehicleRole, vehicle.isReference ? styles.referenceRole : {}] },
        vehicle.isReference ? 'Referência' : 'Comparado',
      ),
      createElement(Text, { style: [styles.vehicleName, { maxLines: 1 }] }, vehicle.brandModel),
      createElement(Text, { style: [styles.vehicleVersion, { maxLines: 1 }] }, vehicle.version),
      createElement(Text, { style: styles.vehicleYears }, vehicle.years),
    ),
  );

  return createElement(
    View,
    {
      fixed: COMPARISON_PDF_HEADER_FIXED,
      style: [styles.header, { width: model.geometry.tableWidth }],
    },
    createElement(
      View,
      { style: styles.headerTop },
      createComparisonPdfBrandSlot(model),
      createElement(
        View,
        { style: styles.headerMeta },
        createElement(Text, { style: styles.mode }, model.mode),
        createElement(Text, { style: styles.generatedAt }, `Gerado em ${model.generatedAt}`),
      ),
    ),
    createElement(
      Text,
      { style: styles.intro },
      'O primeiro veículo é a referência. Valores e equipamentos seguem os dados exibidos na comparação.',
    ),
    createElement(
      View,
      { style: [styles.columnHeader, { width: model.geometry.tableWidth }] },
      createElement(
        View,
        { style: [styles.itemHeader, { width: model.geometry.itemColumnWidth }] },
        createElement(Text, { style: styles.itemHeaderText }, 'Item comparado'),
      ),
      ...vehicleHeaders,
    ),
    createElement(View, { style: styles.columnHeaderBottomRule }),
  );
}
