import {
  COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  type CommercialDocumentConfidence,
  type CommercialDocumentEvidence,
  type CommercialDocumentExtractionV1,
  type CommercialDocumentFact,
  type CommercialDocumentScope,
  type CommercialDocumentSourceBlock,
  type CommercialDocumentTable,
  type CommercialDocumentVehicleIdentity,
} from '../../../src/import/commercial-document-extraction';

const highConfidence: CommercialDocumentConfidence = {
  score: 96,
  ambiguous: false,
  requiresReview: false,
  reasons: [],
};
const evidence = (
  blockId: string,
  tableId?: string,
  rowId?: string,
  excerpt?: string,
): CommercialDocumentEvidence => ({
  blockIds: [blockId],
  ...(tableId ? { tableId } : {}),
  ...(rowId ? { rowId } : {}),
  ...(excerpt ? { excerpt } : {}),
});
const sourceDocument = (pageCount: number, blockId: string) => ({
  documentId: 'document-main',
  ordinal: 1,
  pageCount,
  documentKind: 'commercial_letter' as const,
  competenceCandidates: [
    { value: '2026-08', evidence: evidence(blockId), confidence: highConfidence },
  ],
  validityCandidates: [
    {
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
      rawText: 'Agosto de 2026',
      evidence: evidence(blockId),
      confidence: highConfidence,
    },
  ],
  notes: [],
});
const scope = (
  scopeId: string,
  scopeType: CommercialDocumentScope['scopeType'],
  selector: CommercialDocumentScope['selector'],
  blockId: string,
  exclusions: CommercialDocumentScope['exclusions'] = {},
): CommercialDocumentScope => ({
  scopeId,
  scopeType,
  selector,
  exclusions,
  evidenceBlockIds: [blockId],
  ambiguous: false,
  requiresReview: false,
});
const vehicle = (
  vehicleIdentityId: string,
  model: string,
  version: string,
  blockId: string,
  tableId: string,
  rowId: string,
): CommercialDocumentVehicleIdentity => ({
  vehicleIdentityId,
  brand: 'Marca Sintética',
  model,
  version,
  productionYear: 2025,
  modelYear: 2026,
  rawYearText: '2025/2026',
  evidence: evidence(blockId, tableId, rowId),
  confidence: highConfidence,
});
const moneyFact = (
  factId: string,
  factType: CommercialDocumentFact['factType'],
  amount: string,
  scopeIds: readonly string[],
  blockId: string,
  tableId?: string,
  rowId?: string,
  channel?: string,
): CommercialDocumentFact => ({
  factId,
  factType,
  value: { kind: 'money', amount, currency: 'BRL', rawText: `R$ ${amount}` },
  ...(channel ? { channel } : {}),
  eligibility: [],
  restrictions: [],
  scopeIds,
  evidence: evidence(blockId, tableId, rowId, `Valor sintético ${amount}`),
  confidence: highConfidence,
});

