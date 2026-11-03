import { watcherKey } from './watcher-foundation';
import { WATCHER_EVENT_DICTIONARY_VERSION, WATCHER_EVENT_RULES, WATCHER_NON_MSRP } from './watcher-event-dictionary';

/** Event-first classification: independent of brand/model catalog and candidate policy. */
export const WATCHER_EVENT_DETECTION_VERSION = 'watcher-event-detection/1' as const;
export type WatcherDetectedEventKind =
  | (typeof WATCHER_EVENT_RULES)[number]['category']
  | 'PROMOTION' | 'MARKET_ENTRY' | 'INDUSTRIAL' | 'CORPORATE' | 'EDUCATIONAL';
export type WatcherDetectedEvent = Readonly<{
  kind: WatcherDetectedEventKind;
  field: 'title' | 'excerpt';
  quote: string;
  start: number;
  end: number;
  uncertain: boolean;
  foreignMarket: boolean;
  ruleVersion: typeof WATCHER_EVENT_DICTIONARY_VERSION;
}>;
const patterns: readonly { kind: WatcherDetectedEventKind; pattern: RegExp }[] = [
  { kind: 'PROMOTION', pattern: /\b(?:desconto|bonus|cashback|promocao|financiamento|parcelas|taxa zero|taxa de juros)\b/u },
  { kind: 'MARKET_ENTRY', pattern: /\b(?:marca vem ao brasil|nova marca no brasil|anuncia operacao no brasil|chegada da marca ao brasil|inicia importacao)\b/u },
  { kind: 'INDUSTRIAL', pattern: /\b(?:fabrica|fabricacao|producao nacional|inicia producao|soldagem|montagem|contrata empregados|capacidade produtiva|investira|investimento)\b/u },
  { kind: 'CORPORATE', pattern: /\b(?:lideranca do mercado|participacao de mercado|ranking|mais vendidos|vendas diretas|resultados financeiros)\b/u },
  { kind: 'EDUCATIONAL', pattern: /\b(?:como o carro|como funciona|entenda como|o que e)\b/u },
  ...WATCHER_EVENT_RULES.map((r) => ({kind: r.category, pattern: r.pattern})),
];
const foreign = /\b(?:eua|estados unidos|europa|europeu|china|japao|india|alemanha|argentina)\b/u;
const uncertain = /\b(?:pode|poderia|deve|talvez|rumor|boato|projecao|sem confirmacao|nao|nega|negou)\b/u;
/** No hidden inference, no input mutation and no forced event for every article. */
export function detectWatcherEvents(input: { title: string; excerpt?: string | null }): readonly WatcherDetectedEvent[] {
  if (!input || typeof input.title !== 'string' || input.title.length > 1200 ||
      (input.excerpt != null && (typeof input.excerpt !== 'string' || input.excerpt.length > 12000)))
    throw new Error('WATCHER_EVENT_INPUT_INVALID');
  const events: WatcherDetectedEvent[] = [];
  for (const [field, raw] of [['title', input.title], ['excerpt', input.excerpt ?? '']] as const) {
    if (!raw) continue;
    const normalized = watcherKey(raw);
    const kinds = new Set<WatcherDetectedEventKind>();
    for (const rule of patterns) if (rule.pattern.test(normalized)) kinds.add(rule.kind);
    // A promotional price is not a public MSRP change.
    if (WATCHER_NON_MSRP.test(normalized)) kinds.delete('PRICE_CHANGE');
    if (kinds.has('MARKET_ENTRY')) kinds.delete('NEW_MODEL');
    if (kinds.has('EDUCATIONAL')) kinds.delete('NEW_MODEL');
    for (const kind of kinds) events.push({
      kind, field, quote: raw, start: 0, end: raw.length,
      uncertain: uncertain.test(normalized) || raw.includes('?'),
      foreignMarket: foreign.test(normalized),
      ruleVersion: WATCHER_EVENT_DICTIONARY_VERSION,
    });
  }
  return events;
}
