import type { CommercialDocumentFactType } from './commercial-document-extraction';

export const COMMERCIAL_KNOWLEDGE_PROMPT_VERSION = '11' as const;

export const COMMERCIAL_KNOWLEDGE_POLICY_ALLOWLIST = [
  'retail_bonus',
  'invoice_discount',
  'trade_in_bonus',
  'loyalty_bonus',
  'subsidized_financing',
  'free_ipva',
  'free_insurance',
  'free_wallbox',
  'free_registration',
  'fuel_or_recharge_voucher',
] as const;

export type CommercialKnowledgePolicyType = (typeof COMMERCIAL_KNOWLEDGE_POLICY_ALLOWLIST)[number];
export type CommercialKnowledgeConfidenceStatus = 'green' | 'yellow' | 'red';

export interface CommercialKnowledgeIssue {
  readonly confidenceStatus: CommercialKnowledgeConfidenceStatus;
  readonly reasonCode: string;
  readonly explanation: string;
  readonly decisionTaken: string;
  readonly sourceBlockIds: readonly string[];
  readonly page?: number;
  readonly promptVersion: typeof COMMERCIAL_KNOWLEDGE_PROMPT_VERSION;
}

export interface CommercialBenefitClassificationInput {
  readonly factType: CommercialDocumentFactType;
  readonly rawLabel?: string;
  readonly rawText?: string;
  readonly channel?: string;
  readonly eligibility?: readonly string[];
  readonly restrictions?: readonly string[];
  readonly sourceBlockIds?: readonly string[];
  readonly page?: number;
}

export interface CommercialBenefitClassificationResult {
  readonly policyType?: CommercialKnowledgePolicyType;
  readonly ignored: boolean;
  readonly issues: readonly CommercialKnowledgeIssue[];
}

export type CommercialOfferExpression =
  | { readonly kind: 'POLICY'; readonly policyId: string }
  | {
      readonly kind: 'AND' | 'OR';
      readonly members: readonly CommercialOfferExpression[];
    };

export interface CommercialCalibrationPolicy {
  readonly policyId: string;
  readonly productKey: string;
  readonly policyType: CommercialKnowledgePolicyType;
  readonly customerBenefitAmount?: string;
  readonly dealerRebateAmount?: string;
  readonly financingRate?: string;
  readonly downPaymentPercentage?: string;
  readonly termMonths?: number;
  readonly sourceFactIds: readonly string[];
}

export type CommercialEvidenceSourceKind =
  'STRUCTURED_TABLE' | 'SPECIFIC_NOTE' | 'GENERAL_RULE' | 'PROMOTIONAL_TEXT';

const evidencePriority: Readonly<Record<CommercialEvidenceSourceKind, number>> = {
  STRUCTURED_TABLE: 0,
  SPECIFIC_NOTE: 1,
  GENERAL_RULE: 2,
  PROMOTIONAL_TEXT: 3,
};

export function selectAuthoritativeCommercialEvidence<
  T extends { readonly kind: CommercialEvidenceSourceKind },
>(candidates: readonly T[]): T | undefined {
  return [...candidates].sort(
    (left, right) => evidencePriority[left.kind] - evidencePriority[right.kind],
  )[0];
}

export function separateIgnoredStockEligibility(values: readonly string[]): {
  readonly commercialEligibility: readonly string[];
  readonly ignoredStockEligibility: readonly string[];
} {
  const ignoredStockEligibility = values.filter((value) =>
    /\b(idade de estoque|dias de estoque|data de faturamento|wholesale date|estoque com mais de|estoque ate)\b/u.test(
      normalized(value),
    ),
  );
  return {
    commercialEligibility: values.filter((value) => !ignoredStockEligibility.includes(value)),
    ignoredStockEligibility,
  };
}

const normalized = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');

const nonRetail =
  /\b(vd|venda direta|vd cpf|pcd|taxi|cnpj|frotista|frota|governo|agro|produtor rural|diplomata|zfm|alc|big business)\b/u;

export function isRetailCommercialChannel(channel: string | undefined): boolean {
  if (!channel) return false;
  const value = normalized(channel);
  return /\bvarejo\b/u.test(value) && !nonRetail.test(value);
}

