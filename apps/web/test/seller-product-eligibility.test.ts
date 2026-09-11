import { describe, expect, it } from 'vitest';

import { keepLatestSellerProducts } from '../src/application/catalog/seller-product-eligibility';

describe('seller product eligibility', () => {
  it('keeps the newest model year for each brand/model/version identity', () => {
    const products = [
      { id: 1, brand: 'BYD', model: 'Dolphin', version: 'GS EV', modelYear: '2025', productionYear: '2025' },
      { id: 2, brand: 'BYD', model: 'Dolphin', version: 'GS EV', modelYear: '2026', productionYear: '2025' },
      { id: 3, brand: 'BYD', model: 'Dolphin', version: 'GS EV', modelYear: '2027', productionYear: '2026' },
    ];

    expect(keepLatestSellerProducts(products).map((product) => product.id)).toEqual([3]);
  });

  it('keeps the newest production year inside the newest model year', () => {
    const products = [
      { id: 10, brand: 'Jaecoo', model: '7', version: 'Luxury', model_year: 2026, production_year: 2025 },
      { id: 11, brand: 'Jaecoo', model: '7', version: 'Luxury', model_year: 2026, production_year: 2026 },
    ];

    expect(keepLatestSellerProducts(products).map((product) => product.id)).toEqual([11]);
  });

  it('normalizes identity casing and whitespace without mixing distinct versions', () => {
    const products = [
      { id: 20, brand: ' VW ', model: 'Nivus', version: 'Highline', modelYear: 2026, productionYear: 2025 },
      { id: 21, brand: 'vw', model: ' nivus ', version: 'HIGHLINE', modelYear: 2026, productionYear: 2026 },
      { id: 22, brand: 'VW', model: 'Nivus', version: 'GTS', modelYear: 2026, productionYear: 2025 },
    ];

    expect(keepLatestSellerProducts(products).map((product) => product.id)).toEqual([21, 22]);
  });
});