const geelyRows = Array.from({ length: 4 }, (_, index) => ({
  rowId: `row-version-${index + 1}`,
  ordinal: index + 1,
  page: 2,
  cells: [
    { columnId: 'column-version', text: `Versão ${index + 1}` },
    { columnId: 'column-price', text: `${100_000 + index * 5_000}.00` },
  ],
  sourceBlockIds: [`block-version-${index + 1}`],
}));
const geelyBlocks: readonly CommercialDocumentSourceBlock[] = [
  {
    blockId: 'block-heading',
    documentId: 'document-main',
    page: 1,
    blockType: 'heading',
    title: 'Campanha sintética',
    excerpt: 'Condições gerais da campanha sintética.',
  },
  ...geelyRows.map((row) => ({
    blockId: row.sourceBlockIds[0]!,
    documentId: 'document-main',
    page: 2,
    blockType: 'table_row' as const,
    excerpt: `Linha sintética ${row.ordinal}.`,
    tableId: 'table-versions',
    rowId: row.rowId,
  })),
  {
    blockId: 'block-options',
    documentId: 'document-main',
    page: 3,
    blockType: 'paragraph',
    section: 'Alternativas',
    excerpt: 'Pagamento à vista ou financiamento; benefício geral cumulativo.',
  },
];
const geelyTable: CommercialDocumentTable = {
  tableId: 'table-versions',
  documentId: 'document-main',
  pages: [2],
  title: 'Versões e preços sintéticos',
  headerContext: 'PY/MY 2025/2026; valores meramente sintéticos.',
  columns: [
    { columnId: 'column-version', header: 'Versão', inherited: false },
    { columnId: 'column-price', header: 'Preço', inherited: false },
  ],
  rows: geelyRows,
  sourceBlockIds: geelyRows.map((row) => row.sourceBlockIds[0]!),
  footnoteBlockIds: [],
  continuation: {
    continuedAcrossPages: false,
    inheritedHeaderBlockIds: [],
    segments: [{ page: 2, sourceBlockIds: geelyRows.map((row) => row.sourceBlockIds[0]!) }],
  },
};
const geelyVehicleIds = geelyRows.map((_, index) => `vehicle-version-${index + 1}`);
const geelyPriceFacts = geelyRows.map((row, index) =>
  moneyFact(
    `fact-public-price-${index + 1}`,
    'public_price',
    `${100_000 + index * 5_000}.00`,
    [`scope-vehicle-${index + 1}`],
    row.sourceBlockIds[0]!,
    'table-versions',
    row.rowId,
  ),
);
const geelyFacts: readonly CommercialDocumentFact[] = [
  ...geelyPriceFacts,
  moneyFact(
    'fact-general-bonus',
    'bonus',
    '5000.00',
    ['scope-model'],
    'block-options',
    undefined,
    undefined,
  ),
  moneyFact(
    'fact-cash-alternative',
    'promotional_price',
    '95000.00',
    ['scope-version-set'],
    'block-options',
    undefined,
    undefined,
  ),
  {
    factId: 'fact-financing-alternative',
    factType: 'financing_rate',
    value: { kind: 'percentage', percentage: '0.99', rawText: '0,99% a.m.' },
    channel: 'Varejo',
    eligibility: ['Crédito sujeito à análise'],
    restrictions: [],
    scopeIds: ['scope-version-set', 'scope-channel'],
    evidence: evidence('block-options'),
    confidence: highConfidence,
  },
  moneyFact(
    'fact-shared-registration',
    'registration_bonus',
    '1200.00',
    ['scope-document'],
    'block-options',
    undefined,
    undefined,
  ),
  {
    factId: 'fact-version-exception',
    factType: 'restriction',
    value: { kind: 'text', text: 'Versão 4 excluída do bônus geral.' },
    eligibility: [],
    restrictions: ['Não cumulativo para a versão 4'],
    scopeIds: ['scope-vehicle-4'],
    evidence: evidence('block-options'),
    confidence: highConfidence,
  },
];