const issue = (
  input: CommercialBenefitClassificationInput,
  confidenceStatus: CommercialKnowledgeConfidenceStatus,
  reasonCode: string,
  explanation: string,
  decisionTaken: string,
): CommercialKnowledgeIssue => ({
  confidenceStatus,
  reasonCode,
  explanation,
  decisionTaken,
  sourceBlockIds: [...(input.sourceBlockIds ?? [])],
  ...(input.page === undefined ? {} : { page: input.page }),
  promptVersion: COMMERCIAL_KNOWLEDGE_PROMPT_VERSION,
});

export function classifyCommercialBenefit(
  input: CommercialBenefitClassificationInput,
): CommercialBenefitClassificationResult {
  if (!isRetailCommercialChannel(input.channel))
    return {
      ignored: true,
      issues: [
        issue(
          input,
          'green',
          'NON_RETAIL_CHANNEL_IGNORED',
          'The documentary fact belongs to a non-retail or unidentified channel.',
          'Excluded from MVP commercial materialization.',
        ),
      ],
    };

  const text = normalized(
    [input.rawLabel, input.rawText, ...(input.eligibility ?? []), ...(input.restrictions ?? [])]
      .filter(Boolean)
      .join(' '),
  );
  const supported = (
    policyType: CommercialKnowledgePolicyType,
  ): CommercialBenefitClassificationResult => ({ policyType, ignored: false, issues: [] });

  if (/\bipva\b/u.test(text)) return supported('free_ipva');
  if (/\b(desconto (em )?(nf|n f)|invoice discount)\b/u.test(text))
    return supported('invoice_discount');
  if (/\b(loyalty|fidelidade)\b/u.test(text)) {
    const hasTradeIn = /\b(trade in|troca|usado)\b/u.test(text);
    const hasOwnBrand =
      /\b(propria marca|mesma marca|byd byd|jeep jeep|vw vw|gwm gwm|geely geely)\b/u.test(text);
    if (hasTradeIn && hasOwnBrand) return supported('loyalty_bonus');
    return {
      ignored: true,
      issues: [
        issue(
          input,
          'yellow',
          'LOYALTY_OWN_BRAND_TRADE_IN_NOT_EXPLICIT',
          'Loyalty requires both Trade-In and explicit own-brand eligibility.',
          'Preserved for review without materializing a loyalty Policy.',
        ),
      ],
    };
  }
  if (/\b(trade in|supervalorizacao|usado na troca|bonus na troca|seu usado)\b/u.test(text))
    return supported('trade_in_bonus');
  if (input.factType === 'financing_rate') return supported('subsidized_financing');
  if (input.factType === 'registration_bonus' || /\b(emplacamento|registration)\b/u.test(text))
    return supported('free_registration');
  if (input.factType === 'wallbox') return supported('free_wallbox');
  if (
    input.factType === 'charging' ||
    /\b(recarga|voucher combustivel|voucher de combustivel)\b/u.test(text)
  )
    return supported('fuel_or_recharge_voucher');
  if (input.factType === 'insurance' || /\bseguro\b/u.test(text))
    return supported('free_insurance');
  if (input.factType === 'bonus' && /\bbonus\b/u.test(text)) return supported('retail_bonus');

  const unsupported =
    input.factType === 'maintenance' ||
    input.factType === 'accessory' ||
    input.factType === 'other' ||
    /\b(manutencao|garantia|acessorio|brinde|gift)\b/u.test(text);
  if (unsupported)
    return {
      ignored: true,
      issues: [
        issue(
          input,
          'yellow',
          'UNSUPPORTED_COMMERCIAL_BENEFIT',
          'The benefit family is outside the MVP allowlist.',
          'Reported as an observation; no `other` Policy was created.',
        ),
      ],
    };

  return {
    ignored: true,
    issues: [
      issue(
        input,
        'yellow',
        'COMMERCIAL_BENEFIT_CLASSIFICATION_UNRESOLVED',
        'The documentary fact does not provide explicit allowlisted Policy semantics.',
        'Preserved for review without guessing a Policy type.',
      ),
    ],
  };
}

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();
const offerKey = (offer: readonly string[]): string => uniqueSorted(offer).join('\u0000');

