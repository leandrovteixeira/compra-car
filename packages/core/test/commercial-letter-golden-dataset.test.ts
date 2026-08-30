import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_LETTER_GOLDEN_FACTS,
  COMMERCIAL_LETTER_GOLDEN_OFFERS,
} from './fixtures/commercial-letter-golden-dataset';

describe('commercial letter golden corpus', () => {
  it('keeps fact ids unique and every critical fact auditable', () => {
    const ids = COMMERCIAL_LETTER_GOLDEN_FACTS.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const fact of COMMERCIAL_LETTER_GOLDEN_FACTS.filter((item) => item.critical)) {
      expect(fact.page).toBeGreaterThan(0);
      expect(fact.channel.trim()).not.toBe('');
      expect(fact.model.trim()).not.toBe('');
      expect(fact.value.trim()).not.toBe('');
      expect(fact.evidence.trim()).not.toBe('');
    }
  });

  it('covers all four real-letter stress roles', () => {
    const documents = new Set(COMMERCIAL_LETTER_GOLDEN_FACTS.map((fact) => fact.document));
    expect(documents).toEqual(
      new Set([
        'BYD 202606-01.pdf',
        'Geely 202602-01.pdf',
        'GWM 202603-01.pdf',
        'Jeep 202606-01.pdf',
      ]),
    );
  });

  it('protects the Jeep Compass VD-CPF de/por semantic invariant', () => {
    const jeep = COMMERCIAL_LETTER_GOLDEN_FACTS.filter(
      (fact) => fact.document === 'Jeep 202606-01.pdf' && fact.page === 6,
    );
    expect(jeep.find((fact) => fact.id === 'jeep-vd-channel')?.channel).toBe('VD-CPF');
    expect(jeep.find((fact) => fact.id === 'jeep-vd-reference')?.value).toBe('174990');
    expect(jeep.find((fact) => fact.id === 'jeep-vd-promo')?.value).toBe('147990');
    expect(jeep.find((fact) => fact.id === 'jeep-vd-discount')?.value).toBe('15.5');
  });

  it('keeps offer composition references closed over the fact corpus', () => {
    const factIds = new Set(COMMERCIAL_LETTER_GOLDEN_FACTS.map((fact) => fact.id));
    const offerIds = COMMERCIAL_LETTER_GOLDEN_OFFERS.map((offer) => offer.id);
    expect(new Set(offerIds).size).toBe(offerIds.length);

    for (const offer of COMMERCIAL_LETTER_GOLDEN_OFFERS) {
      expect(offer.memberFactIds.length).toBeGreaterThanOrEqual(2);
      expect(offer.evidence.trim()).not.toBe('');
      for (const factId of offer.memberFactIds) expect(factIds.has(factId)).toBe(true);
    }
  });

  it('contains both AND and OR compositions', () => {
    const relations = new Set(COMMERCIAL_LETTER_GOLDEN_OFFERS.map((offer) => offer.relation));
    expect(relations).toEqual(new Set(['AND', 'OR']));
  });
});