export const geelyLikeCommercialDocumentExtractionFixture: CommercialDocumentExtractionV1 = {
  schemaVersion: COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  documents: [sourceDocument(3, 'block-heading')],
  blocks: geelyBlocks,
  tables: [geelyTable],
  vehicleIdentities: geelyRows.map((row, index) =>
    vehicle(
      geelyVehicleIds[index]!,
      'Linha Aurora',
      `Versão ${index + 1}`,
      row.sourceBlockIds[0]!,
      'table-versions',
      row.rowId,
    ),
  ),
  facts: geelyFacts,
  scopes: [
    scope('scope-document', 'DOCUMENT', { documentIds: ['document-main'] }, 'block-heading'),
    scope('scope-brand-line', 'BRAND_LINE', { brandLines: ['Linha Aurora'] }, 'block-heading'),
    scope(
      'scope-model',
      'MODEL',
      { models: ['Linha Aurora'], vehicleIdentityIds: geelyVehicleIds },
      'block-options',
      { vehicleIdentityIds: ['vehicle-version-4'] },
    ),
    scope(
      'scope-version-set',
      'VERSION_SET',
      { versions: ['Versão 1', 'Versão 2', 'Versão 3', 'Versão 4'] },
      'block-options',
    ),
    ...geelyVehicleIds.map((vehicleIdentityId, index) =>
      scope(
        `scope-vehicle-${index + 1}`,
        'VEHICLE',
        { vehicleIdentityIds: [vehicleIdentityId] },
        `block-version-${index + 1}`,
      ),
    ),
    scope('scope-channel', 'CHANNEL', { channels: ['Varejo'] }, 'block-options'),
    scope('scope-group', 'GROUP', { groupIds: ['group-alternatives'] }, 'block-options'),
  ],
  composition: {
    groups: [
      {
        groupId: 'group-alternatives',
        groupType: 'ALTERNATIVE',
        memberFactIds: ['fact-cash-alternative', 'fact-financing-alternative'],
        sharedFactIds: ['fact-general-bonus', 'fact-shared-registration'],
        scopeIds: ['scope-version-set'],
      },
      {
        groupId: 'group-cumulative',
        groupType: 'CUMULATIVE',
        memberFactIds: ['fact-general-bonus', 'fact-shared-registration'],
        sharedFactIds: [],
        scopeIds: ['scope-model'],
      },
    ],
    relationships: [
      {
        relationId: 'relation-alternatives',
        relationType: 'MUTUALLY_EXCLUSIVE',
        factIds: ['fact-cash-alternative', 'fact-financing-alternative'],
        groupIds: ['group-alternatives'],
        scopeIds: ['scope-version-set'],
        evidenceBlockIds: ['block-options'],
      },
      {
        relationId: 'relation-cumulative',
        relationType: 'APPLIES_TOGETHER',
        factIds: ['fact-general-bonus', 'fact-shared-registration'],
        groupIds: ['group-cumulative'],
        scopeIds: ['scope-model'],
        evidenceBlockIds: ['block-options'],
      },
      {
        relationId: 'relation-general',
        relationType: 'GENERAL_RULE',
        factIds: ['fact-general-bonus'],
        groupIds: ['group-alternatives'],
        scopeIds: ['scope-model'],
        evidenceBlockIds: ['block-options'],
      },
      {
        relationId: 'relation-exception',
        relationType: 'EXCEPTION',
        factIds: ['fact-general-bonus', 'fact-version-exception'],
        groupIds: [],
        scopeIds: ['scope-model', 'scope-vehicle-4'],
        evidenceBlockIds: ['block-options'],
      },
    ],
  },
  coverage: {
    status: 'complete',
    expectedUnitCount: 2,
    completedUnitCount: 2,
    expectedVehicleCount: 4,
    extractedVehicleCount: 4,
    expectedFamilies: ['Linha Aurora'],
    extractedFamilies: ['Linha Aurora'],
    units: [
      {
        unitId: 'unit-vehicle-table',
        status: 'complete',
        sourceBlockIds: geelyRows.map((row) => row.sourceBlockIds[0]!),
        expectedItemCount: 4,
        extractedItemCount: 4,
      },
      {
        unitId: 'unit-commercial-rules',
        status: 'complete',
        sourceBlockIds: ['block-options'],
        expectedItemCount: 5,
        extractedItemCount: 5,
      },
    ],
    gaps: [],
    incompleteBlockIds: [],
    unresolvedTableRows: [],
    unresolvedScopeIds: [],
  },
};

