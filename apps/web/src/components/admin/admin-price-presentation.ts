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
