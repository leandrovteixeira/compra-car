import type {
  ManualPolicyBasePriceDto,
  ManualPolicyBatchActionStateDto,
  ManualPolicyBatchGridRowDto,
  ManualPolicyFinancialReferenceDto,
  OfferBuilderDraftDto,
  OfferBuilderPolicyDto,
} from '@compra-car/contracts';
import {
  calculateManualPolicyBenefit,
  CommercialPeriodPersistenceError,
  CreateCommercialPeriodDraft,
  formatPtBrMoneyInput,
  MANUAL_POLICY_DISPLAY_LABELS,
  ManualPolicyRolloverDependencyError,
  normalizeManualPolicyBatchRow,
  resolveManualPolicyReferenceData,
  resolveCommercialPeriod,
  type CommercialPeriodExpectedOffer,
  type CommercialPeriodKind,
  type CommercialPeriodOfferRow,
  type CommercialPeriodPolicyReference,
  type ManualPolicyBatchRepository,
} from '@compra-car/core';

export const EMPTY_MANUAL_POLICY_BATCH_ROW: ManualPolicyBatchGridRowDto = Object.freeze({
  clientRowId: 'row-1',
  sourcePolicyId: '',
  productId: '',
  policyType: '',
  title: '',
  description: '',
  startsOn: '',
  endsOn: '',
  amount: '',
  rebateAmount: '0,00',
  maintenanceCount: '',
  coverageMonths: '',
  coverageKm: '',
  voucherType: '',
  calculationBasePriceId: '',
  annualRate: '',
  offerMonth: '',
  coverageYears: '',
  termMonths: '',
  customerInterestRateMonthly: '',
  downPaymentPercentage: '',
  expectedPredecessorId: '',
  expectedPredecessorLockVersion: '',
});

export function copyPolicyToGridRow(
  policy: import('@compra-car/contracts').OfferBuilderPolicyDto,
  clientRowId: string,
): ManualPolicyBatchGridRowDto {
  const parameters = policy.policyParameters ?? {};
  const text = (value: unknown) => (value == null ? '' : String(value));
  return {
    ...EMPTY_MANUAL_POLICY_BATCH_ROW,
    clientRowId,
    sourcePolicyId: policy.id,
    productId: policy.productId,
    policyType: policy.policyType,
    title: policy.title,
    description: policy.description ?? '',
    amount: formatPtBrMoneyInput(policy.fixedAmount ?? ''),
    rebateAmount: formatPtBrMoneyInput(policy.dealerRebateAmount ?? '0.00'),
    maintenanceCount: text(parameters.maintenanceCount),
    coverageMonths: text(parameters.coverageMonths),
    coverageKm: text(parameters.coverageKm),
    voucherType: policy.voucherType ?? '',
    annualRate: policy.annualRate ?? '',
    offerMonth: policy.offerMonth == null ? '' : String(policy.offerMonth),
    coverageYears: policy.coverageYears ?? '',
    termMonths: policy.termMonths == null ? '' : String(policy.termMonths),
    customerInterestRateMonthly: policy.customerInterestRateMonthly ?? '',
    downPaymentPercentage: policy.downPaymentPercentage ?? '',
  };
}

export function buildInitialManualPolicyRows(
  policies: readonly OfferBuilderPolicyDto[],
  periodKind: CommercialPeriodKind,
): readonly ManualPolicyBatchGridRowDto[] {
  if (periodKind === 'special') return [];
  return policies.map((policy, index) => copyPolicyToGridRow(policy, `copied-${index + 1}`));
}

export function buildCopiedCommercialPeriodOffers(
  baseOffers: readonly OfferBuilderDraftDto[],
  policies: readonly OfferBuilderPolicyDto[],
  submittedRows: readonly ManualPolicyBatchGridRowDto[],
  periodStart: string,
  periodEnd: string,
): {
  readonly rows: readonly CommercialPeriodOfferRow[];
  readonly unresolvedMembershipCount: number;
} {
  let unresolvedMembershipCount = 0;
  const rows = baseOffers.map((offer, index) => {
    const policyRefs: CommercialPeriodPolicyReference[] = [];
    for (const policyId of offer.policyIds) {
      const replacement = submittedRows.find(
        (row) =>
          row.sourcePolicyId === policyId ||
          (row.expectedPredecessorId !== '' && row.expectedPredecessorId === policyId),
      );
      if (replacement) {
        policyRefs.push({ policyClientRowId: replacement.clientRowId });
        continue;
      }
      const persisted = policies.find((policy) => policy.id === policyId);
      if (
        persisted &&
        persisted.startsOn <= periodStart &&
        (persisted.endsOn === null || persisted.endsOn >= periodEnd)
      ) {
        policyRefs.push({ policyId });
        continue;
      }
      unresolvedMembershipCount += 1;
    }
    return { clientRowId: `copied-offer-${index + 1}`, policyRefs };
  });
  return { rows, unresolvedMembershipCount };
}