const gwmRows = Array.from({ length: 13 }, (_, index) => {
  const page = index < 6 ? 2 : 3;
  return {
    rowId: `row-mmv-${index + 1}`,
    ordinal: index + 1,
    page,
    cells: [
      { columnId: 'column-mmv-version', text: `Versão ${index + 1}` },
      { columnId: 'column-mmv-price', text: `${120_000 + index * 1_000}.00` },
    ],
    sourceBlockIds: [`block-table-page-${page}`],
  };
});
const gwmBlocks: readonly CommercialDocumentSourceBlock[] = [
  {
    blockId: 'block-table-heading',
    documentId: 'document-main',
    page: 1,
    blockType: 'heading',
    excerpt: 'Tabela sintética de treze versões.',
  },
  {
    blockId: 'block-table-page-2',
    documentId: 'document-main',
    page: 2,
    blockType: 'table_header',
    excerpt: 'Cabeçalhos e primeiras seis linhas.',
    tableId: 'table-mmv',
  },
  {
    blockId: 'block-table-page-3',
    documentId: 'document-main',
    page: 3,
    blockType: 'table_row',
    excerpt: 'Continuação com cabeçalhos herdados e sete linhas.',
    tableId: 'table-mmv',
  },
  {
    blockId: 'block-table-footnote',
    documentId: 'document-main',
    page: 3,
    blockType: 'footnote',
    excerpt: 'Rodapé sintético aplicável à tabela lógica completa.',
    tableId: 'table-mmv',
  },
];

export const gwmLikeCommercialDocumentExtractionFixture: CommercialDocumentExtractionV1 = {
  schemaVersion: COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  documents: [sourceDocument(3, 'block-table-heading')],
  blocks: gwmBlocks,
  tables: [
    {
      tableId: 'table-mmv',
      documentId: 'document-main',
      pages: [2, 3],
      title: 'Tabela lógica multipágina',
      headerContext: 'Versões com preço público; cabeçalhos da página 2 herdados na página 3.',
      columns: [
        { columnId: 'column-mmv-version', header: 'Versão', inherited: false },
        { columnId: 'column-mmv-price', header: 'Preço público', inherited: false },
      ],
      rows: gwmRows,
      sourceBlockIds: ['block-table-page-2', 'block-table-page-3'],
      footnoteBlockIds: ['block-table-footnote'],
      continuation: {
        continuedAcrossPages: true,
        inheritedHeaderBlockIds: ['block-table-page-2'],
        segments: [
          { page: 2, sourceBlockIds: ['block-table-page-2'] },
          {
            page: 3,
            sourceBlockIds: ['block-table-page-3'],
            inheritsHeadersFromPage: 2,
          },
        ],
      },
    },
  ],
  vehicleIdentities: gwmRows.map((row, index) =>
    vehicle(
      `vehicle-mmv-${index + 1}`,
      'Linha Horizonte',
      `Versão ${index + 1}`,
      row.sourceBlockIds[0]!,
      'table-mmv',
      row.rowId,
    ),
  ),
  facts: gwmRows.map((row, index) =>
    moneyFact(
      `fact-mmv-price-${index + 1}`,
      'public_price',
      `${120_000 + index * 1_000}.00`,
      [`scope-mmv-${index + 1}`],
      row.sourceBlockIds[0]!,
      'table-mmv',
      row.rowId,
    ),
  ),
  scopes: gwmRows.map((row, index) =>
    scope(
      `scope-mmv-${index + 1}`,
      'VEHICLE',
      { vehicleIdentityIds: [`vehicle-mmv-${index + 1}`] },
      row.sourceBlockIds[0]!,
    ),
  ),
  composition: { groups: [], relationships: [] },
  coverage: {
    status: 'complete',
    expectedUnitCount: 2,
    completedUnitCount: 2,
    expectedVehicleCount: 13,
    extractedVehicleCount: 13,
    expectedFamilies: ['Linha Horizonte'],
    extractedFamilies: ['Linha Horizonte'],
    units: [
      {
        unitId: 'unit-table-page-2',
        status: 'complete',
        sourceBlockIds: ['block-table-page-2'],
        expectedItemCount: 6,
        extractedItemCount: 6,
      },
      {
        unitId: 'unit-table-page-3',
        status: 'complete',
        sourceBlockIds: ['block-table-page-3'],
        expectedItemCount: 7,
        extractedItemCount: 7,
      },
    ],
    gaps: [],
    incompleteBlockIds: [],
    unresolvedTableRows: [],
    unresolvedScopeIds: [],
  },
};

