import { isValidManualPriceDate } from './manual-price-batch';

export type CommercialPeriodKind = 'monthly' | 'special';

export interface CommercialPeriod {
  readonly competence: string;
  readonly kind: CommercialPeriodKind;
  readonly start: string;
  readonly end: string;
}

export type CommercialPeriodValidation =
  | { readonly ok: true; readonly period: CommercialPeriod }
  | { readonly ok: false; readonly errors: readonly string[] };

function lastDay(competence: string): string {
  const [year, month] = competence.split('-').map(Number);
  const day = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return `${competence}-${String(day).padStart(2, '0')}`;
}

export function resolveCommercialPeriod(input: {
  readonly competence: string;
  readonly kind: CommercialPeriodKind;
  readonly specialStart?: string;
  readonly specialEnd?: string;
}): CommercialPeriodValidation {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(input.competence)) {
    return { ok: false, errors: ['Competência comercial inválida.'] };
  }
  const monthlyStart = `${input.competence}-01`;
  const monthlyEnd = lastDay(input.competence);
  if (input.kind === 'monthly') {
    return {
      ok: true,
      period: {
        competence: input.competence,
        kind: 'monthly',
        start: monthlyStart,
        end: monthlyEnd,
      },
    };
  }
  const start = input.specialStart ?? '';
  const end = input.specialEnd ?? '';
  const errors: string[] = [];
  if (!isValidManualPriceDate(start) || !start.startsWith(`${input.competence}-`)) {
    errors.push('O início especial deve pertencer à competência.');
  }
  if (!isValidManualPriceDate(end) || !end.startsWith(`${input.competence}-`)) {
    errors.push('O fim especial deve pertencer à competência.');
  }
  if (isValidManualPriceDate(start) && isValidManualPriceDate(end) && end < start) {
    errors.push('O fim especial deve ser igual ou posterior ao início.');
  }
  return errors.length
    ? { ok: false, errors: Object.freeze(errors) }
    : {
        ok: true,
        period: { competence: input.competence, kind: 'special', start, end },
      };
}

export type CommercialPeriodPolicyReference =
  | { readonly policyId: string; readonly policyClientRowId?: never }
  | { readonly policyClientRowId: string; readonly policyId?: never };

export interface CommercialPeriodOfferRow {
  readonly clientRowId: string;
  readonly policyRefs: readonly CommercialPeriodPolicyReference[];
}

export interface CommercialPeriodExpectedOffer {
  readonly offerId: string;
  readonly expectedLockVersion: number;
}

export class CommercialPeriodPersistenceError extends Error {
  constructor(
    readonly sqlState: string,
    readonly technicalMessage: string,
    options?: ErrorOptions,
  ) {
    super('Commercial period persistence failed.', options);
    this.name = new.target.name;
  }
}