export function resolveManualPolicyPredecessor(
  row: ManualPolicyBatchGridRowDto,
  policies: readonly OfferBuilderPolicyDto[],
  productId: string,
  periodStart: string,
): OfferBuilderPolicyDto | undefined {
  const eligible = policies.filter(
    (policy) =>
      policy.productId === productId &&
      policy.policyType === row.policyType &&
      policy.status !== 'archived' &&
      policy.status !== 'rejected' &&
      policy.startsOn < periodStart &&
      (policy.endsOn === null || policy.endsOn >= periodStart),
  );
  const copiedPredecessor = row.sourcePolicyId
    ? eligible.find((policy) => policy.id === row.sourcePolicyId)
    : undefined;
  if (copiedPredecessor) return copiedPredecessor;
  return eligible.length === 1 ? eligible[0] : undefined;
}
const fields = Object.keys(EMPTY_MANUAL_POLICY_BATCH_ROW);
function validRow(value: unknown): value is ManualPolicyBatchGridRowDto {
  return Boolean(
    value &&
    typeof value === 'object' &&
    fields.every((field) => typeof (value as Record<string, unknown>)[field] === 'string'),
  );
}
export function readManualPolicyBatchRows(
  formData: FormData,
): readonly ManualPolicyBatchGridRowDto[] | null {
  const payload = formData.get('rows');
  if (typeof payload !== 'string' || payload.length > 250000) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return Array.isArray(parsed) && parsed.length <= 101 && parsed.every(validRow) ? parsed : null;
  } catch {
    return null;
  }
}

function readJsonArray(formData: FormData, name: string): readonly unknown[] | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw.length > 250000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readOfferRows(formData: FormData): readonly CommercialPeriodOfferRow[] | null {
  const rows = readJsonArray(formData, 'offerRows');
  if (!rows || rows.length > 100) return null;
  const valid = rows.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return (
      typeof row.clientRowId === 'string' &&
      Array.isArray(row.policyRefs) &&
      row.policyRefs.every((reference) => {
        if (!reference || typeof reference !== 'object') return false;
        const item = reference as Record<string, unknown>;
        return (
          (typeof item.policyId === 'string' && item.policyClientRowId === undefined) ||
          (typeof item.policyClientRowId === 'string' && item.policyId === undefined)
        );
      })
    );
  });
  return valid ? (rows as readonly CommercialPeriodOfferRow[]) : null;
}

function readExpectedOffers(formData: FormData): readonly CommercialPeriodExpectedOffer[] | null {
  const offers = readJsonArray(formData, 'expectedOffers');
  if (!offers || offers.length > 100) return null;
  const valid = offers.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const offer = value as Record<string, unknown>;
    return (
      typeof offer.offerId === 'string' &&
      Number.isInteger(offer.expectedLockVersion) &&
      Number(offer.expectedLockVersion) > 0
    );
  });
  return valid ? (offers as readonly CommercialPeriodExpectedOffer[]) : null;
}