const fiatFamilies = Array.from({ length: 12 }, (_, index) => `Família ${index + 1}`);
const fiatBlocks: readonly CommercialDocumentSourceBlock[] = fiatFamilies.map((family, index) => ({
  blockId: `block-family-${index + 1}`,
  documentId: 'document-main',
  page: index + 1,
  blockType: index === 0 ? 'table_header' : 'table_row',
  section: family,
  excerpt: `Condições sintéticas da ${family}.`,
  tableId: 'table-scale',
}));
const fiatRows = Array.from({ length: 100 }, (_, index) => {
  const familyIndex = index % fiatFamilies.length;
  return {
    rowId: `row-scale-${index + 1}`,
    ordinal: index + 1,
    page: familyIndex + 1,
    cells: [
      { columnId: 'column-scale-model', text: fiatFamilies[familyIndex]! },
      { columnId: 'column-scale-version', text: `Versão ${index + 1}` },
      { columnId: 'column-scale-year', text: '2025/2026' },
    ],
    sourceBlockIds: [`block-family-${familyIndex + 1}`],
  };
});
const fiatVehicles = fiatRows.map((row, index) =>
  vehicle(
    `vehicle-scale-${index + 1}`,
    fiatFamilies[index % fiatFamilies.length]!,
    `Versão ${index + 1}`,
    row.sourceBlockIds[0]!,
    'table-scale',
    row.rowId,
  ),
);
const fiatVehicleScopes = fiatRows.map((row, index) =>
  scope(
    `scope-scale-vehicle-${index + 1}`,
    'VEHICLE',
    { vehicleIdentityIds: [`vehicle-scale-${index + 1}`] },
    row.sourceBlockIds[0]!,
  ),
);
const fiatChannels = ['Varejo', 'Diretas', 'Rede'];
const fiatFacts = fiatRows.flatMap((row, index): readonly CommercialDocumentFact[] => {
  const vehicleScope = `scope-scale-vehicle-${index + 1}`;
  const channelScope = `scope-scale-channel-${(index % fiatChannels.length) + 1}`;
  const blockId = row.sourceBlockIds[0]!;
  return [
    moneyFact(
      `fact-scale-bonus-${index + 1}`,
      'bonus',
      `${3000 + (index % 5) * 500}.00`,
      [vehicleScope, channelScope],
      blockId,
      'table-scale',
      row.rowId,
      fiatChannels[index % fiatChannels.length],
    ),
    moneyFact(
      `fact-scale-trade-${index + 1}`,
      'trade_in',
      `${5000 + (index % 4) * 500}.00`,
      [vehicleScope],
      blockId,
      'table-scale',
      row.rowId,
    ),
    {
      factId: `fact-scale-financing-${index + 1}`,
      factType: 'financing_rate',
      value: { kind: 'percentage', percentage: '1.19', rawText: '1,19% a.m.' },
      channel: fiatChannels[index % fiatChannels.length],
      eligibility: ['Crédito sujeito à análise'],
      restrictions: [],
      scopeIds: [vehicleScope, channelScope],
      evidence: evidence(blockId, 'table-scale', row.rowId),
      confidence: highConfidence,
    },
    {
      factId: `fact-scale-floor-${index + 1}`,
      factType: 'other',
      rawLabel: 'Condição de estoque da rede',
      value: { kind: 'text', text: 'Condição floor-plan-like sintética.' },
      channel: 'Rede',
      eligibility: ['Rede participante'],
      restrictions: ['Condição documental; classificação de domínio pendente'],
      scopeIds: [vehicleScope, 'scope-scale-channel-3'],
      evidence: evidence(blockId, 'table-scale', row.rowId),
      confidence: highConfidence,
    },
  ];
});