export function expandCommercialOfferExpression(
  expression: CommercialOfferExpression,
): readonly (readonly string[])[] {
  if (expression.kind === 'POLICY') return [[expression.policyId]];
  const expanded = expression.members.map(expandCommercialOfferExpression);
  if (expression.kind === 'OR')
    return [
      ...new Map(expanded.flat().map((offer) => [offerKey(offer), uniqueSorted(offer)])).values(),
    ];
  let offers: readonly (readonly string[])[] = [[]];
  for (const member of expanded)
    offers = offers.flatMap((base) => member.map((branch) => uniqueSorted([...base, ...branch])));
  return [...new Map(offers.map((offer) => [offerKey(offer), offer])).values()];
}

export function createIndividualCommercialOffers(
  policyIds: readonly string[],
): readonly (readonly string[])[] {
  return uniqueSorted(policyIds).map((policyId) => [policyId]);
}

export function replicateCommercialPolicyByProduct(input: {
  readonly policyId: string;
  readonly productKeys: readonly string[];
}): readonly { readonly policyId: string; readonly productKey: string }[] {
  return uniqueSorted(input.productKeys).map((productKey, index) => ({
    policyId: `${input.policyId}-${String(index + 1).padStart(2, '0')}`,
    productKey,
  }));
}

const decimal = (value: string | undefined): number => (value === undefined ? 0 : Number(value));

export function resolveDealerParticipation(input: {
  readonly manufacturerContribution?: string;
  readonly dealerParticipation?: string;
  readonly allocationExplicit: boolean;
  readonly sourceBlockIds?: readonly string[];
  readonly page?: number;
}): {
  readonly customerBenefitAmount?: string;
  readonly dealerRebateAmount?: string;
  readonly issues: readonly CommercialKnowledgeIssue[];
} {
  const manufacturer = decimal(input.manufacturerContribution);
  const dealer = decimal(input.dealerParticipation);
  if (!Number.isFinite(manufacturer) || !Number.isFinite(dealer) || manufacturer < 0 || dealer < 0)
    throw new Error('COMMERCIAL_DEALER_PARTICIPATION_INVALID');
  if (dealer > 0 && !input.allocationExplicit)
    return {
      ...(input.manufacturerContribution === undefined
        ? {}
        : { customerBenefitAmount: manufacturer.toFixed(2) }),
      issues: [
        {
          confidenceStatus: 'yellow',
          reasonCode: 'AMBIGUOUS_DEALER_PARTICIPATION_ALLOCATION',
          explanation: 'Dealer participation is explicit but its owning Policy cell is ambiguous.',
          decisionTaken: 'Kept evidence for review without allocating the dealer amount.',
          sourceBlockIds: [...(input.sourceBlockIds ?? [])],
          ...(input.page === undefined ? {} : { page: input.page }),
          promptVersion: COMMERCIAL_KNOWLEDGE_PROMPT_VERSION,
        },
      ],
    };
  return {
    customerBenefitAmount: (manufacturer + dealer).toFixed(2),
    dealerRebateAmount: dealer.toFixed(2),
    issues: [],
  };
}

export function deriveSingleMissingCommercialAmount(input: {
  readonly total: string;
  readonly knownAmounts: readonly string[];
  readonly unknownCount: number;
  readonly sourceBlockIds?: readonly string[];
  readonly page?: number;
}):
  | {
      readonly amount: string;
      readonly derived: true;
      readonly issues: readonly CommercialKnowledgeIssue[];
    }
  | undefined {
  if (input.unknownCount !== 1) return undefined;
  const total = Number(input.total);
  const known = input.knownAmounts.map(Number);
  if (!Number.isFinite(total) || known.some((value) => !Number.isFinite(value))) return undefined;
  const amount = total - known.reduce((sum, value) => sum + value, 0);
  if (amount < 0) return undefined;
  return {
    amount: amount.toFixed(2),
    derived: true,
    issues: [
      {
        confidenceStatus: 'yellow',
        reasonCode: 'MATHEMATICAL_VALUE_DERIVED',
        explanation: 'One missing commercial amount had a single solution from explicit values.',
        decisionTaken: 'Derived the value and retained provenance for review.',
        sourceBlockIds: [...(input.sourceBlockIds ?? [])],
        ...(input.page === undefined ? {} : { page: input.page }),
        promptVersion: COMMERCIAL_KNOWLEDGE_PROMPT_VERSION,
      },
    ],
  };
}