export function buildManualPolicyPreview(
  row: ManualPolicyBatchGridRowDto,
  productId: string | undefined,
  baseDate: string,
  prices: readonly ManualPolicyBasePriceDto[],
  references: readonly ManualPolicyFinancialReferenceDto[],
) {
  const normalized = normalizeManualPolicyBatchRow({
    ...row,
    productId: productId ?? row.productId,
    startsOn: baseDate,
    endsOn: null,
  });
  const reference = resolveManualPolicyReferenceData(normalized, prices, references);
  return { normalized, reference, benefit: calculateManualPolicyBenefit(normalized, reference) };
}
export async function executeManualPolicyBatchCreation(
  formData: FormData,
  deps: {
    authorize: () => Promise<{ actorId: string }>;
    createRepository: () => ManualPolicyBatchRepository;
    createCorrelationId: () => string;
    revalidate: (path: string) => void;
  },
): Promise<ManualPolicyBatchActionStateDto> {
  const { actorId } = await deps.authorize();
  const rows = readManualPolicyBatchRows(formData);
  const competence = String(formData.get('competence') ?? '');
  const kind = String(formData.get('periodKind') ?? 'monthly') as CommercialPeriodKind;
  const periodResolution = resolveCommercialPeriod({
    competence,
    kind,
    specialStart: String(formData.get('periodStart') ?? ''),
    specialEnd: String(formData.get('periodEnd') ?? ''),
  });
  const offerRows = readOfferRows(formData);
  const expectedOffers = readExpectedOffers(formData);
  if (!rows || !periodResolution.ok || !offerRows || !expectedOffers)
    return {
      status: 'error',
      rows: rows ?? [EMPTY_MANUAL_POLICY_BATCH_ROW],
      rowErrors: {},
      message: periodResolution.ok
        ? 'O período comercial enviado é inválido.'
        : periodResolution.errors.join(' '),
    };
  const period = periodResolution.period;
  const periodRows = rows.map((row) => ({
    ...row,
    startsOn: period.start,
    endsOn: period.end,
  }));
  const correlationId = deps.createCorrelationId();
  try {
    const result = await new CreateCommercialPeriodDraft(deps.createRepository()).execute(
      {
        productId: periodRows[0]?.productId ?? '',
        period,
        policyRows: periodRows,
        offerRows,
        expectedOffers,
      },
      { actorId, correlationId },
    );
    if (!result.ok) {
      const rowErrors: Record<string, Record<string, readonly string[]>> = {};
      for (const issue of result.issues) {
        const current = rowErrors[issue.clientRowId] ?? {};
        current[issue.field] = [...(current[issue.field] ?? []), issue.message];
        rowErrors[issue.clientRowId] = current;
      }
      return {
        status: 'error',
        rows: periodRows,
        rowErrors,
        message: 'Revise as linhas destacadas. Nenhuma policy foi criada.',
      };
    }
    deps.revalidate('/admin/prices');
    deps.revalidate('/admin/prices/policies/input');
    return {
      status: 'success',
      rows: [EMPTY_MANUAL_POLICY_BATCH_ROW],
      rowErrors: {},
      message: `${result.result.createdPolicyCount} Policy(s) e ${result.result.createdOfferCount} Offer(s) criadas como rascunho. ${result.result.rolloverCount} Policy(s) e ${result.result.closedOfferIds.length} Offer(s) anteriores encerradas temporalmente.`,
      batchId: result.result.batchId,
      createdCount: result.result.createdPolicyCount,
    };
  } catch (error) {
    console.error('Manual policy batch creation failed.', { correlationId, error });
    if (error instanceof ManualPolicyRolloverDependencyError) {
      const label = MANUAL_POLICY_DISPLAY_LABELS[error.policyTypes[0] ?? ''] ?? 'Policy';
      const related = error.offerIds.length
        ? ` Ofertas relacionadas: ${error.offerIds.map((id) => `#${id}`).join(', ')}.`
        : '';
      const rowMessage = `A ${label} vigente está vinculada a uma oferta ativa e não pode ser encerrada.`;
      const rowErrors = Object.fromEntries(
        rows
          .filter((row) => error.policyTypes.includes(row.policyType))
          .map((row) => [row.clientRowId, { row: [rowMessage] }]),
      );
      return {
        status: 'error',
        rows,
        rowErrors,
        message: `A ${label} vigente está sendo usada por ofertas ativas e não pode ser encerrada. Arquive ou substitua essas ofertas antes de cadastrar a nova ${label}.${related} Referência: ${correlationId}`,
      };
    }
    if (error instanceof CommercialPeriodPersistenceError) {
      const messages: Readonly<Record<string, string>> = {
        'commercial period rollover requires predecessor lock version':
          'A Policy predecessora precisa ser recarregada antes de salvar o período.',
        'commercial period predecessor changed by another operator':
          'Uma Policy predecessora mudou. Recarregue o workspace.',
        'commercial period is missing an affected Offer lock':
          'Uma Offer afetada não estava no snapshot do workspace. Recarregue a página.',
        'commercial period requires every affected Offer lock version':
          'Uma Offer afetada não possui versão de concorrência.',
        'affected Offer changed by another operator':
          'Uma Offer afetada mudou. Recarregue o workspace.',
        'affected Offer is not eligible for temporal closing':
          'Uma Offer selecionada não pode ser encerrada nesse período.',
        'commercial Offer cannot end before its valid_from':
          'O encerramento deixaria uma Offer com vigência inválida.',
        'retroactive closing of a published Offer is not allowed for a monthly period':
          'Uma Offer publicada não pode ser encerrada retroativamente no fluxo mensal comum.',
        'every Offer Policy must cover the complete commercial period':
          'Todas as Policies da Offer devem cobrir integralmente o período comercial.',
        'no published MSRP covers the complete commercial period':
          'Nenhum preço público publicado cobre todo o período comercial.',
        'more than one published MSRP covers the commercial period':
          'Mais de um preço público publicado cobre o período comercial.',
        'commercial period Offer benefit exceeds MSRP':
          'O benefício total da Offer excede o preço público.',
      };
      const message = messages[error.technicalMessage] ?? 'O período comercial foi rejeitado.';
      return {
        status: 'error',
        rows: periodRows,
        rowErrors: Object.fromEntries(
          periodRows.map((row) => [row.clientRowId, { row: [message] }]),
        ),
        message: `${message} Referência: ${correlationId}`,
      };
    }
    return {
      status: 'error',
      rows: periodRows,
      rowErrors: {},
      message: `Não foi possível salvar o lote. Nenhuma policy foi criada. Referência: ${correlationId}`,
    };
  }
}
