import { Document, Page, Text, View, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import type { ComparisonPdfViewModel } from './comparison-pdf-model';
import { comparisonPdfStyles as styles } from './comparison-pdf-styles';

export function createComparisonPdfDocument(
  model: ComparisonPdfViewModel,
): ReactElement<DocumentProps> {
  const vehicles = model.vehicleNames.map((vehicleName, index) =>
    createElement(Text, { key: `${vehicleName}-${index}`, style: styles.vehicle }, vehicleName),
  );

  return createElement(
    Document,
    {
      author: 'Compra Car',
      subject: 'Comparação de veículos',
      title: 'Comparação de veículos — Compra Car',
    },
    createElement(
      Page,
      { orientation: 'portrait', size: 'A4', style: styles.page },
      createElement(Text, { style: styles.eyebrow }, model.title),
      createElement(Text, { style: styles.heading }, model.heading),
      createElement(
        Text,
        { style: styles.summary },
        `${model.vehicleCount} veículos · ${model.mode}`,
      ),
      createElement(
        View,
        { style: styles.surface },
        createElement(Text, { style: styles.sectionLabel }, 'Veículos selecionados'),
        ...vehicles,
        createElement(
          View,
          { style: styles.metrics },
          createElement(
            View,
            { style: styles.metric },
            createElement(Text, { style: styles.metricValue }, model.categoryCount),
            createElement(Text, { style: styles.metricLabel }, 'Categorias após o filtro'),
          ),
          createElement(
            View,
            { style: styles.metric },
            createElement(Text, { style: styles.metricValue }, model.rowCount),
            createElement(Text, { style: styles.metricLabel }, 'Itens após o filtro'),
          ),
        ),
      ),
    ),
  );
}
