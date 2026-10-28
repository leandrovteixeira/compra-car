import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../src/app/manifest';
import { APP_NAME, APP_SHORT_NAME } from '../src/config/app-identity';
import { APP_METADATA } from '../src/config/app-metadata';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');
const oldNames = /compra[ _-]?car|go[ _-]?boot|car[ _-]?boot/i;

describe('identidade pública temporária', () => {
  it('usa descrição neutra em metadados e instalação', () => {
    expect(APP_NAME).not.toMatch(oldNames);
    expect(APP_SHORT_NAME).not.toMatch(oldNames);
    expect(JSON.stringify(manifest())).not.toMatch(oldNames);
    expect(JSON.stringify(APP_METADATA)).not.toMatch(oldNames);
    expect(manifest().icons?.every((icon) => icon.src.includes('/neutral-'))).toBe(true);
  });
  it('remove os nomes do conteúdo e o wordmark da navegação', () => {
    for (const path of [
      '../src/app/(seller)/page.tsx',
      '../src/components/auth-drawer.tsx',
      '../src/components/public-navigation.tsx',
      '../src/components/share-application.tsx',
      '../src/components/admin/commercial-product-resolution-preview.tsx',
    ])
      expect(source(path).replaceAll('@compra-car/', '@internal/')).not.toMatch(oldNames);
    const sidebar = source('../src/components/admin/admin-sidebar.tsx');
    expect(sidebar).not.toContain('name_logo_official');
    expect(sidebar).not.toContain('Navegação Carboot');
    expect(sidebar).toContain('icon_logo_official.svg');
    expect(source('../src/components/mobile-navigation.tsx')).toContain('icon_logo_official.svg');
  });
});