const policySemanticKey = (policy: CommercialCalibrationPolicy): string =>
  JSON.stringify({
    productKey: policy.productKey,
    policyType: policy.policyType,
    customerBenefitAmount: policy.customerBenefitAmount ?? null,
    financingRate: policy.financingRate ?? null,
    downPaymentPercentage: policy.downPaymentPercentage ?? null,
    termMonths: policy.termMonths ?? null,
  });

export function deduplicateCommercialCalibrationPolicies(
  policies: readonly CommercialCalibrationPolicy[],
): readonly CommercialCalibrationPolicy[] {
  const selected = new Map<string, CommercialCalibrationPolicy>();
  for (const policy of policies) {
    const key = policySemanticKey(policy);
    const current = selected.get(key);
    if (!current || decimal(policy.dealerRebateAmount) < decimal(current.dealerRebateAmount))
      selected.set(key, policy);
  }
  return [...selected.values()].sort((left, right) => left.policyId.localeCompare(right.policyId));
}

export const COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS = `
Commercial knowledge calibration v11 (documentary intermediate only):
- Scope: extract commercial-benefit facts only for VAREJO. Ignore VD, VD-CPF, PCD, Taxi, CNPJ/Frotista, Governo, Agro, ZFM/ALC and every special channel; non-retail evidence never completes retail.
- Downstream Policy is one atomic benefit for one exact vehicle/PY/MY and competence; downstream Offer is one valid combination of those benefits. An editorial OPCAO is not automatically one Offer and may branch into several. Do not emit final Policy/Offer objects: express atomic benefits as facts and valid combinations as composition.
- MVP allowlist semantics only: retail bonus, explicit invoice/NF discount, Trade-In, own-brand Trade-In loyalty, subsidized financing, free IPVA, insurance, wallbox, registration, and fuel/recharge voucher. Maintenance, warranty, accessories, gifts, other and unsupported families remain an evidence-backed review observation; never map them to other.
- Composition: A+B is cumulative; A OU B is alternative; A+(B OU C) yields the two exact cumulative branches. Without explicit composition, keep clear atomic benefits independent and never presume cumulability.
- Geometry is semantic: honor column ownership, merged-cell span and visual dealer-participation placement. Apply a merged condition to every covered vehicle as separate product-owned facts; a specific PY/MY exception wins. Never share one product's fact with another.
- Evidence hierarchy: structured table, then specifically bound note, then general rule, then promotional copy. SUGESTAO DE OFERTA/anuncio does not create a benefit when a structured table exists.
- A lone hyphen normally means no manufacturer contribution; hyphen plus dealer participation in the same unambiguous cell still supports the benefit. Empty is not zero and may inherit only from explicit merged scope.
- Dealer participation inside the owning cell contributes once to customer benefit and is also dealer rebate; never double count it. If allocation is ambiguous, preserve evidence and review without inventing ownership. Explicit money overrides a displayed percentage.
- Bonus Varejo, or plain Bonus inside Varejo absent Trade-In/Loyalty signals, is retail bonus. DE/POR may evidence that bonus but must not duplicate it. Invoice discount requires explicit NF/N.F semantics and is never inferred from DE/POR.
- Trade-In requires a used vehicle. Loyalty requires Trade-In plus explicit own-brand used vehicle.
- Financing preserves customer rate, down-payment percentage and term; installment amount is not valuation. Preserve distinct rates when they change the commercial branch; only equivalent derivatives inside the same composition may reduce to the lowest rate.
- Monthly competence and exact PY/MY define identity. Ignore stock-age/wholesale-date eligibility while preserving coexisting conditions as distinct compositions.
- Derive a missing value only from one unequivocal mathematical solution; mark derived, retain provenance and require yellow review. Never derive with multiple solutions.
- Confidence sidecar semantics: GREEN supported; YELLOW usable ambiguity/derivation; RED important contradiction/low confidence. Record reasonCode, explanation, decisionTaken, evidence block/page and promptVersion. Yellow/red do not by themselves block the intermediate.
`.trim();
