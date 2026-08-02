import type { PricingWorkflowStatus } from '@compra-car/contracts';

const STATUS_LABELS: Readonly<Record<PricingWorkflowStatus, string>> = {
  draft: 'Rascunho',
  needs_review: 'Requer revisão',
  published: 'Publicado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
};

export function formatAdminPrice(amount: string, currencyCode: 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatAdminDate(value: string | null): string {
  if (value === null) return 'Sem término';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(value);
  return new Intl.DateTimeFormat('pt-BR', dateOnly ? { timeZone: 'UTC' } : {}).format(
    new Date(dateOnly ? `${value}T00:00:00.000Z` : value),
  );
}

export function adminPriceStatusLabel(status: PricingWorkflowStatus): string {
  return STATUS_LABELS[status];
}

export function operationalDateInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function adminPriceVisualStatusLabel(
  status: PricingWorkflowStatus,
  endsOn: string | null,
  operationalDate: string,
): string {
  return isAdminPriceExpired(status, endsOn, operationalDate)
    ? 'Expirado'
    : adminPriceStatusLabel(status);
}

export function isAdminPriceExpired(
  status: PricingWorkflowStatus,
  endsOn: string | null,
  operationalDate: string,
): boolean {
  return status === 'published' && endsOn !== null && endsOn < operationalDate;
}
