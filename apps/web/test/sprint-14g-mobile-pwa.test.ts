import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import manifest from '../src/app/manifest';
import {
  APP_BACKGROUND_COLOR,
  APP_ICON_PATHS,
  APP_NAME,
  APP_SHORT_NAME,
  APP_THEME_COLOR,
} from '../src/config/app-identity';
import { APP_METADATA, APP_VIEWPORT } from '../src/config/app-metadata';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

function pngDimensions(path: string): readonly [number, number] {
  const image = readFileSync(resolve(__dirname, path));
  expect(image.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  return [image.readUInt32BE(16), image.readUInt32BE(20)];
}

function pngCornerRgb(path: string): string {
  const image = readFileSync(resolve(__dirname, path));
  expect(image[24]).toBe(8);
  const colorType = image[25];

  const chunks: Buffer[] = [];
  let palette: Buffer | null = null;
  for (let offset = 8; offset < image.length;) {
    const length = image.readUInt32BE(offset);
    const type = image.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(image.subarray(offset + 8, offset + 8 + length));
    if (type === 'PLTE') palette = image.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
  }

  const firstScanline = inflateSync(Buffer.concat(chunks));
  // For the first pixel there are no left/upper predictors, regardless of the PNG
  // filter selected for the row. RGB stores channels directly; indexed PNG uses PLTE.
  if (colorType === 2) return `#${firstScanline.subarray(1, 4).toString('hex').toUpperCase()}`;
  expect(colorType).toBe(3);
  expect(palette).not.toBeNull();
  const paletteOffset = firstScanline[1] * 3;
  return `#${palette!
    .subarray(paletteOffset, paletteOffset + 3)
    .toString('hex')
    .toUpperCase()}`;
}

describe('Sprint 14G mobile and installable web app foundation', () => {
  it('publishes a centralized, full-scope standalone manifest', () => {
    const value = manifest();

    expect(value).toMatchObject({
      background_color: APP_BACKGROUND_COLOR,
      display: 'standalone',
      id: '/',
      name: APP_NAME,
      scope: '/',
      short_name: APP_SHORT_NAME,
      start_url: '/',
      theme_color: APP_THEME_COLOR,
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sizes: '192x192',
          src: APP_ICON_PATHS.standard192,
          type: 'image/png',
        }),
        expect.objectContaining({
          sizes: '512x512',
          purpose: 'any',
          src: APP_ICON_PATHS.standard512,
          type: 'image/png',
        }),
        expect.objectContaining({
          sizes: '512x512',
          purpose: 'maskable',
          src: APP_ICON_PATHS.maskable512,
          type: 'image/png',
        }),
      ]),
    );
  });

  it('exposes Next and Apple install metadata with the identity theme color', () => {
    expect(APP_METADATA.applicationName).toBe(APP_NAME);
    expect(APP_METADATA.manifest).toBe('/manifest.webmanifest');
    expect(APP_METADATA.appleWebApp).toMatchObject({
      capable: true,
      statusBarStyle: 'default',
      title: APP_SHORT_NAME,
    });
    expect(APP_METADATA.icons).toMatchObject({
      apple: [expect.objectContaining({ sizes: '180x180', type: 'image/png' })],
    });
    expect(APP_VIEWPORT.themeColor).toBe(APP_THEME_COLOR);
  });

  it('ships valid standard, maskable and Apple PNG dimensions', () => {
    expect(pngDimensions('../public/icons/app-icon-master.png')).toEqual([1134, 1134]);
    expect(pngDimensions('../public/icons/icon-192.png')).toEqual([192, 192]);
    expect(pngDimensions('../public/icons/icon-512.png')).toEqual([512, 512]);
    expect(pngDimensions('../public/icons/icon-maskable-512.png')).toEqual([512, 512]);
    expect(pngDimensions('../public/icons/apple-touch-icon.png')).toEqual([180, 180]);
    expect(pngDimensions('../src/app/icon.png')).toEqual([512, 512]);
    expect(pngCornerRgb('../public/icons/icon-512.png')).toBe(
      pngCornerRgb('../public/icons/app-icon-master.png'),
    );
  });

  it('removes the obsolete monogram SVG assets and references only the car PNG family', () => {
    expect(existsSync(resolve(__dirname, '../public/icons/icon-192.svg'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../public/icons/icon-512.svg'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../src/app/icon.svg'))).toBe(false);

    const manifestSource = source('../src/app/manifest.ts');
    const metadataSource = source('../src/config/app-metadata.ts');
    expect(manifestSource).toContain('APP_ICON_PATHS');
    expect(metadataSource).toContain('APP_ICON_PATHS');
    expect(`${manifestSource}${metadataSource}`).not.toContain('.svg');
  });

  it('keeps horizontal overflow local and provides rational mobile reflow', () => {
    const css = source('../src/app/globals.css');
    const comparison = source('../src/components/comparison-table.tsx');
    const products = source('../src/components/admin/admin-product-list.tsx');
    const prices = source('../src/components/admin/admin-price-list.tsx');
    const specs = source('../src/components/admin/admin-product-specs-editor.tsx');

    expect(css).toContain('html {\n  overflow-x: hidden;');
    expect(comparison).toContain('comparison-scroll');
    expect(comparison).toContain('overflow-auto overscroll-contain');
    expect(products).toContain('admin-catalog-table-scroll overflow-x-auto');
    expect(prices).toContain('admin-pricing-table-scroll overflow-auto');
    expect(specs).toContain('admin-specs-field-grid');
    expect(css).toMatch(/@media \(min-width: 64rem\)[\s\S]*admin-specs-field-grid/);
  });

  it('raises custom controls for coarse pointers and protects mobile fields and dialogs', () => {
    const css = source('../src/app/globals.css');
    const topbar = source('../src/components/application-topbar.tsx');
    const brand = source('../src/components/brand-slot.tsx');
    const switcher = source('../src/components/context-switcher.tsx');
    const userMenu = source('../src/components/user-menu.tsx');

    expect(topbar).toContain('grid-cols-[auto_minmax(0,1fr)_auto_auto]');
    expect(brand).toContain('touch-target');
    expect(switcher).toContain('touch-target');
    expect(userMenu).toContain('touch-target-square');
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*button,[\s\S]*summary,/);
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*\.touch-target/);
    expect(css).toMatch(/@media \(max-width: 39\.999rem\)[\s\S]*font-size: 1rem/);
    expect(css).toMatch(/dialog \{[\s\S]*max-height: calc\(100dvh - 2rem\)/);
    expect(css).toContain('overflow-y: auto;');
  });
});
