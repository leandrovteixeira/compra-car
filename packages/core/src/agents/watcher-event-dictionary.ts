/** Versioned editorial event vocabulary. Matches normalized clauses, never a verb alone. */
export const WATCHER_EVENT_DICTIONARY_VERSION = 'watcher-event-dictionary/2' as const;
export type WatcherDictionaryCategory =
  | 'NEW_MODEL' | 'NEW_COMMERCIAL_VARIANT' | 'NEW_MODEL_YEAR'
  | 'POWERTRAIN' | 'FACELIFT' | 'PRICE_CHANGE' | 'POSSIBLE_DISCONTINUATION';
type Rule = Readonly<{category: WatcherDictionaryCategory; pattern: RegExp; value?: RegExp}>;
export const WATCHER_EVENT_RULES: readonly Rule[] = [
  { category: 'NEW_MODEL', pattern: /\b(?:novo modelo|novo carro|revela (?:o |a )?novo|anuncia (?:o |a )?novo|estreia (?:o |a )?novo|(?:lanca|lancou|apresenta|apresentou|estreia)(?: o| a)? (?:novo|nova)|chega ao brasil|chegou ao brasil|desembarca no brasil|inicia vendas no brasil|comeca a vender no brasil)\b/u },
  { category: 'NEW_COMMERCIAL_VARIANT', pattern: /\b(?:nova versao|novo acabamento|ganha versao|estreia versao|adiciona versao|amplia (?:a )?gama de versoes|recebe (?:nova )?configuracao)\b/u },
  { category: 'NEW_MODEL_YEAR', pattern: /\b(?:(?:ano modelo|modelo|linha) (?:19|20|21)\d{2}|my ?(?:19|20|21)?\d{2})\b/u, value: /(?:ano[- ]modelo|modelo|linha)\s+((?:19|20|21)\d{2})/iu },
  { category: 'POWERTRAIN', pattern: /\b(?:novo motor|nova motorizacao|ganha motor|recebe nova bateria|adota motor|substitui motor|eletrifica|hibridiza|passa a oferecer versao hibrida|motorizacao)\b/u, value: /\bmotor\s+\d(?:[.,]\d)?(?:\s+(?:turbo|h[ií]brido|el[eé]trico|diesel|flex))?/iu },
  { category: 'FACELIFT', pattern: /\b(?:facelift|reestilizacao|reestilizado|reestiliza|visual renovado|atualiza visual|ganha novo design|muda aparencia)\b/u },
  { category: 'PRICE_CHANGE', pattern: /\b(?:preco|custa|custara|a partir de|reajuste|chega por|partira de|preco sugerido|fica mais caro|fica mais barato)\b/u, value: /R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?(?![\d.,])/u },
  { category: 'POSSIBLE_DISCONTINUATION', pattern: /\b(?:sai de linha|saira de linha|descontinuado|descontinuacao|fim da producao|encerra producao|deixa de ser vendido|retira do catalogo)\b/u },
];
/** Promotions are not MSRP updates and industrial/corporate reports are not product launches. */
export const WATCHER_NON_MSRP = /\b(?:desconto|bonus|cashback|financiamento|taxa zero|taxa de juros|parcelas|entrada facilitada|promocao|condicao especial)\b/u;
export const WATCHER_NON_PRODUCT = /\b(?:fabrica|empregados|contrata|capacidade produtiva|investimento industrial|resultados financeiros|relatorio financeiro)\b/u;