export const fiatLikeCommercialDocumentExtractionFixture: CommercialDocumentExtractionV1 = {
  schemaVersion: COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  documents: [sourceDocument(12, 'block-family-1')],
  blocks: fiatBlocks,
  tables: [
    {
      tableId: 'table-scale',
      documentId: 'document-main',
      pages: Array.from({ length: 12 }, (_, index) => index + 1),
      title: 'Tabela sintética de escala',
      headerContext: 'Doze famílias, cem identidades e PY/MY explícitos.',
      columns: [
        { columnId: 'column-scale-model', header: 'Modelo', inherited: false },
        { columnId: 'column-scale-version', header: 'Versão', inherited: false },
        { columnId: 'column-scale-year', header: 'PY/MY', inherited: false },
      ],
      rows: fiatRows,
      sourceBlockIds: fiatBlocks.map((block) => block.blockId),
      footnoteBlockIds: [],
      continuation: {
        continuedAcrossPages: true,
        inheritedHeaderBlockIds: ['block-family-1'],
        segments: fiatBlocks.map((block, index) => ({
          page: index + 1,
          sourceBlockIds: [block.blockId],
          ...(index ? { inheritsHeadersFromPage: 1 } : {}),
        })),
      },
    },
  ],
  vehicleIdentities: fiatVehicles,
  facts: fiatFacts,
  scopes: [
    ...fiatVehicleScopes,
    ...fiatChannels.map((channel, index) =>
      scope(
        `scope-scale-channel-${index + 1}`,
        'CHANNEL',
        { channels: [channel] },
        'block-family-1',
      ),
    ),
  ],
  composition: {
    groups: fiatRows.map((_, index) => ({
      groupId: `group-scale-${index + 1}`,
      groupType: 'CUMULATIVE' as const,
      memberFactIds: [
        `fact-scale-bonus-${index + 1}`,
        `fact-scale-trade-${index + 1}`,
        `fact-scale-financing-${index + 1}`,
        `fact-scale-floor-${index + 1}`,
      ],
      sharedFactIds: [],
      scopeIds: [`scope-scale-vehicle-${index + 1}`],
    })),
    relationships: fiatRows.map((row, index) => ({
      relationId: `relation-scale-${index + 1}`,
      relationType: 'APPLIES_TOGETHER' as const,
      factIds: [
        `fact-scale-bonus-${index + 1}`,
        `fact-scale-trade-${index + 1}`,
        `fact-scale-financing-${index + 1}`,
      ],
      groupIds: [`group-scale-${index + 1}`],
      scopeIds: [`scope-scale-vehicle-${index + 1}`],
      evidenceBlockIds: row.sourceBlockIds,
    })),
  },
  coverage: {
    status: 'complete',
    expectedUnitCount: 12,
    completedUnitCount: 12,
    expectedVehicleCount: 100,
    extractedVehicleCount: 100,
    expectedFamilies: fiatFamilies,
    extractedFamilies: fiatFamilies,
    units: fiatFamilies.map((_, index) => {
      const count = fiatRows.filter((row) => row.page === index + 1).length;
      return {
        unitId: `unit-family-${index + 1}`,
        status: 'complete' as const,
        sourceBlockIds: [`block-family-${index + 1}`],
        expectedItemCount: count,
        extractedItemCount: count,
      };
    }),
    gaps: [],
    incompleteBlockIds: [],
    unresolvedTableRows: [],
    unresolvedScopeIds: [],
  },
};

