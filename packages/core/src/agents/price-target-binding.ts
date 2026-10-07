import type { PriceSourceSnapshot, PriceTarget } from './price-agent-types';
import { normalizePriceSourceText } from './deterministic-price-research';

function comparisonText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

export function priceVersionAliases(target: PriceTarget): readonly string[] {
  const tokens = target.version.trim().split(/\s+/u);
  const firstTechnical = tokens.findIndex((token) => {
    const upper = token.toUpperCase();
    return (
      /^\d{1,2}(?:\.[0-9]+)?$/u.test(upper) ||
      /^(?:TGDI|TD|AT|CVT|DHT|MT|MHEV|HEV|PHEV|BEV|EV|AWD|FWD|RWD|2WD|4WD|4X2|4X4)$/u.test(
        upper,
      ) ||
      /^T\d{3}$/u.test(upper)
    );
  });
  const trim = (firstTechnical < 0 ? tokens : tokens.slice(0, firstTechnical)).join(' ').trim();
  return [...new Set([target.version.trim(), trim].filter(Boolean).map(comparisonText))].sort(
    (a, b) => b.length - a.length,
  );
}

export function priceSourceAppliesToModel(
  snapshot: PriceSourceSnapshot,
  target: PriceTarget,
): boolean {
  const model = comparisonText(target.model);
  try {
    const path = comparisonText(decodeURIComponent(new URL(snapshot.finalUrl).pathname));
    if (path.split(' ').includes(model)) return true;
  } catch {
    return false;
  }
  return comparisonText(normalizePriceSourceText(snapshot.body)).includes(model);
}

export function priceTargetBinding(text: string, target: PriceTarget): boolean {
  const haystack = comparisonText(text);
  const model = comparisonText(target.model);
  return haystack.includes(model) && priceVersionAliases(target).some((alias) => haystack.includes(alias));
}

export function priceContexts(body: string, target: PriceTarget): readonly string[] {
  const normalizedBody = normalizePriceSourceText(body);
  const comparable = comparisonText(normalizedBody);
  const windows: string[] = [];

  for (const alias of priceVersionAliases(target)) {
    let from = 0;
    for (;;) {
      const index = comparable.indexOf(alias, from);
      if (index < 0) break;
      windows.push(
        normalizedBody.slice(
          Math.max(0, index - 240),
          Math.min(normalizedBody.length, index + 1100),
        ),
      );
      from = index + Math.max(1, alias.length);
      if (windows.length >= 24) break;
    }
    if (windows.length >= 24) break;
  }

  return [...new Set(windows)];
}
