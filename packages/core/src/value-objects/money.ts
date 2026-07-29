const MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})\.\d{2}$/u;
const RATE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

export function isCanonicalMoney(value: unknown): value is string {
  return typeof value === 'string' && MONEY_PATTERN.test(value);
}

function moneyToCents(value: string): bigint {
  if (!isCanonicalMoney(value)) throw new InvalidMoneyError(`Invalid canonical money: ${value}`);
  const [integer, fraction] = value.split('.');
  return BigInt(integer!) * 100n + BigInt(fraction!);
}

function centsToMoney(value: bigint): string {
  if (value < 0n) throw new InvalidMoneyError('Money cannot be negative.');
  const integer = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');
  return `${integer}.${fraction}`;
}

export function sumMoney(values: readonly string[]): string {
  return centsToMoney(values.reduce((sum, value) => sum + moneyToCents(value), 0n));
}

export function subtractMoney(minuend: string, subtrahend: string): string {
  const result = moneyToCents(minuend) - moneyToCents(subtrahend);
  if (result < 0n) throw new InvalidMoneyError('Commercial benefit cannot exceed public price.');
  return centsToMoney(result);
}

export function multiplyMoneyByRate(value: string, rate: string): string {
  if (!RATE_PATTERN.test(rate)) throw new InvalidMoneyError(`Invalid decimal rate: ${rate}`);
  const [rateInteger, rateFraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(rateFraction.length);
  const numerator = BigInt(`${rateInteger}${rateFraction}`);
  const raw = moneyToCents(value) * numerator;
  const rounded = (raw + scale / 2n) / scale;
  return centsToMoney(rounded);
}
