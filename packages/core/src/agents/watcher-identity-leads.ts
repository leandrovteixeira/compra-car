import { watcherKey } from './watcher-foundation';
import type { WatcherDetectedEvent } from './watcher-event-detection';
import type { WatcherEventEntityResolution } from './watcher-event-entity-resolution';

/** Literal leads for manual review, not recognized identities or database writes. */
export type WatcherIdentityLead = Readonly<{
  kind: 'UNKNOWN_BRAND' | 'UNKNOWN_MODEL';
  label: string;
  status: 'REVIEW_REQUIRED';
  evidence: string;
  reason: string;
}>;
const blocked = new Set(['nova','novo','suv','carro','brasil','veja','preco','versao','modelo','r$','em','no','ao']);
export function proposeWatcherIdentityLeads(
  event: WatcherDetectedEvent,
  entity: WatcherEventEntityResolution,
): readonly WatcherIdentityLead[] {
  if (entity.status === 'AMBIGUOUS_BRAND') return [];
  const quote = event.quote;
  const lead = (kind: WatcherIdentityLead['kind'], label: string, reason: string): WatcherIdentityLead => ({
    kind, label, reason, evidence: quote, status: 'REVIEW_REQUIRED',
  });
  // Anchor to an exact named subject followed by an editorial event verb.
  // Never guess a brand from standalone capitalized tokens elsewhere in a title.
  const brandMatch = /^\s*([\p{Lu}][\p{L}\p{N}-]{1,20})\s+(?:(?:[\p{Lu}][\p{L}\p{N}-]{1,20})\s+)?(?:chega|chegou|anuncia|anunciou|apresenta|apresentou|lan[cç]a|revela|desembarca|oferece|mostra|j[aá]\s+anuncia)\b/u.exec(quote);
  if (entity.status === 'UNKNOWN_BRAND') {
    const name = brandMatch?.[1];
    if (name && !blocked.has(watcherKey(name)))
      return [lead('UNKNOWN_BRAND',name,'LITERAL_EVENT_SUBJECT_UNVERIFIED')];
    return [];
  }
  if (entity.status !== 'BRAND_ONLY' || !entity.brand) return [];
  // Model name must be a literal product-like span immediately after a known
  // brand, before an event predicate. This produces leads, not canonical IDs.
  const escaped = entity.brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern = new RegExp('\\b' + escaped + '\\s+([A-Z][A-Za-z0-9-]{1,22}(?:\\s+[A-Z0-9][A-Za-z0-9-]{0,22})?)\\s+(?:chega|chegou|ganha|oferece|lança|lanca|anuncia|apresenta|custa|tem)\\b','u');
  const model = pattern.exec(quote)?.[1];
  if (!model || blocked.has(watcherKey(model))) return [];
  return [lead('UNKNOWN_MODEL',model,'LITERAL_MODEL_SPAN_UNVERIFIED')];
}