const volvoRows = Array.from({ length: 20 }, (_, index) => {
  const page = index < 10 ? 1 : 2;
  return {
    rowId: `row-channel-${index + 1}`,
    ordinal: index + 1,
    page,
    cells: [
      { columnId: 'column-channel-version', text: `Versão ${index + 1}` },
      { columnId: 'column-channel-retail', text: `${180_000 + index * 2_000}.00` },
      { columnId: 'column-channel-direct', text: `${178_000 + index * 2_000}.00` },
      { columnId: 'column-channel-corporate', text: `${176_000 + index * 2_000}.00` },
    ],
    sourceBlockIds: [`block-channel-page-${page}`],
  };
});
const volvoBlocks: readonly CommercialDocumentSourceBlock[] = [
  {
    blockId: 'block-channel-page-1',
    documentId: 'document-main',
    page: 1,
    blockType: 'table_header',
    excerpt: 'Preços sintéticos por canal, linhas 1 a 10.',
    tableId: 'table-channels',
  },
  {
    blockId: 'block-channel-page-2',
    documentId: 'document-main',
    page: 2,
    blockType: 'table_row',
    excerpt: 'Continuação dos preços sintéticos por canal.',
    tableId: 'table-channels',
  },
  {
    blockId: 'block-shared-restriction',
    documentId: 'document-main',
    page: 2,
    blockType: 'footnote',
    excerpt: 'Financiamento elegível somente em Varejo e Corporativo.',
  },
];
const volvoChannels = ['Varejo', 'Diretas', 'Corporativo'];
const volvoVehicleScopes = volvoRows.map((row, index) =>
  scope(
    `scope-channel-vehicle-${index + 1}`,
    'VEHICLE',
    { vehicleIdentityIds: [`vehicle-channel-${index + 1}`] },
    row.sourceBlockIds[0]!,
  ),
);
const volvoFacts = volvoRows.flatMap((row, index): readonly CommercialDocumentFact[] => {
  const vehicleScope = `scope-channel-vehicle-${index + 1}`;
  const blockId = row.sourceBlockIds[0]!;
  const prices = volvoChannels.map((channel, channelIndex) =>
    moneyFact(
      `fact-channel-price-${index + 1}-${channelIndex + 1}`,
      'promotional_price',
      `${180_000 + index * 2_000 - channelIndex * 2_000}.00`,
      [vehicleScope, `scope-channel-${channelIndex + 1}`],
      blockId,
      'table-channels',
      row.rowId,
      channel,
    ),
  );
  const financing = [0, 2].map((channelIndex): CommercialDocumentFact => ({
    factId: `fact-channel-financing-${index + 1}-${channelIndex + 1}`,
    factType: 'financing_rate',
    value: { kind: 'percentage', percentage: '0.89', rawText: '0,89% a.m.' },
    channel: volvoChannels[channelIndex],
    eligibility: [`Canal ${volvoChannels[channelIndex]}`],
    restrictions: ['Sujeito à análise de crédito'],
    scopeIds: [vehicleScope, `scope-channel-${channelIndex + 1}`],
    evidence: evidence('block-shared-restriction'),
    confidence: highConfidence,
  }));
  return [...prices, ...financing];
});
const volvoSharedFacts: readonly CommercialDocumentFact[] = [
  {
    factId: 'fact-shared-channel-restriction',
    factType: 'restriction',
    value: { kind: 'text', text: 'Financiamento não se aplica ao canal Diretas.' },
    eligibility: [],
    restrictions: ['Canal Diretas excluído do financiamento'],
    scopeIds: ['scope-document-channels'],
    evidence: evidence('block-shared-restriction'),
    confidence: highConfidence,
  },
];

