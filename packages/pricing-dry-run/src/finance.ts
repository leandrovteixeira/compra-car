import Decimal from 'decimal.js';

export function constantPayment(
  principal: Decimal,
  monthlyRate: Decimal,
  installments: number,
): Decimal {
  if (monthlyRate.isZero()) return principal.div(installments);
  return principal
    .mul(monthlyRate)
    .div(new Decimal(1).minus(new Decimal(1).plus(monthlyRate).pow(-installments)));
}

export function presentValue(
  payments: Decimal,
  monthlyRate: Decimal,
  installments: number,
): Decimal {
  if (monthlyRate.isZero()) return payments.mul(installments);
  return payments
    .mul(new Decimal(1).minus(new Decimal(1).plus(monthlyRate).pow(-installments)))
    .div(monthlyRate);
}
