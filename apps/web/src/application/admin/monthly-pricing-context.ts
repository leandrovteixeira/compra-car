export const OPERATIONAL_TIME_ZONE = 'America/Sao_Paulo';

const COMPETENCE = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

export interface MonthlyPricingPeriod {
  readonly competence: string;
  readonly firstDay: string;
  readonly lastDay: string;
  readonly label: string;
}

export function currentMonthlyCompetence(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Não foi possível resolver a competência operacional.');
  return `${year}-${month}`;
}

export function normalizeMonthlyCompetence(value: unknown, now = new Date()): string {
  return typeof value === 'string' && COMPETENCE.test(value)
    ? value
    : currentMonthlyCompetence(now);
}

export function monthlyPricingPeriod(competence: string): MonthlyPricingPeriod {
  if (!COMPETENCE.test(competence)) throw new Error('Competência mensal inválida.');
  const [yearText, monthText] = competence.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    competence,
    firstDay: `${competence}-01`,
    lastDay: `${competence}-${String(last).padStart(2, '0')}`,
    label: `${new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      month: 'long',
    })
      .format(new Date(`${competence}-01T00:00:00Z`))
      .replace(/^./u, (letter) => letter.toLocaleUpperCase('pt-BR'))}/${year}`,
  };
}

export function shiftMonthlyCompetence(competence: string, offset: number): string {
  const period = monthlyPricingPeriod(competence);
  const [year, month] = period.competence.split('-').map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dateBelongsToCompetence(date: string, competence: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(date) && date.startsWith(`${competence}-`);
}

export function monthlyCompetenceOptions(
  now = new Date(),
  radius = 6,
): readonly MonthlyPricingPeriod[] {
  const current = currentMonthlyCompetence(now);
  return Object.freeze(
    Array.from({ length: radius * 2 + 1 }, (_, index) =>
      monthlyPricingPeriod(shiftMonthlyCompetence(current, index - radius)),
    ),
  );
}
