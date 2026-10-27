import { watcherKey } from './watcher-foundation';
import type { WatcherIntelligenceContext } from './watcher-intelligence';
import type { WatcherDetectedEvent } from './watcher-event-detection';

export type WatcherEventEntityResolution = Readonly<{
  status: 'KNOWN_MODEL' | 'BRAND_ONLY' | 'AMBIGUOUS_BRAND' | 'UNKNOWN_BRAND';
  brandId: string | null;
  brand: string | null;
  model: string | null;
  modelId: string | null;
  proposedModel: string | null;
  evidence: string;
  candidateEligible: false;
}>;

/** Read-only interpretation. Unknown names are leads, never canonical models. */
export function resolveWatcherEventEntity(
  event: WatcherDetectedEvent,
  context: Pick<WatcherIntelligenceContext, 'brands' | 'mmvs'>,
): WatcherEventEntityResolution {
  const normalized = watcherKey(event.quote);
  const contains = (term: string) => (' ' + normalized + ' ').includes(' ' + watcherKey(term) + ' ');
  const mentions = context.brands.flatMap(brand =>
    [brand.canonicalName, ...brand.aliases]
      .filter(alias => watcherKey(alias).length > 0 && contains(alias))
      .map(alias => ({ brand, alias: watcherKey(alias) })),
  );
  const distinct = context.brands.filter(brand => mentions.some(m =>
    m.brand.id === brand.id &&
    !mentions.some(other =>
      other.brand.id !== brand.id &&
      other.alias !== m.alias &&
      (' ' + other.alias + ' ').includes(' ' + m.alias + ' '),
    ),
  ));
  const base = { evidence: event.quote, candidateEligible: false as const };
  if (distinct.length > 1)
    return { ...base, status: 'AMBIGUOUS_BRAND', brandId: null, brand: null,
      model: null, modelId: null, proposedModel: null };
  if (!distinct.length)
    return { ...base, status: 'UNKNOWN_BRAND', brandId: null, brand: null,
      model: null, modelId: null, proposedModel: null };
  const brand = distinct[0];
  const catalog = context.mmvs.filter(m =>
    [brand.canonicalName, ...brand.aliases].some(alias => watcherKey(alias) === watcherKey(m.brand)));
  const models = [...new Set(catalog.filter(m => contains(m.model)).map(m => m.model))];
  const longest = models.filter(m => !models.some(other =>
    other !== m && watcherKey(other).includes(watcherKey(m))));
  if (longest.length === 1) {
    const matches = catalog.filter(m => m.model === longest[0]);
    return { ...base, status: 'KNOWN_MODEL', brandId: brand.id,
      brand: brand.canonicalName, model: longest[0],
      modelId: matches.length === 1 ? matches[0].id : null, proposedModel: null };
  }
  // Never deduce an unknown vehicle solely from uppercase words, trim badges
  // or interpret an entire headline as the model name.
  return { ...base, status: 'BRAND_ONLY', brandId: brand.id,
    brand: brand.canonicalName, model: null, modelId: null, proposedModel: null };
}
