import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

function pngProperties(path: string) {
  const image = readFileSync(resolve(__dirname, path));
  expect(image.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  let hasTransparencyChunk = false;
  for (let offset = 8; offset < image.length;) {
    const length = image.readUInt32BE(offset);
    const type = image.toString('ascii', offset + 4, offset + 8);
    if (type === 'tRNS') hasTransparencyChunk = true;
    offset += length + 12;
  }
  return {
    bitDepth: image[24],
    colorType: image[25],
    hasTransparencyChunk,
    height: image.readUInt32BE(20),
    width: image.readUInt32BE(16),
  };
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

  it('ships valid, opaque RGB standard, maskable, Apple and Next PNGs', () => {
    expect(pngProperties('../public/icons/app-icon-master.png')).toMatchObject({
      height: 1134,
      width: 1134,
    });
    for (const [path, size] of [
      ['../public/icons/icon-192.png', 192],
      ['../public/icons/icon-512.png', 512],
      ['../public/icons/icon-maskable-512.png', 512],
      ['../public/icons/apple-touch-icon.png', 180],
      ['../src/app/icon.png', 512],
    ] as const) {
      expect(pngProperties(path)).toEqual({
        bitDepth: 8,
        colorType: 2,
        hasTransparencyChunk: false,
        height: size,
        width: size,
      });
    }
  });

  it('removes the obsolete SVG assets and references only the current PNG family', () => {
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