export const volvoLikeCommercialDocumentExtractionFixture: CommercialDocumentExtractionV1 = {
  schemaVersion: COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  documents: [sourceDocument(2, 'block-channel-page-1')],
  blocks: volvoBlocks,
  tables: [
    {
      tableId: 'table-channels',
      documentId: 'document-main',
      pages: [1, 2],
      title: 'Tabela sintética por canal',
      headerContext: 'Preços separados por Varejo, Diretas e Corporativo.',
      columns: [
        { columnId: 'column-channel-version', header: 'Versão', inherited: false },
        { columnId: 'column-channel-retail', header: 'Varejo', inherited: false },
        { columnId: 'column-channel-direct', header: 'Diretas', inherited: false },
        { columnId: 'column-channel-corporate', header: 'Corporativo', inherited: false },
      ],
      rows: volvoRows,
      sourceBlockIds: ['block-channel-page-1', 'block-channel-page-2'],
      footnoteBlockIds: ['block-shared-restriction'],
      continuation: {
        continuedAcrossPages: true,
        inheritedHeaderBlockIds: ['block-channel-page-1'],
        segments: [
          { page: 1, sourceBlockIds: ['block-channel-page-1'] },
          {
            page: 2,
            sourceBlockIds: ['block-channel-page-2'],
            inheritsHeadersFromPage: 1,
          },
        ],
      },
    },
  ],
  vehicleIdentities: volvoRows.map((row, index) =>
    vehicle(
      `vehicle-channel-${index + 1}`,
      'Linha Prisma',
      `Versão ${index + 1}`,
      row.sourceBlockIds[0]!,
      'table-channels',
      row.rowId,
    ),
  ),
  facts: [...volvoFacts, ...volvoSharedFacts],
  scopes: [
    ...volvoVehicleScopes,
    ...volvoChannels.map((channel, index) =>
      scope(
        `scope-channel-${index + 1}`,
        'CHANNEL',
        { channels: [channel] },
        'block-channel-page-1',
      ),
    ),
    scope(
      'scope-document-channels',
      'DOCUMENT',
      { documentIds: ['document-main'] },
      'block-shared-restriction',
    ),
  ],
  composition: {
    groups: volvoRows.flatMap((_, index) =>
      [0, 2].map((channelIndex) => ({
        groupId: `group-channel-${index + 1}-${channelIndex + 1}`,
        groupType: 'CUMULATIVE' as const,
        memberFactIds: [
          `fact-channel-price-${index + 1}-${channelIndex + 1}`,
          `fact-channel-financing-${index + 1}-${channelIndex + 1}`,
        ],
        sharedFactIds: ['fact-shared-channel-restriction'],
        scopeIds: [`scope-channel-vehicle-${index + 1}`, `scope-channel-${channelIndex + 1}`],
      })),
    ),
    relationships: volvoRows.map((_, index) => ({
      relationId: `relation-channel-${index + 1}`,
      relationType: 'EXCLUDES' as const,
      factIds: [`fact-channel-financing-${index + 1}-1`, 'fact-shared-channel-restriction'],
      groupIds: [],
      scopeIds: [`scope-channel-vehicle-${index + 1}`, 'scope-channel-2'],
      evidenceBlockIds: ['block-shared-restriction'],
    })),
  },
  coverage: {
    status: 'complete',
    expectedUnitCount: 2,
    completedUnitCount: 2,
    expectedVehicleCount: 20,
    extractedVehicleCount: 20,
    expectedFamilies: ['Linha Prisma'],
    extractedFamilies: ['Linha Prisma'],
    units: [
      {
        unitId: 'unit-channel-page-1',
        status: 'complete',
        sourceBlockIds: ['block-channel-page-1'],
        expectedItemCount: 10,
        extractedItemCount: 10,
      },
      {
        unitId: 'unit-channel-page-2',
        status: 'complete',
        sourceBlockIds: ['block-channel-page-2', 'block-shared-restriction'],
        expectedItemCount: 10,
        extractedItemCount: 10,
      },
    ],
    gaps: [],
    incompleteBlockIds: [],
    unresolvedTableRows: [],
    unresolvedScopeIds: [],
  },
};
